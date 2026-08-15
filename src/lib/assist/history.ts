import type { Source, ToolTrace, Turn, TurnNote } from './types';

/**
 * Turning a conversation into something a list can show, and turning it back.
 *
 * Pure on purpose, and separate from the queries in ./store. What a saved
 * conversation is called and what comes back out of jsonb are both things that
 * can be got subtly wrong, and both are cheap to test when they are functions
 * over values rather than steps inside a database call.
 */

/**
 * The longest a title may be before it is cut.
 *
 * Short enough that two of them in a dropdown do not wrap, long enough that the
 * distinguishing part of a question survives. Most questions are shorter than
 * this and are kept whole.
 */
export const MAX_TITLE_CHARS = 72;

/**
 * A conversation as the history list and the dropdown show one.
 *
 * Here rather than beside the queries in ./store, because a client component
 * has to be able to name this type and ./store reaches for `next/headers` on
 * the first line. A type import would be erased, but the rule that keeps that
 * true is easy to break by accident and impossible to notice until the bundle.
 */
export type ConversationSummary = {
  id: string;
  title: string;
  agent: string | null;
  turnCount: number;
  updatedAt: string;
};

/** A conversation opened back up, ready to be carried on. */
export type SavedConversation = {
  id: string;
  title: string;
  agent: string | null;
  turns: Turn[];
};

/** Shown when a question has no words in it at all. Rare, but not impossible. */
export const UNTITLED = 'Untitled question';

/**
 * What is said when the history cannot be read at all.
 *
 * Nearly always one thing: migration 0009 has not been applied to this project
 * and the tables are not there. Worth naming, because it is something somebody
 * can go and fix, and because the assistant is unaffected either way.
 */
export const NO_HISTORY_TABLE =
  'History is not switched on for this project yet. Asking questions works either way.';

/**
 * What a conversation is called, from the question that started it.
 *
 * The first question rather than a summary, and no model is asked. A generated
 * title costs an API call, takes a second nobody is waiting for, and can
 * paraphrase the question into something the reader never typed — which is
 * exactly the wrong quality in a list they are scanning to find what they
 * asked. The words somebody chose are the best label there is.
 *
 * Markdown leaders are stripped because a question pasted out of a document
 * arrives as `> what is the TDS on this` and a chevron is not part of the
 * question. Cutting happens at a word boundary when there is one to be found
 * near the end, so a title never breaks mid-word.
 */
export function titleFor(question: string): string {
  const flat = question
    .replace(/\s+/g, ' ')
    // Leading markdown: quote chevrons, list bullets, heading hashes, and the
    // stray backticks that come with a pasted code span.
    .replace(/^[\s>#*\-–—•`]+/, '')
    .replace(/[`*_]+/g, '')
    .trim();

  if (!flat) return UNTITLED;
  if (flat.length <= MAX_TITLE_CHARS) return flat;

  const cut = flat.slice(0, MAX_TITLE_CHARS);
  const space = cut.lastIndexOf(' ');

  // Only honour the boundary if it is near the end. A question whose first
  // eighty characters are one unbroken string would otherwise be cut to almost
  // nothing in the name of tidiness.
  return `${(space > MAX_TITLE_CHARS * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * When a conversation was last touched, as a list shows it.
 *
 * Relative for the first day, absolute after that. A conversation from this
 * morning is looked for by "when", and one from March by "which day". A count
 * of days ago answers the first question and not the second.
 *
 * Elapsed time rather than wall clock, which is why nothing here needs a
 * timezone: the difference between two instants is the same number wherever it
 * is computed, so this renders identically on the server and in the browser.
 */
export function whenLabel(iso: string, now: number = Date.now()): string {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return '';

  const minutes = Math.floor((now - at) / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  if (hours < 48) return 'yesterday';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    // The year only once it is a different one, so a list of this month's
    // conversations is not four repetitions of 2026.
    ...(new Date(at).getFullYear() === new Date(now).getFullYear() ? {} : { year: 'numeric' }),
  }).format(at);
}

// ─── Reading rows back ───────────────────────────────────────────────────────

/**
 * One turn as the database holds it.
 *
 * `sources` and `tools` are jsonb, so they arrive as unknown however carefully
 * they were written. They are validated below rather than asserted: a row
 * written by an older deploy is an ordinary thing, and the failure should be a
 * missing chip rather than a component rendering undefined.
 */
export type StoredTurn = {
  id: number;
  role: string;
  content: string;
  sources: unknown;
  tools: unknown;
  note: unknown;
};

function asSources(value: unknown): Source[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const sources = value.filter((item): item is Source => {
    if (!item || typeof item !== 'object') return false;
    const { id, title } = item as { id?: unknown; title?: unknown };
    return typeof id === 'string' && typeof title === 'string';
  });

  return sources.length ? sources : undefined;
}

function asTools(value: unknown): ToolTrace[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const traces = value.filter((item): item is ToolTrace => {
    if (!item || typeof item !== 'object') return false;
    const { name, summary } = item as { name?: unknown; summary?: unknown };
    return typeof name === 'string' && typeof summary === 'string';
  });

  return traces.length ? traces : undefined;
}

function asNote(value: unknown): TurnNote | undefined {
  return value === 'offline' ? 'offline' : undefined;
}

/**
 * A stored conversation, as the interface renders one.
 *
 * Rows with an unusable role are dropped rather than coerced. There should
 * never be one — the column has a check constraint — but a turn of unknown
 * origin rendered as an answer is a worse outcome than a turn that is missing.
 */
export function turnsFromRows(rows: StoredTurn[]): Turn[] {
  const turns: Turn[] = [];

  for (const row of rows) {
    if (row.role !== 'user' && row.role !== 'assistant') continue;

    turns.push({
      // Stable and unique within the conversation, which is all the list keys
      // and the entrance animation need.
      id: `s${row.id}`,
      role: row.role,
      content: typeof row.content === 'string' ? row.content : '',
      sources: asSources(row.sources),
      tools: asTools(row.tools),
      note: asNote(row.note),
    });
  }

  return turns;
}
