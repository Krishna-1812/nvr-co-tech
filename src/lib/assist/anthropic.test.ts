import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_TOOL_ROUNDS, MODEL } from './config';
import { runAssist, type Turn } from './anthropic';
import type { AssistEvent } from './types';

/**
 * The tool loop, against a stubbed Anthropic.
 *
 * There is no way to test this against the real thing: an assertion whose truth
 * depends on what a model felt like doing is not an assertion. So the model is
 * replaced by a script, and what is tested is the part we actually wrote: the
 * SSE event assembly, the tool round trip, and the failure messages.
 */

const KEY = 'test-not-a-real-key';

// ─── Building a scripted stream ──────────────────────────────────────────────

const messageStart = () => ({ type: 'message_start' });
const blockStart = (index: number, content_block: Record<string, unknown>) => ({
  type: 'content_block_start',
  index,
  content_block,
});
const textDelta = (index: number, text: string) => ({
  type: 'content_block_delta',
  index,
  delta: { type: 'text_delta', text },
});
const jsonDelta = (index: number, partial_json: string) => ({
  type: 'content_block_delta',
  index,
  delta: { type: 'input_json_delta', partial_json },
});
const blockStop = (index: number) => ({ type: 'content_block_stop', index });
const messageDelta = (stop_reason: string) => ({ type: 'message_delta', delta: { stop_reason } });
const messageStop = () => ({ type: 'message_stop' });

/** A text answer, optionally as several deltas, as one whole message. */
function says(text: string | string[], stopReason = 'end_turn') {
  const parts = Array.isArray(text) ? text : [text];
  return [
    messageStart(),
    blockStart(0, { type: 'text' }),
    ...parts.map((p) => textDelta(0, p)),
    blockStop(0),
    messageDelta(stopReason),
    messageStop(),
  ];
}

/** One or more tool calls, as one whole message. */
function wants(calls: { id: string; name: string; args?: unknown }[]) {
  const out: unknown[] = [messageStart()];
  calls.forEach((call, index) => {
    out.push(blockStart(index, { type: 'tool_use', id: call.id, name: call.name }));
    out.push(jsonDelta(index, JSON.stringify(call.args ?? {})));
    out.push(blockStop(index));
  });
  out.push(messageDelta('tool_use'), messageStop());
  return out;
}

/** Delivered in small pieces, so chunk boundaries are exercised too. */
function body(frames: unknown[]): ReadableStream<Uint8Array> {
  const text = frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 9) controller.enqueue(bytes.slice(i, i + 9));
      controller.close();
    },
  });
}

/** Queue up one scripted response per request, in order. */
function serve(
  ...responses: (unknown[] | { status: number; json: unknown; headers?: Record<string, string> })[]
) {
  const sent: Record<string, unknown>[] = [];
  const urls: string[] = [];
  let n = 0;

  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    urls.push(String(url));
    sent.push(JSON.parse(String(init.body)));
    const next = responses[Math.min(n++, responses.length - 1)];

    if (Array.isArray(next)) return new Response(body(next), { status: 200 });
    return new Response(JSON.stringify(next.json), {
      status: next.status,
      headers: { 'content-type': 'application/json', ...next.headers },
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return { sent, urls, headers: () => fetchMock.mock.calls[0]?.[1]?.headers, calls: () => fetchMock.mock.calls.length };
}

async function collect(turns: Turn[] = [{ role: 'user', content: 'hello' }]) {
  const events: AssistEvent[] = [];
  for await (const event of runAssist('be helpful', turns)) events.push(event);
  return events;
}

const textOf = (events: AssistEvent[]) =>
  events
    .filter((e): e is Extract<AssistEvent, { type: 'delta' }> => e.type === 'delta')
    .map((e) => e.text)
    .join('');

const tracesOf = (events: AssistEvent[]) =>
  events.filter((e): e is Extract<AssistEvent, { type: 'tool' }> => e.type === 'tool');

const errorOf = (events: AssistEvent[]) =>
  events.find((e): e is Extract<AssistEvent, { type: 'error' }> => e.type === 'error');

/** The messages of a request, by role. */
const rolesOf = (request: Record<string, unknown>) =>
  (request.messages as { role: string }[]).map((m) => m.role);

const messagesOf = (request: Record<string, unknown>) => request.messages as { role: string; content: unknown }[];

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', KEY);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('the request', () => {
  it('streams from the configured model', async () => {
    const { sent, urls } = serve(says('ok'));
    await collect();

    expect(urls[0]).toContain('/messages');
    expect(sent[0].model).toBe(MODEL);
    expect(sent[0].stream).toBe(true);
  });

  it('puts the key in a header, not in the query string', async () => {
    // A key in a URL ends up in access logs and referrers.
    const { urls, headers } = serve(says('ok'));
    await collect();

    expect(urls[0]).not.toContain(KEY);
    expect((headers() as Record<string, string>)['x-api-key']).toBe(KEY);
  });

  it('sends the instructions as a system field rather than as a turn', async () => {
    const { sent } = serve(says('ok'));
    await collect();

    expect(sent[0].system).toBe('be helpful');
  });

  it('passes turn roles through unchanged', async () => {
    const { sent } = serve(says('ok'));
    await collect([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'answer' },
      { role: 'user', content: 'second' },
    ]);

    expect(rolesOf(sent[0])).toEqual(['user', 'assistant', 'user']);
  });

  it('sends every tool as its own object', async () => {
    const { sent } = serve(says('ok'));
    await collect();

    const tools = sent[0].tools as { name: string; input_schema: unknown }[];
    expect(tools.length).toBeGreaterThan(1);
    for (const tool of tools) expect(tool.input_schema).toBeTruthy();
  });
});

describe('an answer with no tools in it', () => {
  it('streams the text and finishes', async () => {
    const events = await collect2(says(['The two ', 'balances tie out.']));
    expect(textOf(events)).toBe('The two balances tie out.');
    expect(events[events.length - 1]).toEqual({ type: 'done' });
  });

  it('never shows the model its own thinking', async () => {
    /*
     * Extended thinking, when a deployment turns it on, streams as a separate
     * content block whose deltas are `thinking_delta`, not `text_delta`. This
     * code only ever reads `text_delta`, so a thinking block is dropped by
     * construction rather than by a special case.
     */
    const frames = [
      messageStart(),
      blockStart(0, { type: 'thinking' }),
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Hmm, is it 9,000?' } },
      blockStop(0),
      blockStart(1, { type: 'text' }),
      textDelta(1, 'CGST is ₹9,000.'),
      blockStop(1),
      messageDelta('end_turn'),
      messageStop(),
    ];
    expect(textOf(await collect2(frames))).toBe('CGST is ₹9,000.');
  });

  it('ignores an event shape it has never seen', async () => {
    const frames = [{ type: 'ping' }, ...says('fine')];
    expect(textOf(await collect2(frames))).toBe('fine');
  });
});

describe('running a tool', () => {
  it('runs it, reports it, and feeds the result back', async () => {
    const { sent } = serve(
      wants([{ id: 'call_1', name: 'gst_split', args: { taxable_value: 100_000, rate_percent: 18, inter_state: false } }]),
      says('CGST and SGST are ₹9,000 each.'),
    );

    const events = await collect();
    const [trace] = tracesOf(events);

    expect(trace.trace.name).toBe('gst_split');
    expect(trace.trace.ok).toBe(true);
    expect(trace.trace.summary).toMatch(/9,000/);
    expect(textOf(events)).toBe('CGST and SGST are ₹9,000 each.');

    const second = messagesOf(sent[1]);
    expect(second[1]).toMatchObject({ role: 'assistant', content: [{ type: 'tool_use', id: 'call_1', name: 'gst_split' }] });
    expect(second[2]).toMatchObject({ role: 'user' });
    const resultBlock = (second[2].content as { tool_use_id: string; content: string }[])[0];
    expect(resultBlock.tool_use_id).toBe('call_1');
    expect(JSON.parse(resultBlock.content)).toMatchObject({ cgst: 9000, sgst: 9000 });
  });

  it('puts several calls in one turn and all their results in the next', async () => {
    // Interleaving a call and its result per turn is rejected when the model
    // asked for more than one at a time.
    const { sent } = serve(
      wants([
        { id: 'a', name: 'financial_year', args: { date: '2026-04-01' } },
        { id: 'b', name: 'check_identifier', args: { pan: 'ABCDE1234F' } },
      ]),
      says('both'),
    );

    expect(tracesOf(await collect())).toHaveLength(2);

    const second = messagesOf(sent[1]);
    expect(second[1].content).toHaveLength(2);
    expect(second[2].content).toHaveLength(2);
  });

  it('carries on when a tool refuses, and tells the model why', async () => {
    const { sent } = serve(
      wants([{ id: 'call_1', name: 'tds_deduction', args: { amount: 1_000, section: '194Q' } }]),
      says('That section is not one I carry.'),
    );

    const events = await collect();
    expect(tracesOf(events)[0].trace.ok).toBe(false);
    expect(textOf(events)).toBe('That section is not one I carry.');

    const reply = messagesOf(sent[1])[2].content as { content: string; is_error?: boolean }[];
    expect(reply[0].is_error).toBe(true);
    expect(JSON.parse(reply[0].content)).toHaveProperty('error');
  });

  it('carries on when the model invents a tool', async () => {
    serve(wants([{ id: 'call_1', name: 'summon_an_auditor' }]), says('There is no such thing.'));

    const events = await collect();
    expect(tracesOf(events)[0].trace.ok).toBe(false);
    expect(textOf(events)).toBe('There is no such thing.');
  });

  it('treats missing arguments as none rather than falling over', async () => {
    serve(wants([{ id: 'call_1', name: 'financial_year' }]), says('recovered'));

    const events = await collect();
    expect(tracesOf(events)[0].trace.ok).toBe(true);
    expect(textOf(events)).toBe('recovered');
  });
});

describe('the loop always ends', () => {
  it('stops a model that only ever asks for tools', async () => {
    const { calls } = serve(wants([{ id: 'x', name: 'financial_year' }]));
    const events = await collect();

    expect(events[events.length - 1]).toEqual({ type: 'done' });
    expect(calls()).toBeLessThanOrEqual(MAX_TOOL_ROUNDS + 2);
    expect(tracesOf(events).length).toBeLessThanOrEqual(MAX_TOOL_ROUNDS);
  });

  it('says something rather than ending on an empty answer', async () => {
    serve(wants([{ id: 'x', name: 'financial_year' }]));
    expect(textOf(await collect())).toMatch(/could not get to an answer/);
  });

  it('gives the model a round to answer once its budget has gone', async () => {
    const rounds = Array.from({ length: MAX_TOOL_ROUNDS + 1 }, () => wants([{ id: 'x', name: 'financial_year' }]));
    const { sent } = serve(...rounds, says('Right, without the calculators then.'));

    const events = await collect();
    expect(tracesOf(events)).toHaveLength(MAX_TOOL_ROUNDS);
    expect(textOf(events)).toBe('Right, without the calculators then.');

    const last = messagesOf(sent[sent.length - 1]);
    const refusal = JSON.stringify(last[last.length - 1].content);
    expect(refusal).toMatch(/No more calculations are allowed/);
  });
});

describe('when it goes wrong', () => {
  it('says to wait when it is a rate limit', async () => {
    serve({ status: 429, json: { error: { type: 'rate_limit_error', message: 'Too many requests' } } });

    const message = errorOf(await collect())?.message ?? '';
    expect(message).toMatch(/Give it a minute/);
  });

  it('passes on the retry-after header', async () => {
    serve({
      status: 429,
      json: { error: { type: 'rate_limit_error' } },
      headers: { 'retry-after': '12' },
    });

    expect(errorOf(await collect())?.message).toMatch(/about 12 seconds/);
  });

  it('says so plainly when the key is refused', async () => {
    serve({ status: 401, json: { error: { type: 'authentication_error', message: 'invalid x-api-key' } } });
    expect(errorOf(await collect())?.message).toMatch(/key this deployment is using was refused/);
  });

  it('names the model when there is no such model', async () => {
    serve({ status: 404, json: { error: { type: 'not_found_error', message: 'model: x' } } });

    const message = errorOf(await collect())?.message ?? '';
    expect(message).toContain(MODEL);
    expect(message).toContain('ANTHROPIC_MODEL');
  });

  it('passes a rejected field through, because it names itself', async () => {
    serve({ status: 400, json: { error: { type: 'invalid_request_error', message: 'max_tokens: field required' } } });
    expect(errorOf(await collect())?.message).toContain('max_tokens');
  });

  it('reports a failure that arrives inside the stream', async () => {
    serve([messageStart(), blockStart(0, { type: 'text' }), textDelta(0, 'half a '), { type: 'error', error: { message: 'internal' } }]);

    const events = await collect();
    expect(textOf(events)).toBe('half a ');
    expect(errorOf(events)?.message).toMatch(/internal/);
  });

  it('keeps what was written when an answer runs out of room', async () => {
    serve(says('The first part is fine', 'max_tokens'));

    // Not an error. What was written is still worth reading, so the note is
    // appended to it rather than replacing it.
    const events = await collect();
    expect(errorOf(events)).toBeUndefined();
    expect(textOf(events)).toMatch(/The first part is fine/);
    expect(textOf(events)).toMatch(/reached its length limit/);
  });

  it('explains a refusal without losing what was already written', async () => {
    serve(says('Here is the position so far.', 'refusal'));

    const events = await collect();
    expect(textOf(events)).toMatch(/Here is the position so far\./);
    expect(textOf(events)).toMatch(/declined by the model/);
  });

  it('says nothing extra when an answer simply finished', async () => {
    serve(says('Done.'));
    expect(textOf(await collect())).toBe('Done.');
  });

  it('reports a network failure as one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch failed');
      }),
    );

    expect(errorOf(await collect())?.message).toMatch(/could not reach Anthropic/);
  });

  it('says it is not switched on when there is no key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    serve(says('never asked'));

    expect(errorOf(await collect())?.message).toMatch(/needs an Anthropic key/);
  });

  it('always ends with exactly one terminal event', async () => {
    serve({ status: 500, json: {} });
    const events = await collect();

    expect(events.filter((e) => e.type === 'done' || e.type === 'error')).toHaveLength(1);
  });
});

/** collect() but taking a scripted frame list directly, for single-shot tests. */
async function collect2(frames: unknown[]) {
  serve(frames);
  return collect();
}
