import type { PageViewRow, VisitorIdentityRow, VisitorViewRow } from './types';
import type { Counted } from './aggregate';
import type { JourneyEvent } from '@/components/analytics/Journey';
import { companyFromEmail } from './identity';
import { aliasPage } from './aliases';

/**
 * Turning event logs into people.
 *
 * Every screen in the analytics section that lists humans reads from here. The
 * module is deliberately pure — rows in, people out, no Supabase and no clock —
 * because the joins it performs are the part most likely to be quietly wrong,
 * and a pure function is the only kind you can pin down with a test.
 *
 * ── One naming decision, stated plainly ──────────────────────────────────────
 *
 * The spec this was built from counts "logins" on four of its pages. This
 * product has no login log: Supabase owns authentication and does not expose a
 * per-sign-in feed, and nothing in this schema has ever recorded one. What it
 * does have is page views with timestamps, which give **visits** — runs of
 * activity separated by a gap of inactivity.
 *
 * So these screens say visits, and mean it. Deriving a number from page views
 * and labelling it "logins" would put a figure on a dashboard that nobody could
 * reconcile against anything, and would be the exact failure the spec's own
 * visitor-identification rules exist to prevent: a confidently-worded number
 * that is not what it claims to be. If real sign-in events are wanted later,
 * they need recording at the moment they happen; they cannot be recovered.
 */

/**
 * The gap that ends a visit.
 *
 * Thirty minutes, which is the long-standing web-analytics convention rather
 * than anything derived from this product's own data. Worth knowing it is a
 * convention: someone who reads a page, makes a cup of tea and comes back is
 * one visit at 31 minutes and two at 29.
 */
export const SESSION_GAP_MS = 30 * 60 * 1000;

export type RunEvent = {
  email: string;
  feature_slug: string;
  created_at: string;
};

export type Person = {
  email: string;
  name: string | null;
  photo: string | null;
  /** Their employer, or null. Never a webmail domain dressed up as one. */
  company: string | null;
  /** Runs of activity, not sign-ins. See the note at the top of this file. */
  visits: number;
  pageViews: number;
  /** Seconds on screen, summed from what the tracker measured. */
  seconds: number;
  firstSeen: string;
  lastSeen: string;
  browser: string | null;
  os: string | null;
  device: string | null;
  /** Where they originally came from, from their earliest pre-signup view. */
  source: string | null;
  /** How many pages they read before they had an account. */
  preSignupPages: number;
  /** Every tracking id we have tied to this address. */
  visitorIds: string[];
  runs: number;
  /** Which tools, most-used first. */
  features: string[];
  journey: JourneyEvent[];
};

/**
 * The instant a page was rendered.
 *
 * A function rather than a bare `Date.now()` in the page, for two reasons. The
 * lint rule that forbids reading a clock during render is aimed at components
 * that re-render and would silently disagree with themselves; a server
 * component renders once per request, so the concern does not apply, but the
 * rule cannot tell the difference and reading it here keeps the boundary
 * honest.
 *
 * The better reason is the one that survives the linter: every relative
 * timestamp on a screen should be measured from one agreed instant. Passing this
 * down as data means a table of forty rows all say "3d ago" relative to the same
 * moment, instead of each cell asking the clock separately and a few of them
 * landing on the other side of a minute boundary.
 */
export const renderedAt = (): number => Date.now();

/** How many separate visits a set of timestamps represents. */
export function countVisits(times: number[]): number {
  if (times.length === 0) return 0;

  const sorted = [...times].sort((a, b) => a - b);
  let visits = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] - sorted[i - 1] > SESSION_GAP_MS) visits += 1;
  }
  return visits;
}

/** The acquisition source a pre-signup view implies, in the fewest words that are true. */
export function sourceOf(row: VisitorViewRow): string | null {
  if (row.utm_source) {
    return row.utm_medium ? `${row.utm_source} / ${row.utm_medium}` : row.utm_source;
  }
  return row.referrer_host || null;
}

const ms = (iso: string): number => new Date(iso).getTime();

/** A page's name, or its path when the tracker never captured a title. */
function pageLabel(title: string | null, url: string): string {
  const clean = (title ?? '').trim();
  if (clean) return aliasPage(clean);
  try {
    return new URL(url).pathname || url;
  } catch {
    return url;
  }
}

/**
 * The join, and the only place it happens.
 *
 * Four streams go in and one list of people comes out:
 *
 *   signedIn    page views we know the author of
 *   visitor     anonymous page views, tied in through the tracking cookie
 *   identities  the moments a tracking id was pinned to a real address
 *   runs        opens of a metered tool
 *
 * The visitor stream is attached in two ways, and both are deterministic. A
 * person's signed-in rows carry the tracking id their browser had at the time,
 * so anything anonymous under that id is theirs. Separately, an identity row
 * says outright that a tracking id belongs to an address. Nothing here guesses:
 * there is no path where shared IPs, matching devices or similar behaviour
 * attach a name to a session, because that is how two different people
 * eventually become one wrong person.
 */
export function buildPeople({
  signedIn,
  visitor = [],
  identities = [],
  runs = [],
  profiles = [],
  journeyCap = 80,
}: {
  signedIn: PageViewRow[];
  visitor?: VisitorViewRow[];
  identities?: VisitorIdentityRow[];
  runs?: RunEvent[];
  /** Names and photos, which the page-view log does not carry. */
  profiles?: { email: string | null; full_name: string | null; avatar_url: string | null }[];
  /** Events per person. Capped here rather than in the browser so the payload stays small. */
  journeyCap?: number;
}): Person[] {
  const byEmail = new Map<string, {
    rows: PageViewRow[];
    visitorIds: Set<string>;
    runs: RunEvent[];
  }>();

  const slot = (email: string) => {
    const key = email.trim().toLowerCase();
    let entry = byEmail.get(key);
    if (!entry) {
      entry = { rows: [], visitorIds: new Set(), runs: [] };
      byEmail.set(key, entry);
    }
    return entry;
  };

  for (const row of signedIn) {
    if (!row.email) continue;
    const entry = slot(row.email);
    entry.rows.push(row);
    if (row.visitor_id) entry.visitorIds.add(row.visitor_id);
  }

  // An explicit identity capture is as good a link as a shared cookie, and is
  // the only way somebody who filled in a form before ever signing in gets
  // their browsing attached to them at all.
  for (const id of identities) {
    if (!id.email || !id.visitor_id) continue;
    slot(id.email).visitorIds.add(id.visitor_id);
  }

  for (const run of runs) {
    if (!run.email) continue;
    slot(run.email).runs.push(run);
  }

  const nameByEmail = new Map<string, { name: string | null; photo: string | null }>();
  for (const p of profiles) {
    if (!p.email) continue;
    nameByEmail.set(p.email.trim().toLowerCase(), {
      name: p.full_name,
      photo: p.avatar_url,
    });
  }

  const identityName = new Map<string, string>();
  for (const id of identities) {
    if (id.email && id.full_name) identityName.set(id.email.trim().toLowerCase(), id.full_name);
  }

  // Anonymous views, bucketed by tracking id once rather than scanned per person.
  const viewsByVisitor = new Map<string, VisitorViewRow[]>();
  for (const row of visitor) {
    if (row.is_bot || !row.visitor_id) continue;
    const list = viewsByVisitor.get(row.visitor_id);
    if (list) list.push(row);
    else viewsByVisitor.set(row.visitor_id, [row]);
  }

  const people: Person[] = [];

  for (const [email, entry] of byEmail) {
    const rows = [...entry.rows].sort((a, b) => ms(a.occurred_at) - ms(b.occurred_at));

    const preSignup: VisitorViewRow[] = [];
    for (const vid of entry.visitorIds) {
      for (const v of viewsByVisitor.get(vid) ?? []) preSignup.push(v);
    }
    preSignup.sort((a, b) => ms(a.occurred_at) - ms(b.occurred_at));

    // The first time we knew who this was. Anything anonymous before it is
    // pre-signup browsing; anything after is a signed-in view recorded under a
    // stale cookie, and counting it as pre-signup would inflate the one figure
    // this join exists to produce.
    const knownFrom = rows.length ? ms(rows[0].occurred_at) : Number.POSITIVE_INFINITY;
    const before = preSignup.filter((v) => ms(v.occurred_at) < knownFrom);

    const latest = rows.at(-1) ?? null;
    const runList = [...entry.runs].sort((a, b) => ms(a.created_at) - ms(b.created_at));

    const featureCount = new Map<string, number>();
    for (const r of runList) {
      featureCount.set(r.feature_slug, (featureCount.get(r.feature_slug) ?? 0) + 1);
    }

    const events: JourneyEvent[] = [
      ...before.map((v): JourneyEvent => ({
        kind: 'view',
        at: v.occurred_at,
        label: pageLabel(v.page_title, v.page_url),
        meta: v.referrer_host ? `from ${v.referrer_host}` : null,
      })),
      ...rows.map((r): JourneyEvent => ({
        kind: 'post',
        at: r.occurred_at,
        label: pageLabel(r.page_title, r.page_url),
        meta: r.seconds ? `${Math.round(r.seconds)}s` : null,
      })),
      ...runList.map((r): JourneyEvent => ({
        kind: 'run',
        at: r.created_at,
        label: `Opened ${r.feature_slug}`,
        meta: null,
      })),
    ].sort((a, b) => ms(a.at) - ms(b.at));

    const firstSeen = before[0]?.occurred_at ?? rows[0]?.occurred_at ?? null;
    const lastSeen = [latest?.occurred_at, runList.at(-1)?.created_at]
      .filter((v): v is string => Boolean(v))
      .sort((a, b) => ms(b) - ms(a))[0] ?? firstSeen;

    // Nothing at all to say about this person. Can happen when a run log names
    // an address that has no page views in the window being looked at.
    if (!firstSeen || !lastSeen) continue;

    people.push({
      email,
      name: nameByEmail.get(email)?.name ?? identityName.get(email) ?? null,
      photo: nameByEmail.get(email)?.photo ?? null,
      company: companyFromEmail(email),
      visits: countVisits(rows.map((r) => ms(r.occurred_at))),
      pageViews: rows.length,
      seconds: rows.reduce((sum, r) => sum + (r.seconds || 0), 0),
      firstSeen,
      lastSeen,
      browser: latest?.browser ?? null,
      os: latest?.os ?? null,
      device: latest?.device ?? null,
      source: before.length ? sourceOf(before[0]) : null,
      preSignupPages: before.length,
      visitorIds: [...entry.visitorIds],
      runs: runList.length,
      features: [...featureCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([slug]) => slug),
      // Newest first is how these are read, and capping after the sort keeps the
      // most recent events rather than the oldest ones.
      journey: events.reverse().slice(0, journeyCap),
    });
  }

  return people;
}

/**
 * Staff on one side, everybody else on the other.
 *
 * A plain suffix-free exact match against the allowlist, with no domain
 * inference. Somebody on the company's domain who is not on the list counts as
 * external here, which is the conservative direction to be wrong in: it puts a
 * colleague in the customer view rather than hiding a real customer from it.
 */
export function splitStaff(
  people: Person[],
  staffEmails: Iterable<string>,
): { staff: Person[]; external: Person[] } {
  const staffSet = new Set([...staffEmails].map((e) => e.trim().toLowerCase()));
  const staff: Person[] = [];
  const external: Person[] = [];

  for (const person of people) {
    (staffSet.has(person.email) ? staff : external).push(person);
  }

  return { staff, external };
}

/** Default order for a roster: whoever did the most, then whoever did it most recently. */
export const byEngagement = (a: Person, b: Person): number =>
  b.runs - a.runs || b.visits - a.visits || ms(b.lastSeen) - ms(a.lastSeen);

/** Everything the roster's search box needs to match against, lowercased once. */
export const haystack = (p: Person): string =>
  [p.email, p.name, p.company, p.browser, p.os, p.device, p.source, ...p.features]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

/**
 * The headline figures for a set of people.
 *
 * `linked` counts people with any pre-signup history, and `avgPagesBefore` is
 * averaged over those people only — not over everybody. Averaging over the whole
 * population would divide by a denominator that includes people the number
 * cannot describe, and would fall as tracking coverage improved.
 */
export function summarise(people: Person[]) {
  const linked = people.filter((p) => p.preSignupPages > 0);

  return {
    people: people.length,
    visits: people.reduce((n, p) => n + p.visits, 0),
    pageViews: people.reduce((n, p) => n + p.pageViews, 0),
    seconds: people.reduce((n, p) => n + p.seconds, 0),
    runs: people.reduce((n, p) => n + p.runs, 0),
    ranSomething: people.filter((p) => p.runs > 0).length,
    linked: linked.length,
    avgPagesBefore: linked.length
      ? Math.round((linked.reduce((n, p) => n + p.preSignupPages, 0) / linked.length) * 10) / 10
      : 0,
  };
}

/** A `Counted` list, in the exact shape BarList already renders. */
export function tally(values: (string | null | undefined)[], limit = 8): Counted[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const label = (raw ?? '').trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}
