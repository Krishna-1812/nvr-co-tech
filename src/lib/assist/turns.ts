/**
 * Reading a conversation out of a request body, or saying why it cannot be.
 *
 * Shared by both chat routes, which differ only in how much they will take.
 * The browser is the only thing that posts to either, which is exactly why this
 * is thorough: the reason to validate is not that a user might send something
 * strange, it is that a bug in the composer should fail here with a sentence
 * rather than three seconds later inside a model request that has already been
 * paid for.
 */

export type PostedTurn = { role: 'user' | 'assistant'; content: string };

export type TurnLimits = {
  /** The longest the newest question may be. */
  maxQuestionChars: number;
  /** The most turns a body may carry before it is refused rather than parsed. */
  maxPostedTurns: number;
};

export function readTurns(raw: unknown, limits: TurnLimits): { turns: PostedTurn[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'No question was sent.' };
  }
  if (raw.length > limits.maxPostedTurns) {
    return { error: 'That conversation is too long to carry on. Start a new one.' };
  }

  const turns: PostedTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return { error: 'That conversation could not be read.' };
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') {
      return { error: 'That conversation could not be read.' };
    }
    if (typeof content !== 'string') return { error: 'That conversation could not be read.' };
    turns.push({ role, content });
  }

  const last = turns[turns.length - 1];
  if (last.role !== 'user' || !last.content.trim()) {
    return { error: 'No question was sent.' };
  }
  if (last.content.length > limits.maxQuestionChars) {
    return {
      error: `That question is too long. The limit is ${limits.maxQuestionChars.toLocaleString('en-IN')} characters.`,
    };
  }

  return { turns };
}
