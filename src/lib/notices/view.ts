import type { ItdAccountRow, ItdAlertRow, ItdDocumentRow, ItdProceedingRow, ItdRunRow } from '@/lib/supabase/types';

/**
 * Tax Notice Watch's screen, worked out from the tables the morning check writes
 * (migration 0037, workers/itd-notices).
 *
 * Kept apart from the page so the arithmetic that decides what a person is
 * told to look at (what counts as new, what is due, which accounts were not
 * checked) is tested on its own (view.test.ts), the way the Admin screen's
 * figures are (lib/analytics/report).
 */

export type NoticeDoc = { id: number; name: string; path: string };

export type NoticeItem = {
  key: string;
  pan: string;
  client: string;
  name: string;
  ay: string | null;
  fy: string | null;
  tab: 'action' | 'information' | null;
  noticeCount: number | null;
  latest: { date: string; status: string | null } | null;
  due: string | null;
  /** Days from today to `due`; negative once it has passed. */
  dueIn: number | null;
  /** The newest alert on it in the last fortnight, if any. */
  fresh: { detail: string; at: string } | null;
  markedNew: boolean;
  handled: { at: string; by: string | null; note: string | null } | null;
  docs: NoticeDoc[];
  /** What could be read off the notices view: DINs and sections. */
  facts: { dins: string[]; sections: string[] };
};

export type ClientGroup = {
  pan: string;
  name: string;
  status: string | null;
  message: string | null;
  lastOk: string | null;
  lastChecked: string | null;
  inSheet: boolean;
  items: NoticeItem[];
};

export type NoticesView = {
  lastRun: ItdRunRow | null;
  /** No finished run in the last 26 hours: the morning check has stopped. */
  stale: boolean;
  tiles: { fresh: number; due: number; notChecked: number; forAction: number };
  attention: NoticeItem[];
  clients: ClientGroup[];
  failing: ClientGroup[];
};

const DAY = 86_400_000;
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00+05:30`) - Date.parse(`${from}T00:00:00+05:30`)) / DAY);

/** Why an account was not checked, in words for the page. */
export const STATUS_WORDS: Record<string, string> = {
  ok: 'Checked',
  'bad-password': 'Password rejected: update it in the sheet',
  'bad-user': 'User ID not accepted: check it in the sheet',
  otp: 'Asks for an OTP, so it cannot be checked unattended',
  captcha: 'The portal asked for a CAPTCHA',
  locked: 'The portal says the account is locked',
  'portal-down': 'The portal did not load',
  layout: 'The portal looked different from usual',
  timeout: 'The check took too long',
  error: 'Something unexpected went wrong',
};

export function buildNoticesView({
  accounts,
  proceedings,
  documents,
  alerts,
  runs,
  today,
  now,
}: {
  accounts: ItdAccountRow[];
  proceedings: ItdProceedingRow[];
  documents: ItdDocumentRow[];
  alerts: ItdAlertRow[];
  runs: ItdRunRow[];
  /** Today in India, YYYY-MM-DD. */
  today: string;
  now: number;
}): NoticesView {
  const docsBy = new Map<string, NoticeDoc[]>();
  for (const d of documents) {
    const list = docsBy.get(d.proceeding_key) ?? [];
    list.push({ id: d.id, name: d.label?.trim() || d.file_name || 'Notice', path: d.storage_path });
    docsBy.set(d.proceeding_key, list);
  }
  const freshBy = new Map<string, { detail: string; at: string }>();
  for (const a of alerts) {
    if (!a.proceeding_key || now - Date.parse(a.at) > 14 * DAY) continue;
    const had = freshBy.get(a.proceeding_key);
    if (!had || a.at > had.at) freshBy.set(a.proceeding_key, { detail: a.detail, at: a.at });
  }
  const nameOf = new Map(accounts.map((a) => [a.pan, a.name?.trim() || `PAN ending ${a.pan.slice(-4)}`]));

  const items: NoticeItem[] = proceedings
    .filter((p) => !p.gone_at)
    .map((p) => {
      const latest = [...(p.dates ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
      return {
        key: p.key,
        pan: p.pan,
        client: nameOf.get(p.pan) ?? `PAN ending ${p.pan.slice(-4)}`,
        name: p.name,
        ay: p.ay,
        fy: p.fy,
        tab: p.tab,
        noticeCount: p.notice_count,
        latest,
        due: p.due_on,
        dueIn: p.due_on ? days(today, p.due_on) : null,
        fresh: freshBy.get(p.key) ?? null,
        markedNew: p.marked_new,
        handled: p.handled_at ? { at: p.handled_at, by: p.handled_by, note: p.handled_note } : null,
        docs: docsBy.get(p.key) ?? [],
        facts: noticeFacts(p.notice_text),
      };
    });

  // Worth a look: not marked handled, and either new in the last fortnight
  // or with a response due within a week (or missed within the fortnight).
  const dueSoon = (i: NoticeItem) => i.dueIn !== null && i.dueIn <= 7 && i.dueIn >= -14;
  const attention = items
    .filter((i) => !i.handled && (i.fresh || dueSoon(i)))
    .sort((a, b) => (a.dueIn ?? 999) - (b.dueIn ?? 999) || (b.fresh?.at ?? '').localeCompare(a.fresh?.at ?? ''));

  const clients: ClientGroup[] = accounts
    .map((a) => ({
      pan: a.pan,
      name: nameOf.get(a.pan)!,
      status: a.status,
      message: a.message,
      lastOk: a.last_ok_at,
      lastChecked: a.last_checked_at,
      inSheet: a.in_sheet,
      items: items
        .filter((i) => i.pan === a.pan)
        .sort((x, y) => (x.tab === y.tab ? 0 : x.tab === 'action' ? -1 : 1) || (y.latest?.date ?? '').localeCompare(x.latest?.date ?? '')),
    }))
    .sort((a, b) => Number(b.inSheet) - Number(a.inSheet) || a.name.localeCompare(b.name));

  const failing = clients.filter((c) => c.inSheet && c.status && c.status !== 'ok');
  const lastRun = [...runs].sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
  const lastDone = runs.filter((r) => r.status === 'done' && r.finished_at).sort((a, b) => b.finished_at!.localeCompare(a.finished_at!))[0];

  return {
    lastRun,
    stale: !lastDone || now - Date.parse(lastDone.finished_at!) > 26 * 3600_000,
    tiles: {
      fresh: items.filter((i) => i.fresh && now - Date.parse(i.fresh.at) <= 7 * DAY).length,
      due: items.filter((i) => !i.handled && i.dueIn !== null && i.dueIn >= 0 && i.dueIn <= 7).length,
      notChecked: failing.length,
      forAction: items.filter((i) => i.tab === 'action' && !i.handled).length,
    },
    attention,
    clients,
    failing,
  };
}

/**
 * The document identification numbers and sections in a notice's text, the
 * two things a person quotes when they reply. The same patterns the morning
 * check reads due dates with (workers/itd-notices/src/parse.mjs).
 */
export function noticeFacts(text: string | null | undefined): { dins: string[]; sections: string[] } {
  const t = String(text ?? '');
  const dins = [...new Set(t.match(/\b(?:ITBA|CPC|ITD)\/[A-Z0-9/().-]{8,}/g) ?? [])].slice(0, 6);
  const sections = [...new Set([...t.matchAll(/(?:u\/s|under section|section)\s*([0-9]{2,3}[A-Z]{0,3}(?:\((?:\d+[A-Za-z]?|[a-z]{1,3})\))*)/gi)].map((m) => m[1]))].slice(0, 6);
  return { dins, sections };
}

/** "Due in 3 days", "Due today", "Due 2 days ago". */
export function dueWords(dueIn: number): string {
  if (dueIn === 0) return 'Due today';
  if (dueIn === 1) return 'Due tomorrow';
  if (dueIn > 1) return `Due in ${dueIn} days`;
  return `Due ${-dueIn} day${dueIn === -1 ? '' : 's'} ago`;
}
