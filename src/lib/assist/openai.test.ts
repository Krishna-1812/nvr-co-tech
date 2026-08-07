import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_TOOL_ROUNDS } from './config';
import { runAssist, type InputItem } from './openai';
import type { AssistEvent } from './types';

/**
 * The tool loop, against a stubbed OpenAI.
 *
 * There is no way to test this against the real thing: an assertion whose truth
 * depends on what a model felt like doing is not an assertion. So the model is
 * replaced by a script, and what is tested is the part we actually wrote, which
 * is the loop around it. Namely: that a tool call is run and its result is fed
 * back in the shape the API expects, that a failing tool does not fail the
 * answer, that the loop always terminates, and that every way this can go wrong
 * comes out as one error event rather than as an exception somewhere.
 */

const KEY = 'sk-test-not-a-real-key';

/** The frames one streamed response is made of. */
function sse(events: unknown[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n';
}

function body(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      // Delivered in small pieces, so every test also exercises the chunk
      // boundaries rather than only the happy shape.
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    },
  });
}

const says = (text: string) => ({ type: 'response.output_text.delta', delta: text });

const wants = (name: string, args: unknown, id = 'call_1') => ({
  type: 'response.output_item.done',
  item: { type: 'function_call', call_id: id, name, arguments: JSON.stringify(args) },
});

/** Queue up one scripted response per request, in order. */
function serve(...responses: (unknown[] | { status: number; json: unknown })[]) {
  const sent: unknown[] = [];
  let n = 0;

  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)));
    const next = responses[Math.min(n++, responses.length - 1)];

    if (Array.isArray(next)) {
      return new Response(body(sse(next)), { status: 200 });
    }
    return new Response(JSON.stringify(next.json), {
      status: next.status,
      headers: { 'content-type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return { sent, calls: () => fetchMock.mock.calls.length };
}

async function collect(input: InputItem[] = [{ role: 'user', content: 'hello' }]) {
  const events: AssistEvent[] = [];
  for await (const event of runAssist('be helpful', input)) events.push(event);
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

beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', KEY);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('an answer with no tools in it', () => {
  it('streams the text and finishes', async () => {
    serve([says('The two '), says('balances tie out.')]);
    const events = await collect();

    expect(textOf(events)).toBe('The two balances tie out.');
    expect(events[events.length - 1]).toEqual({ type: 'done' });
  });

  it('sends the key and the conversation', async () => {
    const { sent } = serve([says('ok')]);
    await collect([{ role: 'user', content: 'what is a BRS' }]);

    const request = sent[0] as { input: unknown[]; tools: unknown[]; store: boolean };
    expect(request.input).toEqual([{ role: 'user', content: 'what is a BRS' }]);
    expect(request.store).toBe(false);
    expect(request.tools.length).toBeGreaterThan(0);
  });

  it('treats a refusal as text, not as a failure', async () => {
    // Replacing the model's explanation of why it will not answer with our own
    // guess at what went wrong would be strictly worse than showing it.
    serve([{ type: 'response.refusal.delta', delta: 'I cannot help with that.' }]);
    expect(textOf(await collect())).toBe('I cannot help with that.');
  });

  it('ignores an event type it has never heard of', async () => {
    // The API adds these. Falling over on one would break on a day nobody
    // deployed anything.
    serve([{ type: 'response.something.new', delta: 'x' }, says('fine')]);
    expect(textOf(await collect())).toBe('fine');
  });
});

describe('running a tool', () => {
  it('runs it, reports it, and feeds the result back', async () => {
    const { sent } = serve(
      [wants('gst_split', { taxable_value: 100_000, rate_percent: 18, inter_state: false })],
      [says('CGST and SGST are ₹9,000 each.')],
    );

    const events = await collect();
    const [trace] = tracesOf(events);

    expect(trace.trace.name).toBe('gst_split');
    expect(trace.trace.ok).toBe(true);
    expect(trace.trace.summary).toMatch(/9,000/);
    expect(textOf(events)).toBe('CGST and SGST are ₹9,000 each.');

    // The second request carries the call and its result, in the two shapes the
    // Responses API expects.
    const second = (sent[1] as { input: Record<string, unknown>[] }).input;
    expect(second[1]).toMatchObject({ type: 'function_call', call_id: 'call_1' });
    expect(second[2]).toMatchObject({ type: 'function_call_output', call_id: 'call_1' });
    expect(String(second[2].output)).toContain('9000');
  });

  it('does not send the reader the payload the model gets', async () => {
    serve([wants('financial_year', { date: '2026-04-01' })], [says('done')]);
    const [trace] = tracesOf(await collect());

    // The trace is for a person. Anything else on it is something a component
    // would have to be trusted not to render.
    expect(Object.keys(trace.trace).sort()).toEqual(['args', 'label', 'name', 'ok', 'summary']);
  });

  it('runs several in one round', async () => {
    serve(
      [
        wants('financial_year', { date: '2026-04-01' }, 'a'),
        wants('check_identifier', { pan: 'ABCDE1234F' }, 'b'),
      ],
      [says('both')],
    );

    expect(tracesOf(await collect())).toHaveLength(2);
  });

  it('carries on when a tool refuses, and tells the model why', async () => {
    const { sent } = serve([wants('tds_deduction', { amount: 1_000, section: '194Q' })], [
      says('That section is not one I carry.'),
    ]);

    const events = await collect();
    expect(tracesOf(events)[0].trace.ok).toBe(false);
    expect(textOf(events)).toBe('That section is not one I carry.');

    const output = String(
      ((sent[1] as { input: Record<string, unknown>[] }).input[2] as { output: string }).output,
    );
    expect(output).toContain('error');
  });

  it('carries on when the model invents a tool', async () => {
    serve([wants('summon_an_auditor', {})], [says('There is no such thing.')]);

    const events = await collect();
    expect(tracesOf(events)[0].trace.ok).toBe(false);
    expect(textOf(events)).toBe('There is no such thing.');
  });

  it('carries on when the arguments are not JSON', async () => {
    serve(
      [
        {
          type: 'response.output_item.done',
          item: { type: 'function_call', call_id: 'x', name: 'gst_split', arguments: '{oops' },
        },
      ],
      [says('recovered')],
    );

    const events = await collect();
    expect(tracesOf(events)[0].trace.ok).toBe(false);
    expect(textOf(events)).toBe('recovered');
  });
});

describe('the loop always ends', () => {
  it('stops a model that only ever asks for tools', async () => {
    // Every response is the same tool call. Without a budget this never returns.
    const { calls } = serve([wants('financial_year', {})]);
    const events = await collect();

    expect(events[events.length - 1]).toEqual({ type: 'done' });
    expect(calls()).toBeLessThanOrEqual(MAX_TOOL_ROUNDS + 2);
    expect(tracesOf(events).length).toBeLessThanOrEqual(MAX_TOOL_ROUNDS);
  });

  it('says something rather than ending on an empty answer', async () => {
    serve([wants('financial_year', {})]);
    expect(textOf(await collect())).toMatch(/could not get to an answer/);
  });

  it('gives the model a round to answer once its budget has gone', async () => {
    // One more tool round than the budget allows, so the last one is refused.
    const rounds = Array.from({ length: MAX_TOOL_ROUNDS + 1 }, () => [
      wants('financial_year', {}),
    ]);
    const { sent } = serve(...rounds, [says('Right, without the calculators then.')]);

    const events = await collect();
    expect(tracesOf(events)).toHaveLength(MAX_TOOL_ROUNDS);
    expect(textOf(events)).toBe('Right, without the calculators then.');

    // The refusal reached the model in the channel a result would have.
    const last = (sent[sent.length - 1] as { input: Record<string, unknown>[] }).input;
    const refusal = last.filter((i) => i.type === 'function_call_output').at(-1);
    expect(String(refusal?.output)).toMatch(/No more calculations are allowed/);
  });
});

describe('when it goes wrong', () => {
  it('says so plainly when the account has no credits', async () => {
    serve({
      status: 429,
      json: { error: { code: 'credit_balance_exhausted', type: 'insufficient_quota' } },
    });

    expect(errorOf(await collect())?.message).toMatch(/no credits left/);
  });

  it('says so plainly when the key is refused', async () => {
    serve({ status: 401, json: { error: { code: 'invalid_api_key' } } });
    expect(errorOf(await collect())?.message).toMatch(/key this deployment is using was refused/);
  });

  it('names the model when the key cannot reach it', async () => {
    serve({ status: 404, json: { error: { code: 'model_not_found' } } });
    expect(errorOf(await collect())?.message).toMatch(/OPENAI_MODEL/);
  });

  it('reports a failure that arrives inside the stream', async () => {
    serve([says('half a '), { type: 'response.failed', response: { error: { message: 'boom' } } }]);

    const events = await collect();
    expect(textOf(events)).toBe('half a ');
    expect(errorOf(events)?.message).toMatch(/boom/);
  });

  it('keeps what was written when an answer runs out of room', async () => {
    serve([
      says('The first part is fine'),
      { type: 'response.incomplete', response: { incomplete_details: { reason: 'max_output_tokens' } } },
    ]);

    // Not an error. What was written is still worth reading, so the note is
    // appended to it rather than replacing it.
    const events = await collect();
    expect(errorOf(events)).toBeUndefined();
    expect(textOf(events)).toMatch(/The first part is fine/);
    expect(textOf(events)).toMatch(/reached its length limit/);
  });

  it('reports a network failure as one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch failed');
      }),
    );

    expect(errorOf(await collect())?.message).toMatch(/could not reach OpenAI/);
  });

  it('says it is not switched on when there is no key', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    serve([says('never asked')]);

    expect(errorOf(await collect())?.message).toMatch(/needs an OpenAI key/);
  });

  it('always ends with exactly one terminal event', async () => {
    serve({ status: 500, json: {} });
    const events = await collect();

    expect(events.filter((e) => e.type === 'done' || e.type === 'error')).toHaveLength(1);
  });
});
