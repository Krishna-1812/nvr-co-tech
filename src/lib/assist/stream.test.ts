import { afterEach, describe, expect, it, vi } from 'vitest';
import { ask, readEvents } from './stream';
import type { AssistEvent } from './types';

/**
 * The browser end.
 *
 * Two things are worth testing here and neither is the happy path, which the SSE
 * parser's own tests already cover. The first is that a malformed event is
 * dropped rather than rendered, because this is the boundary where a deploy
 * whose route is newer than its page shows up. The second is that a failure
 * before the stream even starts comes back as an error event like everything
 * else, so the component has exactly one shape to deal with.
 */

function bodyOf(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 5) controller.enqueue(bytes.slice(i, i + 5));
      controller.close();
    },
  });
}

const frames = (...events: unknown[]) =>
  events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');

async function drain(stream: AsyncGenerator<AssistEvent>) {
  const out: AssistEvent[] = [];
  for await (const event of stream) out.push(event);
  return out;
}

afterEach(() => vi.unstubAllGlobals());

describe('reading events off the wire', () => {
  it('reads a whole answer', async () => {
    const events = await drain(
      readEvents(
        bodyOf(
          frames(
            { type: 'sources', sources: [{ id: 'a', title: 'A', agent: null }] },
            { type: 'delta', text: 'hello ' },
            { type: 'delta', text: 'there' },
            { type: 'done' },
          ),
        ),
      ),
    );

    expect(events.map((e) => e.type)).toEqual(['sources', 'delta', 'delta', 'done']);
  });

  it('drops an event of a kind it does not know', async () => {
    const events = await drain(
      readEvents(bodyOf(frames({ type: 'telemetry', v: 1 }, { type: 'done' }))),
    );
    expect(events.map((e) => e.type)).toEqual(['done']);
  });

  it('drops an event of a known kind with the wrong shape', async () => {
    // A delta whose text is a number would render as undefined rather than fail.
    const events = await drain(
      readEvents(bodyOf(frames({ type: 'delta', text: 42 }, { type: 'delta', text: 'ok' }))),
    );

    expect(events).toEqual([{ type: 'delta', text: 'ok' }]);
  });

  it('reads where the exchange was filed, and drops one with no id', async () => {
    const events = await drain(
      readEvents(
        bodyOf(
          frames(
            { type: 'conversation', title: 'no id here' },
            { type: 'conversation', id: 'c1', title: 'What is the TDS' },
          ),
        ),
      ),
    );

    expect(events).toEqual([{ type: 'conversation', id: 'c1', title: 'What is the TDS' }]);
  });

  it('drops a frame that is not JSON without losing the rest', async () => {
    const events = await drain(
      readEvents(bodyOf(`data: {"type":"delta","text":"a"}\n\ndata: broken\n\ndata: {"type":"done"}\n\n`)),
    );

    expect(events.map((e) => e.type)).toEqual(['delta', 'done']);
  });
});

describe('asking', () => {
  it('posts the conversation and the tool on screen', async () => {
    const fetchMock = vi.fn(
      async () => new Response(bodyOf(frames({ type: 'done' })), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await drain(ask([{ role: 'user', content: 'hi' }], 'voucher-desk'));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/assist');
    expect(JSON.parse(String(init.body))).toEqual({
      turns: [{ role: 'user', content: 'hi' }],
      agent: 'voucher-desk',
      // Null rather than absent on a first question: the server decides where
      // the exchange is filed, and it is told plainly that there is nowhere yet.
      conversationId: null,
    });
  });

  it('posts the saved conversation back when there is one to carry on', async () => {
    const fetchMock = vi.fn(
      async () => new Response(bodyOf(frames({ type: 'done' })), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await drain(ask([{ role: 'user', content: 'and TDS?' }], null, undefined, 'abc-123'));

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).conversationId).toBe('abc-123');
  });

  it('turns a refusal before the stream into an error event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'You are not signed in.' }), { status: 401 }),
      ),
    );

    expect(await drain(ask([{ role: 'user', content: 'hi' }], null))).toEqual([
      { type: 'error', message: 'You are not signed in.', note: 'error' },
    ]);
  });

  it('has something to say when the failure body is not readable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>gateway</html>', { status: 502 })),
    );

    const [event] = await drain(ask([{ role: 'user', content: 'hi' }], null));
    expect(event).toMatchObject({ type: 'error' });
  });

  it('reports being unable to reach the server at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const [event] = await drain(ask([{ role: 'user', content: 'hi' }], null));
    expect(event).toMatchObject({ type: 'error', message: expect.stringMatching(/connection/) });
  });

  it('says nothing at all when the reader pressed stop', async () => {
    // An abort is not a failure, and an error bubble for one would be noise.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }),
    );

    expect(await drain(ask([{ role: 'user', content: 'hi' }], null))).toEqual([]);
  });
});
