import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_TOOL_ROUNDS, MODEL } from './config';
import { runAssist, type Turn } from './gemini';
import type { AssistEvent } from './types';

/**
 * The tool loop, against a stubbed Gemini.
 *
 * There is no way to test this against the real thing: an assertion whose truth
 * depends on what a model felt like doing is not an assertion. So the model is
 * replaced by a script, and what is tested is the part we actually wrote.
 *
 * Several of these are regressions against things that were wrong first time and
 * were only found by sending real requests: the thought signature that has to
 * come back untouched, the schema field Gemini rejects by name, the thinking
 * text that must never reach the reader, and a quota of zero being reported with
 * the same status code as "slow down".
 */

const KEY = 'test-not-a-real-key';

/** The frames one streamed response is made of. */
function sse(frames: unknown[]): string {
  return frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join('');
}

function body(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      // Delivered in small pieces, so every test also exercises the chunk
      // boundaries rather than only the happy shape.
      for (let i = 0; i < bytes.length; i += 9) controller.enqueue(bytes.slice(i, i + 9));
      controller.close();
    },
  });
}

/** One frame carrying some parts, and optionally the reason it stopped. */
const frame = (parts: unknown[], finishReason?: string) => ({
  candidates: [{ content: { parts, role: 'model' }, ...(finishReason ? { finishReason } : {}) }],
});

const says = (text: string) => frame([{ text }]);
const thinks = (text: string) => frame([{ text, thought: true }]);
const ends = (reason: string) => frame([], reason);

/**
 * A function call as Gemini really sends one: with a thought signature attached
 * to the part rather than to the call.
 */
const wants = (name: string, args: unknown, id = 'call_1', signature = 'sig-abc') =>
  frame([{ functionCall: { name, args, id }, thoughtSignature: signature }]);

/** Queue up one scripted response per request, in order. */
function serve(...responses: (unknown[] | { status: number; json: unknown })[]) {
  const sent: Record<string, unknown>[] = [];
  const urls: string[] = [];
  let n = 0;

  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    urls.push(String(url));
    sent.push(JSON.parse(String(init.body)));
    const next = responses[Math.min(n++, responses.length - 1)];

    if (Array.isArray(next)) return new Response(body(sse(next)), { status: 200 });
    return new Response(JSON.stringify(next.json), {
      status: next.status,
      headers: { 'content-type': 'application/json' },
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

/** The parts of a request, by the turn they are in. */
const partsOf = (request: Record<string, unknown>) =>
  (request.contents as { role: string; parts: unknown[] }[]).map((c) => ({
    role: c.role,
    parts: c.parts,
  }));

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', KEY);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('the request', () => {
  it('streams from the configured model, as server-sent events', async () => {
    const { urls } = serve([says('ok')]);
    await collect();

    expect(urls[0]).toContain(`/models/${MODEL}:streamGenerateContent`);
    expect(urls[0]).toContain('alt=sse');
  });

  it('puts the key in a header, not in the query string', async () => {
    // A key in a URL ends up in access logs and referrers.
    const { urls, headers } = serve([says('ok')]);
    await collect();

    expect(urls[0]).not.toContain(KEY);
    expect((headers() as Record<string, string>)['x-goog-api-key']).toBe(KEY);
  });

  it('sends the instructions as a system instruction rather than as a turn', async () => {
    const { sent } = serve([says('ok')]);
    await collect();

    expect(sent[0].systemInstruction).toEqual({ parts: [{ text: 'be helpful' }] });
  });

  it('calls an assistant turn a model turn, which is what Gemini calls it', async () => {
    const { sent } = serve([says('ok')]);
    await collect([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'answer' },
      { role: 'user', content: 'second' },
    ]);

    expect(partsOf(sent[0]).map((c) => c.role)).toEqual(['user', 'model', 'user']);
  });

  it('sends every tool in one declaration list', async () => {
    const { sent } = serve([says('ok')]);
    await collect();

    const tools = sent[0].tools as { functionDeclarations: unknown[] }[];
    expect(tools).toHaveLength(1);
    expect(tools[0].functionDeclarations.length).toBeGreaterThan(1);
  });

  it('sends no schema field Gemini would reject', async () => {
    /*
     * Regression, and a hard 400 rather than a warning: Gemini takes an
     * OpenAPI subset, and `additionalProperties` is rejected by name. Every
     * JSON Schema elsewhere in this codebase carries it, so the next person to
     * add a tool will reach for it too.
     */
    const allowed = new Set([
      'type', 'format', 'title', 'description', 'nullable', 'enum',
      'items', 'properties', 'required', 'minimum', 'maximum',
    ]);

    const { sent } = serve([says('ok')]);
    await collect();

    const walk = (node: unknown, path: string) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      for (const [key, value] of Object.entries(node)) {
        expect(allowed.has(key), `${path}.${key} is not in Gemini's schema subset`).toBe(true);
        if (key === 'properties' || key === 'items') {
          for (const [name, child] of Object.entries(value as object)) {
            walk(child, `${path}.${key}.${name}`);
          }
        }
      }
    };

    const tools = sent[0].tools as { functionDeclarations: { name: string; parameters: unknown }[] }[];
    for (const declaration of tools[0].functionDeclarations) {
      walk(declaration.parameters, declaration.name);
    }
  });
});

describe('an answer with no tools in it', () => {
  it('streams the text and finishes', async () => {
    serve([says('The two '), says('balances tie out.'), ends('STOP')]);
    const events = await collect();

    expect(textOf(events)).toBe('The two balances tie out.');
    expect(events[events.length - 1]).toEqual({ type: 'done' });
  });

  it('never shows the model its own thinking', async () => {
    /*
     * Thinking arrives in the same stream as the answer, marked. It is draft
     * reasoning that contradicts itself on the way to being right, and a reader
     * cannot tell it from the answer, so it is dropped rather than shown.
     */
    serve([thinks('Hmm, is it 9,000 or 18,000?'), says('CGST is ₹9,000.'), ends('STOP')]);
    expect(textOf(await collect())).toBe('CGST is ₹9,000.');
  });

  it('ignores a frame shape it has never seen', async () => {
    serve([{ usageMetadata: { totalTokenCount: 5 } }, says('fine'), ends('STOP')]);
    expect(textOf(await collect())).toBe('fine');
  });
});

describe('running a tool', () => {
  it('runs it, reports it, and feeds the result back', async () => {
    const { sent } = serve(
      [wants('gst_split', { taxable_value: 100_000, rate_percent: 18, inter_state: false })],
      [says('CGST and SGST are ₹9,000 each.'), ends('STOP')],
    );

    const events = await collect();
    const [trace] = tracesOf(events);

    expect(trace.trace.name).toBe('gst_split');
    expect(trace.trace.ok).toBe(true);
    expect(trace.trace.summary).toMatch(/9,000/);
    expect(textOf(events)).toBe('CGST and SGST are ₹9,000 each.');

    const second = partsOf(sent[1]);
    expect(second[1].role).toBe('model');
    expect(second[2].role).toBe('user');
    expect(second[2].parts[0]).toMatchObject({
      functionResponse: { name: 'gst_split', id: 'call_1', response: { cgst: 9000, sgst: 9000 } },
    });
  });

  it('hands the thought signature back untouched', async () => {
    /*
     * Regression, and the one that cannot be guessed. Echoing a function call
     * back WITHOUT the thoughtSignature it arrived with is a hard 400: "Function
     * call is missing a thought_signature in functionCall parts". The signature
     * is opaque, so the only correct thing to do is return it exactly, which
     * means keeping the whole part rather than rebuilding it from name and args.
     */
    const { sent } = serve(
      [wants('financial_year', { date: '2026-04-01' }, 'x', 'sig-that-must-survive')],
      [says('done'), ends('STOP')],
    );

    await collect();

    expect(partsOf(sent[1])[1].parts[0]).toMatchObject({
      functionCall: { name: 'financial_year' },
      thoughtSignature: 'sig-that-must-survive',
    });
  });

  it('puts several calls in one turn and all their results in the next', async () => {
    // Interleaving a call and its result per turn is rejected when the model
    // asked for more than one at a time.
    const { sent } = serve(
      [
        frame([
          { functionCall: { name: 'financial_year', args: { date: '2026-04-01' }, id: 'a' }, thoughtSignature: 's1' },
          { functionCall: { name: 'check_identifier', args: { pan: 'ABCDE1234F' }, id: 'b' }, thoughtSignature: 's2' },
        ]),
      ],
      [says('both'), ends('STOP')],
    );

    expect(tracesOf(await collect())).toHaveLength(2);

    const second = partsOf(sent[1]);
    expect(second[1].parts).toHaveLength(2);
    expect(second[2].parts).toHaveLength(2);
  });

  it('carries on when a tool refuses, and tells the model why', async () => {
    const { sent } = serve(
      [wants('tds_deduction', { amount: 1_000, section: '194Q' })],
      [says('That section is not one I carry.'), ends('STOP')],
    );

    const events = await collect();
    expect(tracesOf(events)[0].trace.ok).toBe(false);
    expect(textOf(events)).toBe('That section is not one I carry.');

    const reply = partsOf(sent[1])[2].parts[0] as { functionResponse: { response: unknown } };
    expect(reply.functionResponse.response).toHaveProperty('error');
  });

  it('carries on when the model invents a tool', async () => {
    serve([wants('summon_an_auditor', {})], [says('There is no such thing.'), ends('STOP')]);

    const events = await collect();
    expect(tracesOf(events)[0].trace.ok).toBe(false);
    expect(textOf(events)).toBe('There is no such thing.');
  });

  it('treats missing arguments as none rather than falling over', async () => {
    serve([wants('financial_year', undefined)], [says('recovered'), ends('STOP')]);

    const events = await collect();
    expect(tracesOf(events)[0].trace.ok).toBe(true);
    expect(textOf(events)).toBe('recovered');
  });
});

describe('the loop always ends', () => {
  it('stops a model that only ever asks for tools', async () => {
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
    const rounds = Array.from({ length: MAX_TOOL_ROUNDS + 1 }, () => [wants('financial_year', {})]);
    const { sent } = serve(...rounds, [says('Right, without the calculators then.'), ends('STOP')]);

    const events = await collect();
    expect(tracesOf(events)).toHaveLength(MAX_TOOL_ROUNDS);
    expect(textOf(events)).toBe('Right, without the calculators then.');

    const last = partsOf(sent[sent.length - 1]);
    const refusal = JSON.stringify(last[last.length - 1].parts);
    expect(refusal).toMatch(/No more calculations are allowed/);
  });
});

describe('when it goes wrong', () => {
  it('tells a quota of zero apart from being asked to slow down', async () => {
    /*
     * Both are 429. One is fixed by waiting and the other never is, and telling
     * somebody to wait for a quota that is structurally zero is the worst advice
     * this screen can give.
     */
    serve({
      status: 429,
      json: {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message:
            'You exceeded your current quota. * Quota exceeded for metric: generate_content_free_tier_input_token_count, limit: 0, model: gemini-3.1-pro',
        },
      },
    });

    const message = errorOf(await collect())?.message ?? '';
    expect(message).toMatch(/waiting will not help/);
    expect(message).toMatch(/enable billing/);
    expect(message).toContain(MODEL);
  });

  it('says to wait when it really is a rate limit', async () => {
    serve({
      status: 429,
      json: { error: { status: 'RESOURCE_EXHAUSTED', message: 'Too many requests, limit: 60' } },
    });

    const message = errorOf(await collect())?.message ?? '';
    expect(message).toMatch(/Give it a minute/);
    expect(message).not.toMatch(/billing/);
  });

  it('says so plainly when the key is refused', async () => {
    serve({ status: 400, json: { error: { message: 'API key not valid. Please pass a valid API key.' } } });
    expect(errorOf(await collect())?.message).toMatch(/key this deployment is using was refused/);
  });

  it('names the model when there is no such model', async () => {
    serve({ status: 404, json: { error: { status: 'NOT_FOUND', message: 'models/x is not found' } } });

    const message = errorOf(await collect())?.message ?? '';
    expect(message).toContain(MODEL);
    expect(message).toContain('GEMINI_MODEL');
  });

  it('passes a rejected field through, because it names itself', async () => {
    serve({
      status: 400,
      json: { error: { status: 'INVALID_ARGUMENT', message: 'Unknown name "additionalProperties"' } },
    });

    expect(errorOf(await collect())?.message).toContain('additionalProperties');
  });

  it('reports a failure that arrives inside the stream', async () => {
    serve([says('half a '), { error: { message: 'internal', status: 'INTERNAL' } }]);

    const events = await collect();
    expect(textOf(events)).toBe('half a ');
    expect(errorOf(events)?.message).toMatch(/internal/);
  });

  it('says when the question itself was refused', async () => {
    serve([{ promptFeedback: { blockReason: 'SAFETY' } }]);
    expect(errorOf(await collect())?.message).toMatch(/refused by Google's safety filters/);
  });

  it('keeps what was written when an answer runs out of room', async () => {
    serve([says('The first part is fine'), ends('MAX_TOKENS')]);

    // Not an error. What was written is still worth reading, so the note is
    // appended to it rather than replacing it.
    const events = await collect();
    expect(errorOf(events)).toBeUndefined();
    expect(textOf(events)).toMatch(/The first part is fine/);
    expect(textOf(events)).toMatch(/reached its length limit/);
  });

  it('says nothing extra when an answer simply finished', async () => {
    serve([says('Done.'), ends('STOP')]);
    expect(textOf(await collect())).toBe('Done.');
  });

  it('reports a network failure as one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch failed');
      }),
    );

    expect(errorOf(await collect())?.message).toMatch(/could not reach Gemini/);
  });

  it('says it is not switched on when there is no key', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    serve([says('never asked')]);

    expect(errorOf(await collect())?.message).toMatch(/needs a Gemini key/);
  });

  it('always ends with exactly one terminal event', async () => {
    serve({ status: 500, json: {} });
    const events = await collect();

    expect(events.filter((e) => e.type === 'done' || e.type === 'error')).toHaveLength(1);
  });
});
