/**
 * The shapes the assistant is built from.
 *
 * Kept free of anything server-only so the client components can import the same
 * types the route handler works in, which is what stops the wire format from
 * being described twice and then drifting.
 */

/** One turn. `sources` and `tools` are only ever set on an assistant turn. */
export type Turn = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** The documents the answer was grounded in. */
  sources?: Source[];
  /** Calculations done by the app's own code rather than by the model. */
  tools?: ToolTrace[];
  /**
   * Set when this turn did not come from the model: a refusal, a missing key, a
   * rate limit, an offline sample. The interface says so rather than passing it
   * off as an answer.
   */
  note?: TurnNote;
};

export type TurnNote = 'offline' | 'error';

/** A document the answer leaned on, as the interface shows it. */
export type Source = {
  id: string;
  title: string;
  /** Which tool it belongs to, if any. Used to colour the chip. */
  agent: string | null;
  /** Where to read more, when the site has a page for it. */
  href?: string;
};

/** One deterministic calculation, with what went in and what came back. */
export type ToolTrace = {
  name: string;
  label: string;
  args: Record<string, unknown>;
  /** Rendered result. A sentence, not JSON, because it is shown to a person. */
  summary: string;
  ok: boolean;
};

/** What the browser posts. */
export type AssistRequest = {
  /** The whole conversation so far, oldest first, including the new question. */
  turns: { role: 'user' | 'assistant'; content: string }[];
  /**
   * Which tool the reader is looking at, as a roster slug. Pins that agent's
   * documents to the top of the context, so "how does this work" means the thing
   * on screen rather than the first thing in the corpus.
   */
  agent?: string | null;
  /**
   * The conversation this question belongs to, once there is one. Null on the
   * first question: the server creates the conversation when it has an answer
   * to put in it, and sends the id back on the stream.
   */
  conversationId?: string | null;
};

// ─── The stream ──────────────────────────────────────────────────────────────

/**
 * What comes back, one JSON object per SSE `data:` line.
 *
 * A union rather than raw text, because three things have to arrive on the same
 * channel and in order: the answer as it is written, the calculations done
 * along the way, and the documents behind it. Sources are sent first so the
 * interface can show what it is reading from before the first word lands.
 */
export type AssistEvent =
  | { type: 'sources'; sources: Source[] }
  /**
   * This answer is not what it appears to be. Sent before the first word rather
   * than after the last, so the interface can label it while it is still
   * arriving: a sample answer that only admits to being one once it has finished
   * has already been read.
   */
  | { type: 'note'; note: TurnNote }
  | { type: 'tool'; trace: ToolTrace }
  | { type: 'delta'; text: string }
  /**
   * This exchange was kept, and here is what it was kept under. Sent after the
   * answer rather than before it, because that is when the writing happens: a
   * conversation is created once there is a question AND an answer to put in
   * it. The browser holds the id and sends it back with the next question.
   */
  | { type: 'conversation'; id: string; title: string }
  | { type: 'done' }
  | { type: 'error'; message: string; note?: TurnNote };
