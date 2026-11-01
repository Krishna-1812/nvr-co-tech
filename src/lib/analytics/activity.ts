import type { AdminAccountRow, SiteChatRow, SiteEventRow, SiteToolDataRow, SiteVisitorRow } from '@/lib/supabase/types';

/**
 * Everything a person did besides opening pages, for the Admin screen: the
 * questions they put to the chat (with the answers), the fields they filled,
 * the buttons they pressed and the work they did in an open tool.
 *
 * Filed under the same person as their page views (lib/analytics/report): an
 * account when the browser has ever signed in, the browser's ID otherwise. A
 * browser that signs in later brings everything before it along, because the
 * key is worked out from the browser's row, which the sign-in stamps
 * (migrations 0033 and 0039).
 *
 * Pure and synchronous, like the report, so it is tested on its own.
 */

export type ChatTurn = {
  id: string;
  at: string;
  mode: SiteChatRow['mode'];
  question: string;
  answer: string | null;
  outcome: SiteChatRow['outcome'];
  error: string | null;
  via: string | null;
  path: string | null;
  model: string | null;
  firstMs: number | null;
  totalMs: number | null;
  sources: SiteChatRow['sources'];
  tools: SiteChatRow['tools'];
};

export type Who = { key: string; kind: 'account' | 'visitor'; name: string | null; email: string | null; tag: string; avatar: string | null };

/** One chat, start to finish: the questions in it, oldest first. */
export type Thread = {
  key: string;
  who: Who;
  mode: SiteChatRow['mode'];
  startedAt: string;
  lastAt: string;
  /** The page the first question was asked on. */
  path: string | null;
  turns: ChatTurn[];
  /** Questions that did not get an answer: failed, refused, limited or unavailable. */
  unanswered: number;
};

export type ToolWork = { tool: SiteToolDataRow['tool']; first: string; last: string; saves: number; sealed: boolean };

/** One thing a person did, for their timeline. Page views come from the report. */
export type Moment =
  | { t: 'chat'; at: string; thread: string; question: string; outcome: SiteChatRow['outcome']; path: string | null }
  | { t: 'field'; at: string; path: string; label: string | null; value: string | null }
  | { t: 'click'; at: string; path: string; label: string | null; value: string | null }
  | { t: 'tool'; at: string; tool: SiteToolDataRow['tool']; saves: number; sealed: boolean; first: boolean };

export type PersonActivity = { questions: number; fields: number; clicks: number; threads: string[]; tools: ToolWork[]; moments: Moment[] };

export type Activity = { threads: Thread[]; byPerson: Record<string, PersonActivity>; totals: { questions: number; threads: number; unanswered: number; askers: number } };

const UNANSWERED = new Set<SiteChatRow['outcome']>(['error', 'refused', 'limited', 'unavailable']);

export const TOOL_NAMES: Record<SiteToolDataRow['tool'], string> = {
  'wealth-tracker': 'Wealth Tracker',
  'true-property-cost': 'True Property Cost',
};

export function buildActivity({
  visitors,
  accounts,
  chats,
  events,
  tools,
}: {
  visitors: SiteVisitorRow[];
  accounts: AdminAccountRow[];
  chats: SiteChatRow[];
  events: SiteEventRow[];
  tools: SiteToolDataRow[];
}): Activity {
  const visitorById = new Map(visitors.map((v) => [v.id, v]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // The same rule as the report: the account, when the row or its browser has one.
  const keyOf = (visitorId: string | null, userId: string | null): string | null => {
    const uid = userId ?? (visitorId ? visitorById.get(visitorId)?.user_id : null) ?? null;
    if (uid) return `u:${uid}`;
    return visitorId ? `v:${visitorId}` : null;
  };

  const whoOf = (key: string, visitorId: string | null): Who => {
    const uid = key.startsWith('u:') ? key.slice(2) : null;
    const account = uid ? accountById.get(uid) : undefined;
    const visitor = visitorId ? visitorById.get(visitorId) : undefined;
    return {
      key,
      kind: uid ? 'account' : 'visitor',
      name: account?.full_name ?? null,
      email: account?.email ?? visitor?.email ?? null,
      tag: key.slice(2, 8).toUpperCase(),
      avatar: account?.avatar_url ?? null,
    };
  };

  const byPerson: Record<string, PersonActivity> = {};
  const of = (key: string) => (byPerson[key] ??= { questions: 0, fields: 0, clicks: 0, threads: [], tools: [], moments: [] });

  // ── Chats, into threads ──
  const threads = new Map<string, Thread>();
  for (const c of [...chats].sort((a, b) => a.at.localeCompare(b.at))) {
    const key = keyOf(c.visitor_id, c.user_id);
    if (!key) continue;
    const id = `${key}|${c.conversation ?? c.id}`;
    let th = threads.get(id);
    if (!th) {
      th = { key: id, who: whoOf(key, c.visitor_id), mode: c.mode, startedAt: c.at, lastAt: c.at, path: c.path, turns: [], unanswered: 0 };
      threads.set(id, th);
      of(key).threads.push(id);
    }
    th.lastAt = c.at;
    if (UNANSWERED.has(c.outcome)) th.unanswered += 1;
    th.turns.push({
      id: c.id,
      at: c.at,
      mode: c.mode,
      question: c.question,
      answer: c.answer,
      outcome: c.outcome,
      error: c.error,
      via: c.via,
      path: c.path,
      model: c.model,
      firstMs: c.first_ms,
      totalMs: c.total_ms,
      sources: Array.isArray(c.sources) ? c.sources : [],
      tools: Array.isArray(c.tools) ? c.tools : [],
    });
    const p = of(key);
    p.questions += 1;
    p.moments.push({ t: 'chat', at: c.at, thread: id, question: c.question, outcome: c.outcome, path: c.path });
  }

  // ── Fields and clicks ──
  for (const e of events) {
    const key = keyOf(e.visitor_id, e.user_id);
    if (!key) continue;
    const p = of(key);
    if (e.kind === 'field') p.fields += 1;
    else p.clicks += 1;
    p.moments.push({ t: e.kind, at: e.at, path: e.path, label: e.label, value: e.value });
  }

  // ── Work in the open tools: one row per browser per tool, added up per person ──
  for (const d of tools) {
    const key = keyOf(d.visitor_id, d.user_id);
    if (!key) continue;
    const p = of(key);
    const had = p.tools.find((w) => w.tool === d.tool);
    if (had) {
      had.saves += d.saves;
      had.sealed ||= d.sealed;
      if (d.first_at < had.first) had.first = d.first_at;
      if (d.updated_at > had.last) had.last = d.updated_at;
    } else p.tools.push({ tool: d.tool, first: d.first_at, last: d.updated_at, saves: d.saves, sealed: d.sealed });
    p.moments.push({ t: 'tool', at: d.first_at, tool: d.tool, saves: d.saves, sealed: d.sealed, first: true });
    if (d.updated_at !== d.first_at) p.moments.push({ t: 'tool', at: d.updated_at, tool: d.tool, saves: d.saves, sealed: d.sealed, first: false });
  }

  for (const p of Object.values(byPerson)) p.moments.sort((a, b) => b.at.localeCompare(a.at));

  const list = [...threads.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return {
    threads: list,
    byPerson,
    totals: {
      questions: chats.length,
      threads: list.length,
      unanswered: list.reduce((n, t) => n + t.unanswered, 0),
      askers: new Set(list.map((t) => t.who.key)).size,
    },
  };
}

/** How a question came to be asked, in words. */
export function viaLabel(via: string | null): string {
  switch (via) {
    case 'typed':
      return 'Typed';
    case 'suggestion':
      return 'Suggested question';
    case 'retry':
      return 'Asked again';
    case 'greeting':
      return 'Typed in the greeting';
    case 'greeting-pick':
      return 'Greeting pick';
    case 'ask-button':
      return 'Ask button';
    case 'link':
      return 'From a link on the page';
    default:
      return 'Asked';
  }
}

export const OUTCOME_LABEL: Record<SiteChatRow['outcome'], string> = {
  answered: 'Answered',
  stopped: 'Stopped by the reader',
  error: 'Failed',
  offline: 'Sample answer',
  refused: 'Refused',
  limited: 'Too many questions',
  unavailable: 'Assistant unavailable',
};
