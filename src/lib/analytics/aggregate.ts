import { aliasCta, aliasPage } from './aliases';
import type { VisitorViewRow } from './types';

/**
 * Turning rows into the numbers a dashboard shows.
 *
 * Pure, and that is the point: every figure on every analytics screen is
 * produced here from an array of rows, with no database and no clock involved,
 * so each one can be checked against a handful of hand-written rows in a test
 * rather than against a live table nobody can hold in their head.
 *
 * Three rules run through all of it, and each one exists because getting it
 * wrong produces a plausible number rather than an error:
 *
 *   * Bots are excluded before anything is counted. A crawler's visit is real
 *     traffic worth keeping, but it is not a person, and letting it into a
 *     "unique visitors" figure makes that figure meaningless in a way nobody
 *     notices for months.
 *
 *   * Zero is not a measurement. An unset Core Web Vital arrives as 0, and
 *     averaging those in drags every score towards a value nothing recorded.
 *     They are dropped from the average rather than counted as fast.
 *
 *   * Labels are aliased before grouping. See aliases.ts for why a rename is
 *     the quietest possible way to corrupt a report.
 */

export type Counted = { label: string; count: number };

export type Vitals = { lcp: number | null; cls: number | null; inp: number | null; sampled: number };

export type Overview = {
  pageViews: number;
  visitors: number;
  sessions: number;
  newVisitors: number;
  returningVisitors: number;
  bounceRate: number;
  averageEngaged: number;
  totalEngaged: number;
  botViews: number;
};

const byCount = (a: Counted, b: Counted) => b.count - a.count || a.label.localeCompare(b.label);

/** Frequency count of whatever a row yields, biggest first. */
function tally(rows: VisitorViewRow[], pick: (row: VisitorViewRow) => string | null | undefined): Counted[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const label = pick(row)?.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts].map(([label, count]) => ({ label, count })).sort(byCount);
}

export const topN = (list: Counted[], n = 10): Counted[] => list.slice(0, n);

/** Real traffic. Everything in this file starts here. */
export const humanRows = (rows: VisitorViewRow[]): VisitorViewRow[] => rows.filter((r) => !r.is_bot);

export function overview(all: VisitorViewRow[]): Overview {
  const rows = humanRows(all);

  const visitors = new Set(rows.map((r) => r.visitor_id));
  const sessions = new Set(rows.map((r) => r.session_id));

  // "New" is a property of a visitor, not of a row: somebody's first page view
  // is flagged and their second is not, so the flag has to be folded up to the
  // visitor before it can be counted.
  const newOnes = new Set(rows.filter((r) => r.is_new_visitor).map((r) => r.visitor_id));

  const totalEngaged = rows.reduce((sum, r) => sum + r.engaged_time_s, 0);

  return {
    pageViews: rows.length,
    visitors: visitors.size,
    sessions: sessions.size,
    newVisitors: newOnes.size,
    returningVisitors: Math.max(visitors.size - newOnes.size, 0),
    bounceRate: bounceRate(rows),
    averageEngaged: sessions.size ? Math.round(totalEngaged / sessions.size) : 0,
    totalEngaged,
    botViews: all.length - rows.length,
  };
}

/**
 * The share of sessions that were one page and out.
 *
 * Computed from the highest `pages_in_session` any row of a session reported,
 * rather than from how many rows that session produced. The two differ whenever
 * a beacon is lost — a browser killed on unload, a network blip — and taking
 * the maximum means one missing row understates the depth of a session instead
 * of inventing a bounce that did not happen.
 */
export function bounceRate(rows: VisitorViewRow[]): number {
  const deepest = new Map<string, number>();
  for (const row of rows) {
    deepest.set(row.session_id, Math.max(deepest.get(row.session_id) ?? 0, row.pages_in_session));
  }
  if (deepest.size === 0) return 0;

  const bounced = [...deepest.values()].filter((depth) => depth <= 1).length;
  return Math.round((bounced / deepest.size) * 1000) / 10;
}

/**
 * Page views per day for a window ending today.
 *
 * Every day in the window appears, including the ones with nothing on them. A
 * sparse series drawn as a line silently joins Monday to Friday and shows a
 * gentle slope where there was in fact a quiet week.
 */
export function daily(rows: VisitorViewRow[], days = 30, today = new Date()): { day: string; views: number; visitors: number }[] {
  const views = new Map<string, number>();
  const seen = new Map<string, Set<string>>();

  for (const row of humanRows(rows)) {
    const day = row.occurred_on;
    views.set(day, (views.get(day) ?? 0) + 1);
    (seen.get(day) ?? seen.set(day, new Set()).get(day)!).add(row.visitor_id);
  }

  const out: { day: string; views: number; visitors: number }[] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, views: views.get(key) ?? 0, visitors: seen.get(key)?.size ?? 0 });
  }
  return out;
}

export function topPages(rows: VisitorViewRow[], n = 10): Counted[] {
  return topN(tally(humanRows(rows), (r) => aliasPage(r.page_url)), n);
}

export function topLandingPages(rows: VisitorViewRow[], n = 10): Counted[] {
  // One landing page per session, not per row: otherwise a long session votes
  // for its own entry point once for every page it went on to read.
  const firstOf = new Map<string, string>();
  for (const row of humanRows(rows)) {
    if (row.landing_page && !firstOf.has(row.session_id)) {
      firstOf.set(row.session_id, aliasPage(row.landing_page));
    }
  }

  const counts = new Map<string, number>();
  for (const page of firstOf.values()) counts.set(page, (counts.get(page) ?? 0) + 1);

  return topN([...counts].map(([label, count]) => ({ label, count })).sort(byCount), n);
}

export function topReferrers(rows: VisitorViewRow[], n = 10): Counted[] {
  return topN(tally(humanRows(rows), (r) => r.referrer_host), n);
}

export function topCampaigns(rows: VisitorViewRow[], n = 10): Counted[] {
  return topN(
    tally(humanRows(rows), (r) =>
      r.utm_source ? [r.utm_source, r.utm_campaign].filter(Boolean).join(' · ') : null,
    ),
    n,
  );
}

export const byDevice = (rows: VisitorViewRow[]) => tally(humanRows(rows), (r) => r.device);
export const byBrowser = (rows: VisitorViewRow[]) => tally(humanRows(rows), (r) => r.browser);
export const bySystem = (rows: VisitorViewRow[]) => tally(humanRows(rows), (r) => r.os);
export const byLanguage = (rows: VisitorViewRow[]) => tally(humanRows(rows), (r) => r.language);

/** Four buckets, because a histogram of a hundred percentages is not a chart. */
export function scrollDepth(rows: VisitorViewRow[]): Counted[] {
  const buckets = [
    { label: '0-25%', test: (p: number) => p < 25 },
    { label: '25-50%', test: (p: number) => p >= 25 && p < 50 },
    { label: '50-75%', test: (p: number) => p >= 50 && p < 75 },
    { label: '75-100%', test: (p: number) => p >= 75 },
  ];
  const human = humanRows(rows);

  return buckets.map(({ label, test }) => ({
    label,
    count: human.filter((r) => test(r.max_scroll_pct)).length,
  }));
}

/** Read the flattened "label×count · label×count" tally back into pairs. */
export function parseCta(value: string | null | undefined): Counted[] {
  if (!value) return [];

  return value
    .split('·')
    .map((part) => {
      const [label, n] = part.split('×');
      const count = Number((n ?? '').trim());
      const clean = (label ?? '').trim();
      return clean && Number.isFinite(count) && count > 0
        ? { label: aliasCta(clean), count }
        : null;
    })
    .filter((x): x is Counted => x !== null);
}

export function ctaBreakdown(rows: VisitorViewRow[]): Counted[] {
  const counts = new Map<string, number>();

  for (const row of humanRows(rows)) {
    for (const { label, count } of parseCta(row.cta_clicks)) {
      counts.set(label, (counts.get(label) ?? 0) + count);
    }
  }

  return [...counts].map(([label, count]) => ({ label, count })).sort(byCount);
}

const STAGE_ORDER = ['open', 'started', 'submitted'] as const;

/**
 * The lead funnel, counted per session and cumulatively.
 *
 * "Reached this stage or beyond" rather than "stopped at this stage", because a
 * funnel where the last step is larger than the one before it is a funnel
 * nobody can read. A session that submitted the form also opened it.
 */
export function formFunnel(rows: VisitorViewRow[]): { stage: string; sessions: number }[] {
  const best = new Map<string, number>();

  for (const row of humanRows(rows)) {
    if (!row.form_stage) continue;
    const rank = STAGE_ORDER.indexOf(row.form_stage) + 1;
    best.set(row.session_id, Math.max(best.get(row.session_id) ?? 0, rank));
  }

  const reached = [...best.values()];
  return STAGE_ORDER.map((stage, index) => ({
    stage,
    sessions: reached.filter((rank) => rank >= index + 1).length,
  }));
}

export function searchTerms(rows: VisitorViewRow[], n = 15): Counted[] {
  const counts = new Map<string, number>();

  for (const row of humanRows(rows)) {
    for (const term of (row.search_terms ?? '').split('|')) {
      const clean = term.trim().toLowerCase();
      if (clean.length >= 2) counts.set(clean, (counts.get(clean) ?? 0) + 1);
    }
  }

  return topN([...counts].map(([label, count]) => ({ label, count })).sort(byCount), n);
}

/** Where people click and click and nothing happens. A broken-UI detector. */
export function rageHotspots(rows: VisitorViewRow[], n = 8): Counted[] {
  const counts = new Map<string, number>();

  for (const row of humanRows(rows)) {
    if (row.rage_clicks <= 0) continue;
    const page = aliasPage(row.page_url);
    counts.set(page, (counts.get(page) ?? 0) + row.rage_clicks);
  }

  return topN([...counts].map(([label, count]) => ({ label, count })).sort(byCount), n);
}

export function videoPlays(rows: VisitorViewRow[]): { sessions: number; pages: Counted[] } {
  const opened = humanRows(rows).filter((r) => r.video === 'opened');
  return {
    sessions: new Set(opened.map((r) => r.session_id)).size,
    pages: topN(tally(opened, (r) => aliasPage(r.page_url)), 5),
  };
}

/**
 * Average Core Web Vitals over the rows that actually measured one.
 *
 * `sampled` comes back with them so the screen can say how many views the
 * average rests on. An LCP built from four page views is a number, not a
 * finding, and the reader deserves to know which one they are looking at.
 */
export function webVitals(rows: VisitorViewRow[]): Vitals {
  const human = humanRows(rows);

  const mean = (pick: (r: VisitorViewRow) => number, decimals = 0) => {
    const values = human.map(pick).filter((v) => v > 0);
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const factor = 10 ** decimals;
    return Math.round(avg * factor) / factor;
  };

  return {
    lcp: mean((r) => r.lcp_ms),
    cls: mean((r) => Number(r.cls), 3),
    inp: mean((r) => r.inp_ms),
    sampled: human.filter((r) => r.lcp_ms > 0).length,
  };
}

/**
 * Conversions over unique visitors.
 *
 * A conversion here is a submitted lead form, which is the only thing on this
 * site that means somebody wants to be contacted. Counted per visitor rather
 * than per session, so submitting twice from two devices is not a 200% rate.
 */
export function conversionRate(rows: VisitorViewRow[]): { converted: number; visitors: number; rate: number } {
  const human = humanRows(rows);
  const visitors = new Set(human.map((r) => r.visitor_id));
  const converted = new Set(
    human.filter((r) => r.form_stage === 'submitted').map((r) => r.visitor_id),
  );

  return {
    converted: converted.size,
    visitors: visitors.size,
    rate: visitors.size ? Math.round((converted.size / visitors.size) * 1000) / 10 : 0,
  };
}

/**
 * One visitor's whole story, folded out of their rows.
 *
 * This is what the account and visitor screens are built from, and what the
 * intent score is fed. Rows arrive newest-first from the database and are
 * reversed here, because a journey reads forwards.
 */
export type VisitorSummary = {
  visitorId: string;
  firstSeen: string;
  lastSeen: string;
  sessions: number;
  views: number;
  engagedSeconds: number;
  pages: string[];
  landing: string | null;
  referrer: string;
  campaign: string | null;
  device: string | null;
  country: string | null;
  ip: string | null;
  furthestStage: 'open' | 'started' | 'submitted' | null;
  rageClicks: number;
};

export function summarise(rows: VisitorViewRow[]): VisitorSummary | null {
  if (rows.length === 0) return null;

  const ordered = [...rows].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  const stages = ordered.map((r) => r.form_stage).filter(Boolean) as ('open' | 'started' | 'submitted')[];
  const furthest = stages.length
    ? STAGE_ORDER[Math.max(...stages.map((s) => STAGE_ORDER.indexOf(s)))]
    : null;

  return {
    visitorId: first.visitor_id,
    firstSeen: first.occurred_at,
    lastSeen: last.occurred_at,
    sessions: new Set(ordered.map((r) => r.session_id)).size,
    views: ordered.length,
    engagedSeconds: ordered.reduce((sum, r) => sum + r.engaged_time_s, 0),
    pages: ordered.map((r) => aliasPage(r.page_url)),
    landing: first.landing_page,
    referrer: first.referrer_host,
    campaign: first.utm_campaign ?? first.utm_source ?? null,
    device: last.device,
    country: null,
    // The most recent address is the one worth resolving: a visitor who has
    // moved from home wifi to an office is far more interesting at the office.
    ip: last.ip,
    furthestStage: furthest,
    rageClicks: ordered.reduce((sum, r) => sum + r.rage_clicks, 0),
  };
}

/** Group rows by visitor, newest activity first. */
export function byVisitor(rows: VisitorViewRow[]): Map<string, VisitorViewRow[]> {
  const grouped = new Map<string, VisitorViewRow[]>();
  for (const row of humanRows(rows)) {
    (grouped.get(row.visitor_id) ?? grouped.set(row.visitor_id, []).get(row.visitor_id)!).push(row);
  }
  return grouped;
}
