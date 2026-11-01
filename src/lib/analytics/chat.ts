import type { AssistEvent, Source, ToolTrace } from '@/lib/assist/types';
import { neverCaptured } from './private-paths';
import { isBot } from './ua';

/**
 * One question to the chat, and its answer, as the Admin screen keeps it
 * (migration 0039, `site_chats`).
 *
 * The record is made on the server, from the stream the reader was sent, so
 * what is kept is byte for byte what they read: the browser only says which
 * chat the question belongs to, the session, the page and how it was asked.
 *
 * Pure, so the rules are tested without a request; the database call is
 * chat-server.ts.
 */

/** How the question came to be asked. Anything else is stored as unknown. */
export const VIAS = ['typed', 'suggestion', 'retry', 'greeting', 'greeting-pick', 'ask-button', 'link'] as const;
export type Via = (typeof VIAS)[number];

export type ChatOutcome = 'answered' | 'stopped' | 'error' | 'offline' | 'refused' | 'limited' | 'unavailable';

/** What the browser says about the question, alongside the turns. */
export type ChatMeta = { conversation: string | null; sid: string | null; via: Via | null; path: string | null };

const text = (v: unknown, n: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, n);
  return t || null;
};

export function readChatMeta(raw: unknown, page?: unknown): ChatMeta {
  const m = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const via = typeof m.via === 'string' && (VIAS as readonly string[]).includes(m.via) ? (m.via as Via) : null;
  const conversation = text(m.conversation, 80);
  return {
    // The browser's own id for one chat: a short token, nothing else.
    conversation: conversation && /^[\w-]+$/.test(conversation) ? conversation : null,
    sid: text(m.sid, 64),
    via,
    path: text(m.path, 500) ?? text(page, 500),
  };
}

/**
 * Whether this request may be recorded at all: never for a crawler, never from
 * a browser that has asked not to be tracked (the same rule as the page
 * tracker), and never from a page the capture never reads (a will).
 */
export function mayRecord(headers: Headers, path: string | null): boolean {
  if (isBot(headers.get('user-agent'))) return false;
  if (headers.get('dnt') === '1' || headers.get('sec-gpc') === '1') return false;
  if (path && neverCaptured(path)) return false;
  return true;
}

/**
 * Watches an answer go by and keeps what the record needs: the words, the
 * pages behind them, the sums, how it ended and how long it took.
 */
export function tally(start = Date.now()) {
  let answer = '';
  let sources: Source[] = [];
  const tools: ToolTrace[] = [];
  let offline = false;
  let error: string | null = null;
  let done = false;
  let first: number | null = null;

  return {
    see(event: AssistEvent, now = Date.now()) {
      if (event.type === 'delta') {
        if (first === null && event.text.trim()) first = now - start;
        answer += event.text;
      } else if (event.type === 'sources') sources = event.sources;
      else if (event.type === 'tool') tools.push(event.trace);
      else if (event.type === 'note' && event.note === 'offline') offline = true;
      else if (event.type === 'error') error = event.message;
      else if (event.type === 'done') done = true;
    },
    /** `aborted`: the reader stopped it or went away before it finished. */
    result(aborted: boolean, now = Date.now()) {
      const outcome: ChatOutcome = aborted && !done ? 'stopped' : error ? 'error' : offline ? 'offline' : 'answered';
      return {
        answer,
        sources: sources.map((s) => ({ id: s.id, title: s.title, ...(s.href ? { href: s.href } : {}) })),
        tools: tools.map((t) => ({ label: t.label, summary: t.summary, ok: t.ok, args: t.args })),
        outcome,
        error: outcome === 'stopped' ? null : error,
        first_ms: first,
        total_ms: now - start,
      };
    },
  };
}

/** The row, as track_chat() takes it. */
export function chatPayload(input: {
  id: string;
  vid: string | null;
  mode: 'visitor' | 'member';
  meta: ChatMeta;
  question: string;
  model: string | null;
  answer?: string;
  sources?: unknown[];
  tools?: unknown[];
  outcome: ChatOutcome;
  error?: string | null;
  first_ms?: number | null;
  total_ms?: number | null;
}): Record<string, unknown> {
  return {
    id: input.id,
    vid: input.vid,
    sid: input.meta.sid,
    conversation: input.meta.conversation,
    mode: input.mode,
    path: input.meta.path,
    via: input.meta.via,
    question: input.question.slice(0, 4000),
    answer: (input.answer ?? '').slice(0, 40000) || null,
    sources: input.sources ?? [],
    tools: input.tools ?? [],
    outcome: input.outcome,
    error: input.error ?? null,
    model: input.model,
    first_ms: input.first_ms ?? null,
    total_ms: input.total_ms ?? null,
  };
}
