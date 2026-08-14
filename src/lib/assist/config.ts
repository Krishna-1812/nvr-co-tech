/**
 * What the assistant is allowed to be, in one file.
 *
 * Everything here is read from the environment with a literal fallback, so a
 * deployment can move to a different model or tighten a limit without a code
 * change. The key itself is deliberately NOT exported as a constant: it is read
 * on each call, inside server-only code, so it cannot be captured into a module
 * that something client-side later imports for one of the other values.
 */

/** The model. Overridable per deployment without a code change. */
export const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';

/** Where the API lives. Overridable for a proxy or a gateway. */
export const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1';

/**
 * The key, read at call time.
 *
 * Returns null rather than throwing so the route can answer with a sentence a
 * person can act on instead of a stack trace, and so the rest of the app builds
 * and runs perfectly well without one.
 */
export function apiKey(): string | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key ? key : null;
}

// ─── Limits ──────────────────────────────────────────────────────────────────

/**
 * The longest single question. Roughly two thousand words, which is more than
 * anybody types and enough for somebody pasting in a ledger extract to ask
 * about.
 */
export const MAX_QUESTION_CHARS = 8_000;

/**
 * How much of the conversation is carried forward.
 *
 * Turns, not tokens: a token budget would need a tokeniser for a model whose
 * tokeniser is not published, and the failure mode of guessing that wrong is a
 * request rejected at the far end. Twelve turns is about twenty minutes of
 * conversation, and anything older is nearly always a different question.
 */
export const MAX_HISTORY_TURNS = 12;

/** Total characters of history sent, oldest dropped first. Belt to the braces above. */
export const MAX_HISTORY_CHARS = 24_000;

/** The ceiling on one answer. `max_tokens` is a required field, not a courtesy. */
export const MAX_OUTPUT_TOKENS = 8_000;

/**
 * How many rounds of "call a tool, look at the result, carry on" are allowed.
 *
 * Four is enough for the deepest genuine case here, which is checking a GSTIN,
 * working out the tax split, computing the voucher total and then the financial
 * year it falls in. A model that wants a fifth is looping, and the loop is
 * stopped rather than billed for.
 */
export const MAX_TOOL_ROUNDS = 4;

/**
 * Requests per user per window, and the window.
 *
 * This is a cost control, not a security control. It is enforced in the memory
 * of one server instance, so on a platform that runs several the real ceiling is
 * this multiplied by however many are warm. That is fine for what it is for:
 * stopping one open tab with a stuck retry from spending the month's quota. A
 * limit that had to hold exactly would need to live in the database.
 */
export const RATE_LIMIT = 30;
export const RATE_WINDOW_MS = 5 * 60 * 1000;

/** How long a single answer may take before the request is abandoned. */
export const REQUEST_TIMEOUT_MS = 90_000;
