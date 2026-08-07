import { MODEL } from './config';

/**
 * Turning a failure into a sentence somebody can act on.
 *
 * A chat window that says "something went wrong" is the least useful screen in
 * software, because the four things that actually go wrong here have four
 * completely different owners. A refused key and an exhausted balance both
 * arrive as a colour of red the reader cannot distinguish, and only one of them
 * is fixed by waiting. So each one is named, and the message says who can do
 * something about it.
 *
 * These are read by customers, so: short sentences, ordinary words, no
 * em-dashes.
 */

/** The error envelope the API returns. Only the fields worth branching on. */
type ApiError = {
  message?: unknown;
  type?: unknown;
  code?: unknown;
};

function field(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * What to say about an HTTP failure from OpenAI.
 *
 * The body is passed in already parsed, or as null when it was not JSON, which
 * happens on a gateway error where the response is an HTML page.
 */
export function describeApiFailure(status: number, body: unknown): string {
  const error = ((body as { error?: ApiError } | null)?.error ?? {}) as ApiError;
  const code = field(error.code);
  const type = field(error.type);
  const message = field(error.message);

  if (code === 'credit_balance_exhausted' || type === 'insufficient_quota') {
    return 'The OpenAI account behind this assistant has no credits left, so it cannot answer. Everything else on this platform is unaffected. Adding credits to the account switches it back on.';
  }

  if (status === 401 || code === 'invalid_api_key') {
    return 'The OpenAI key this deployment is using was refused. It is either wrong, or it has been revoked. Nobody can fix that from this screen.';
  }

  /*
   * Before the general 403 below, not after it. "You do not have access to
   * model x" arrives as a 403, and it is a much more specific problem than the
   * key being unauthorised: the key is fine and one variable is wrong.
   */
  if (code === 'model_not_found' || /does not exist|do not have access/i.test(message)) {
    return `The model this deployment asks for, ${MODEL}, is not available to its OpenAI key. Set OPENAI_MODEL to one the key can reach.`;
  }

  if (status === 403) {
    return 'The OpenAI key this deployment is using is not allowed to do this. Check what the key has access to.';
  }

  if (status === 429) {
    return 'Too many questions are being asked of OpenAI at once. Give it a moment and ask again.';
  }

  if (status >= 500) {
    return 'OpenAI is having a problem at its end. This usually clears on its own, so it is worth asking again in a minute.';
  }

  if (status === 400 && message) {
    // The only case where the raw text is genuinely the most useful thing: a
    // rejected parameter names itself, and whoever is reading it is the person
    // who set it.
    return `OpenAI refused the request: ${message}`;
  }

  return 'The assistant could not reach OpenAI just now. Please try again.';
}

/** What to say when the request never got an answer at all. */
export function describeTransportFailure(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'That answer was taking too long, so it was stopped. A shorter question usually comes back quickly.';
  }
  if (error instanceof Error && /fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(error.message)) {
    return 'This server could not reach OpenAI. That is a connection problem here rather than anything you did.';
  }
  return 'Something went wrong while answering. Please try again.';
}

/** The assistant is not configured at all. Said once, plainly. */
export const NO_KEY =
  'The assistant is not switched on for this deployment. It needs an OpenAI key in OPENAI_API_KEY.';
