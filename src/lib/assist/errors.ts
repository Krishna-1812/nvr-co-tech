import { MODEL } from './config';

/**
 * Turning a failure into a sentence somebody can act on.
 *
 * A chat window that says "something went wrong" is the least useful screen in
 * software, because the things that actually go wrong here have different
 * owners: a bad key, a model that does not exist, too many requests, or
 * Anthropic's own servers being down. Each gets its own sentence rather than
 * one shared shrug.
 *
 * These are read by customers, so: short sentences, ordinary words, no
 * em-dashes.
 */

/** The error envelope Anthropic returns. Only the fields worth branching on. */
type ApiError = {
  message?: unknown;
  type?: unknown;
};

function field(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * What to say about an HTTP failure from Anthropic.
 *
 * The body is passed in already parsed, or as null when it was not JSON, which
 * happens on a gateway error where the response is an HTML page. `retryAfter`
 * comes from the response header when Anthropic sent one, which it does for
 * every rate limit.
 */
export function describeApiFailure(status: number, body: unknown, retryAfter?: number | null): string {
  const error = ((body as { error?: ApiError } | null)?.error ?? {}) as ApiError;
  const type = field(error.type);
  const message = field(error.message);

  if (status === 429 || type === 'rate_limit_error') {
    return retryAfter
      ? `That is more questions than this deployment's Anthropic plan allows just now. Try again in about ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`
      : 'That is more questions than this deployment\'s Anthropic plan allows just now. Give it a minute and ask again.';
  }

  if (status === 401 || type === 'authentication_error') {
    return 'The Anthropic key this deployment is using was refused. It is either wrong or it has been revoked. Nobody can fix that from this screen.';
  }

  if (status === 403 || type === 'permission_error') {
    return 'The Anthropic key this deployment is using is not allowed to do this. Check what the key has access to.';
  }

  if (status === 404 || type === 'not_found_error') {
    return `There is no model called ${MODEL}. Set ANTHROPIC_MODEL to one that exists.`;
  }

  if (status === 413 || type === 'request_too_large_error') {
    return 'That conversation is too long for one request. Starting a new conversation usually clears this.';
  }

  if (status === 529 || type === 'overloaded_error') {
    return 'Anthropic\'s servers are overloaded right now. This usually clears in a minute, so it is worth asking again shortly.';
  }

  if (status >= 500 || type === 'api_error') {
    return 'Anthropic is having a problem at its end. This usually clears on its own, so it is worth asking again in a minute.';
  }

  if (message) {
    // The only case where the raw text is genuinely the most useful thing: a
    // rejected field names itself, and whoever is reading it is the person who
    // set it or wrote it.
    return `Anthropic refused the request: ${message}`;
  }

  return 'The assistant could not reach Anthropic just now. Please try again.';
}

/**
 * Why an answer stopped, when it was not simply finished.
 *
 * Returns null for a normal ending, and for the reasons the reader can do
 * nothing about and does not need to see. What comes back is appended to the
 * answer in italics rather than replacing it, because whatever was written
 * before it is still worth reading.
 */
export function describeStopReason(reason: string | null): string | null {
  switch (reason) {
    case 'max_tokens':
      return 'That answer was cut short because it reached its length limit. Ask for the rest and it will carry on.';
    case 'refusal':
      return 'That answer was declined by the model. Rewording the question usually gets past this.';
    default:
      // end_turn, stop_sequence, tool_use, null, and anything new Anthropic
      // adds. A stop reason nobody has seen before is not worth showing a
      // reader.
      return null;
  }
}

/** What to say when the request never got an answer at all. */
export function describeTransportFailure(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'That answer was taking too long, so it was stopped. A shorter question usually comes back quickly.';
  }
  if (error instanceof Error && /fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(error.message)) {
    return 'This server could not reach Anthropic. That is a connection problem here rather than anything you did.';
  }
  return 'Something went wrong while answering. Please try again.';
}

/** The assistant is not configured at all. Said once, plainly. */
export const NO_KEY =
  'The assistant is not switched on for this deployment. It needs an Anthropic key in ANTHROPIC_API_KEY.';
