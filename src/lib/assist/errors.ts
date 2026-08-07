import { MODEL } from './config';

/**
 * Turning a failure into a sentence somebody can act on.
 *
 * A chat window that says "something went wrong" is the least useful screen in
 * software, because the things that actually go wrong here have different
 * owners. The one worth the most care is the quota case, because Gemini uses a
 * single status code for two situations that could not be more different: "you
 * are asking too fast, wait a moment" and "your key has no access to this model
 * at all, and waiting will never help". Both arrive as 429. Telling them apart
 * is the difference between a reader waiting patiently forever and a reader
 * turning billing on.
 *
 * These are read by customers, so: short sentences, ordinary words, no
 * em-dashes.
 */

/** The error envelope Gemini returns. Only the fields worth branching on. */
type ApiError = {
  message?: unknown;
  status?: unknown;
  code?: unknown;
};

function field(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * A quota of exactly zero is not a rate limit.
 *
 * Google reports "no access to this model on this plan" as a 429 whose message
 * happens to contain `limit: 0`. Every Pro model does this on a key without
 * billing enabled. Read as an ordinary rate limit it produces the worst possible
 * advice, which is to try again in a minute, forever.
 */
function isPlanLimit(message: string): boolean {
  return /limit:\s*0\b/.test(message);
}

/**
 * What to say about an HTTP failure from Gemini.
 *
 * The body is passed in already parsed, or as null when it was not JSON, which
 * happens on a gateway error where the response is an HTML page.
 */
export function describeApiFailure(status: number, body: unknown): string {
  const error = ((body as { error?: ApiError } | null)?.error ?? {}) as ApiError;
  const state = field(error.status);
  const message = field(error.message);

  if (status === 429 && isPlanLimit(message)) {
    return `The key this deployment uses has no quota for ${MODEL}, so waiting will not help. Either enable billing on the Google Cloud project behind the key, or set GEMINI_MODEL to a model the free tier covers. The Flash models are free; the Pro ones are not.`;
  }

  if (status === 429 || state === 'RESOURCE_EXHAUSTED') {
    /*
     * Google says how long to wait, and it is worth passing on rather than
     * rounding to "a minute": the free tier allows twenty requests a minute, and
     * one question can be several requests because each round of calculations is
     * one. So this fires more often than you would expect, and "about twenty
     * seconds" is a thing somebody will actually wait for.
     */
    const wait = /retry in ([\d.]+)s/i.exec(message);
    const seconds = wait ? Math.ceil(Number(wait[1])) : null;

    return seconds
      ? `That is more questions than this deployment's Gemini plan allows just now. Try again in about ${seconds} second${seconds === 1 ? '' : 's'}.`
      : 'Google is taking too many questions from this deployment at once. Give it a minute and ask again.';
  }

  if (status === 401 || state === 'UNAUTHENTICATED' || /API key not valid|API_KEY_INVALID/i.test(message)) {
    return 'The Gemini key this deployment is using was refused. It is either wrong or it has been revoked. Nobody can fix that from this screen.';
  }

  if (status === 404 || state === 'NOT_FOUND') {
    return `There is no model called ${MODEL}. Set GEMINI_MODEL to one that exists.`;
  }

  if (status === 403 || state === 'PERMISSION_DENIED') {
    return 'The Gemini key this deployment is using is not allowed to do this. Check what the key has access to.';
  }

  if (status >= 500 || state === 'UNAVAILABLE') {
    return 'Gemini is having a problem at its end. This usually clears on its own, so it is worth asking again in a minute.';
  }

  if (message) {
    // The only case where the raw text is genuinely the most useful thing: a
    // rejected field names itself, and whoever is reading it is the person who
    // set it or wrote it.
    return `Gemini refused the request: ${message}`;
  }

  return 'The assistant could not reach Gemini just now. Please try again.';
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
    case 'MAX_TOKENS':
      return 'That answer was cut short because it reached its length limit. Ask for the rest and it will carry on.';
    case 'SAFETY':
    case 'PROHIBITED_CONTENT':
    case 'BLOCKLIST':
      return "That answer was stopped by Google's safety filters. Rewording the question usually gets past this.";
    case 'RECITATION':
      return 'That answer was stopped because it was reproducing a source too closely. Asking for it in your own terms usually works.';
    case 'MALFORMED_FUNCTION_CALL':
      return 'The model asked for a calculation in a way this app could not read, so the answer stops here.';
    default:
      // STOP, null, and anything new Google adds. A stop reason nobody has seen
      // before is not worth showing a reader.
      return null;
  }
}

/** What to say when the request never got an answer at all. */
export function describeTransportFailure(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'That answer was taking too long, so it was stopped. A shorter question usually comes back quickly.';
  }
  if (error instanceof Error && /fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(error.message)) {
    return 'This server could not reach Gemini. That is a connection problem here rather than anything you did.';
  }
  return 'Something went wrong while answering. Please try again.';
}

/** The assistant is not configured at all. Said once, plainly. */
export const NO_KEY =
  'The assistant is not switched on for this deployment. It needs a Gemini key in GEMINI_API_KEY.';
