import { createSseParser, parsePayloads } from './sse';
import type { AssistEvent } from './types';

/**
 * The browser end of the stream.
 *
 * The same parser the server uses to read Anthropic is used here to read the
 * server, which is the point of having written it as a function over strings
 * rather than as part of either. One implementation, one set of tests, and the
 * chunk-boundary bug can only exist in one place.
 *
 * Everything arriving here is validated before it is used. It came from our own
 * route, so it should be well formed, but "should be" is not a type: a deploy
 * where the route is newer than the page is an ordinary thing, and the failure
 * should be a dropped event rather than a component rendering undefined.
 */

function isEvent(value: unknown): value is AssistEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as { type?: unknown };

  switch (event.type) {
    case 'delta':
      return typeof (value as { text?: unknown }).text === 'string';
    case 'sources':
      return Array.isArray((value as { sources?: unknown }).sources);
    case 'note':
      return (value as { note?: unknown }).note === 'offline';
    case 'conversation':
      return (
        typeof (value as { id?: unknown }).id === 'string' &&
        typeof (value as { title?: unknown }).title === 'string'
      );
    case 'tool':
      return Boolean((value as { trace?: unknown }).trace);
    case 'error':
      return typeof (value as { message?: unknown }).message === 'string';
    case 'done':
      return true;
    default:
      return false;
  }
}

/** Read a response body to completion, yielding each event in order. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AssistEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      const payloads = done ? parser.flush() : parser.push(decoder.decode(value, { stream: true }));

      for (const parsed of parsePayloads(payloads)) {
        if (isEvent(parsed)) yield parsed;
      }

      if (done) return;
    }
  } finally {
    // Navigating away mid-answer must not leave the connection open.
    reader.cancel().catch(() => {});
  }
}

/**
 * What the server files alongside a question for the Admin screen
 * (lib/analytics/chat): which chat it belongs to, the visit, the page and how
 * it was asked. The answer itself is recorded from the stream, not from here.
 */
export type AskMeta = { conversation?: string | null; via?: string | null };

function meta(m: AskMeta = {}) {
  let sid: string | null = null;
  try {
    sid = sessionStorage.getItem('fi_sid');
  } catch {
    // No session storage: the question is still filed, without its visit.
  }
  return { conversation: m.conversation ?? null, via: m.via ?? null, sid, path: typeof location === 'undefined' ? null : location.pathname };
}

/** Ask the signed-in assistant a question and get the events back. */
export async function* ask(
  turns: { role: 'user' | 'assistant'; content: string }[],
  agent: string | null,
  signal?: AbortSignal,
  /** The saved conversation to append to, or null to begin one. */
  conversationId?: string | null,
  about?: AskMeta,
): AsyncGenerator<AssistEvent> {
  yield* post('/api/assist', { turns, agent, conversationId: conversationId ?? null, meta: meta(about) }, signal);
}

/** Ask the chat anybody can use (app/api/chat), from the page the reader is on. */
export async function* askSite(
  turns: { role: 'user' | 'assistant'; content: string }[],
  page: string,
  signal?: AbortSignal,
  about?: AskMeta,
): AsyncGenerator<AssistEvent> {
  yield* post('/api/chat', { turns, page, meta: meta(about) }, signal);
}

/**
 * One question, posted, with the events back.
 *
 * A failure before the stream starts is a JSON body with a status, and it is
 * turned into an error event here so that the caller has exactly one shape to
 * handle. A component that had to deal with both a rejected promise and an
 * error event would deal with one of them badly.
 */
async function* post(url: string, body: unknown, signal?: AbortSignal): AsyncGenerator<AssistEvent> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // An abort is the reader pressing stop, and there is nothing to report.
    if (error instanceof DOMException && error.name === 'AbortError') return;
    yield {
      type: 'error',
      message: 'Could not reach the assistant. Check your connection and try again.',
      note: 'error',
    };
    return;
  }

  if (!response.ok || !response.body) {
    const failure = (await response.json().catch(() => null)) as { error?: unknown } | null;
    yield {
      type: 'error',
      message:
        typeof failure?.error === 'string'
          ? failure.error
          : 'The assistant is not available just now. Please try again.',
      note: 'error',
    };
    return;
  }

  yield* readEvents(response.body);
}
