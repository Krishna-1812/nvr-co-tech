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
 * Ask a question and get the events back.
 *
 * A failure before the stream starts is a JSON body with a status, and it is
 * turned into an error event here so that the caller has exactly one shape to
 * handle. A component that had to deal with both a rejected promise and an
 * error event would deal with one of them badly.
 */
export async function* ask(
  turns: { role: 'user' | 'assistant'; content: string }[],
  agent: string | null,
  signal?: AbortSignal,
  /** The saved conversation to append to, or null to begin one. */
  conversationId?: string | null,
): AsyncGenerator<AssistEvent> {
  let response: Response;

  try {
    response = await fetch('/api/assist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ turns, agent, conversationId: conversationId ?? null }),
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
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    yield {
      type: 'error',
      message:
        typeof body?.error === 'string'
          ? body.error
          : 'The assistant is not available just now. Please try again.',
      note: 'error',
    };
    return;
  }

  yield* readEvents(response.body);
}
