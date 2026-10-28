import type {
  AccessRequestRow,
  AdminAccountRow,
  FeatureRequestRow,
  SiteViewRow,
  SiteVisitorRow,
} from '@/lib/supabase/types';

/**
 * Everything the Admin screen shows, worked out from the raw rows.
 *
 * A "person" is an account when the browsing is signed in (every browser that
 * account has used, added together) and a single browser otherwise. That is
 * the whole identity model: the cookie keeps a returning browser the same
 * visitor, and signing in moves that visitor, history and all, under the
 * account (migration 0033).
 *
 * Pure and synchronous, so it is tested on its own and the page only fetches.
 * Every count is of rows that exist; nothing is estimated.
 */

export type Range = '7d' | '30d' | '90d' | 'all';

export const RANGES: { id: Range; label: string; days: number | null }[] = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
  { id: 'all', label: 'All time', days: null },
];

export type Journey = { path: string; title: string | null; at: string; seconds: number };

export type Person = {
  key: string;
  /** An account, or a browser nobody has signed in on. */
  kind: 'account' | 'visitor';
  name: string | null;
  email: string | null;
  /** A short, stable label for an anonymous visitor: the start of its ID. */
  tag: string;
  firstSeen: string;
  lastSeen: string;
  browsers: number;
  visits: number;
  views: number;
  seconds: number;
  device: string | null;
  browser: string | null;
  os: string | null;
  place: string | null;
  /** Two-letter country code from the address, for the Countries list. */
  country: string | null;
  source: string;
  language: string | null;
  screen: string | null;
  ip: string | null;
  /** Newest first, up to 200 pages. */
  journey: Journey[];
  /** More than one visit, or first seen before the period began. */
  returning: boolean;
  requests: number;
  joined: string | null;
  lastSignIn: string | null;
  provider: string | null;
};

export type Request = {
  id: string;
  kind: 'access' | 'roadmap';
  at: string;
  name: string | null;
  email: string;
  company: string | null;
  what: string;
  message: string | null;
  /** The person on this screen the request belongs to, when known. */
  personKey: string | null;
};

export type Count = { label: string; value: number; seconds?: number };

export type Report = {
  totals: {
    people: number;
    signedIn: number;
    anonymous: number;
    returning: number;
    visits: number;
    views: number;
    seconds: number;
    requests: number;
    accounts: number;
    newAccounts: number;
  };
  days: { day: string; people: number; signedIn: number }[];
  people: Person[];
  requests: Request[];
  pages: Count[];
  sources: Count[];
  places: Count[];
  devices: Count[];
};

const IST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });

/** The calendar day an instant falls on in India, as YYYY-MM-DD. */
export function istDay(iso: string | Date): string {
  return IST.format(typeof iso === 'string' ? new Date(iso) : iso);
}

/**
 * The assistants that send people here, by the host they link from or the
 * utm_source they add (ChatGPT tags its links utm_source=chatgpt.com). Named,
 * so the sources table answers "are answer engines sending anyone?" at a
 * glance instead of scattering it across raw host names.
 */
const ASSISTANTS: [RegExp, string][] = [
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$/, 'ChatGPT'],
  [/(^|\.)perplexity\.ai$/, 'Perplexity'],
  [/(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$/, 'Gemini'],
  [/(^|\.)copilot\.microsoft\.com$|(^|\.)copilot\.cloud\.microsoft$/, 'Copilot'],
  [/(^|\.)claude\.ai$/, 'Claude'],
  [/(^|\.)chat\.deepseek\.com$/, 'DeepSeek'],
  [/(^|\.)meta\.ai$/, 'Meta AI'],
];

function assistant(host: string): string | null {
  const clean = host.toLowerCase().replace(/^www\./, '');
  return ASSISTANTS.find(([re]) => re.test(clean))?.[1] ?? null;
}

/** Where a visitor came from, in a word: a campaign, a site, or Direct. */
export function sourceOf(v: Pick<SiteVisitorRow, 'utm_source' | 'first_referrer'>, ownHost?: string): string {
  if (v.utm_source) return assistant(v.utm_source) ?? v.utm_source;
  if (!v.first_referrer) return 'Direct';
  try {
    const host = new URL(v.first_referrer).hostname.replace(/^www\./, '');
    if (ownHost && host === ownHost.replace(/^www\./, '')) return 'Direct';
    const ai = assistant(host);
    if (ai) return ai;
    if (/google\./.test(host)) return 'Google';
    if (/duckduckgo\.com$/.test(host)) return 'DuckDuckGo';
    if (/bing\.com$/.test(host)) return 'Bing';
    if (/linkedin\.com$|lnkd\.in$/.test(host)) return 'LinkedIn';
    if (/(^|\.)t\.co$|twitter\.com$|x\.com$/.test(host)) return 'X';
    if (/facebook\.com$|fb\.me$/.test(host)) return 'Facebook';
    if (/whatsapp\.com$|wa\.me$/.test(host)) return 'WhatsApp';
    return host;
  } catch {
    return 'Direct';
  }
}

function place(v: SiteVisitorRow): string | null {
  const parts = [v.city, v.region && v.region !== v.city ? v.region : null, v.country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function top(map: Map<string, { value: number; seconds: number }>, n: number): Count[] {
  return [...map.entries()]
    .map(([label, c]) => ({ label, value: c.value, seconds: c.seconds }))
    .sort((a, b) => b.value - a.value || b.seconds - a.seconds)
    .slice(0, n);
}

function bump(map: Map<string, { value: number; seconds: number }>, key: string, seconds = 0, by = 1) {
  const c = map.get(key) ?? { value: 0, seconds: 0 };
  c.value += by;
  c.seconds += seconds;
  map.set(key, c);
}

export function buildReport({
  visitors,
  views,
  accounts,
  access,
  roadmap,
  since,
  today,
  ownHost,
}: {
  visitors: SiteVisitorRow[];
  /** Views inside the range. */
  views: SiteViewRow[];
  accounts: AdminAccountRow[];
  access: AccessRequestRow[];
  roadmap: FeatureRequestRow[];
  /** Start of the range, or null for all time. */
  since: string | null;
  /** Today in India, YYYY-MM-DD, the last day of the chart. */
  today: string;
  ownHost?: string;
}): Report {
  const visitorById = new Map(visitors.map((v) => [v.id, v]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const keyOf = (visitorId: string, userId: string | null) => {
    const uid = userId ?? visitorById.get(visitorId)?.user_id ?? null;
    return uid ? `u:${uid}` : `v:${visitorId}`;
  };

  // ── People, from the views in range ──
  type Acc = {
    person: Person;
    sessions: Set<string>;
    browsers: Set<string>;
    latestVisitor: SiteVisitorRow | null;
    firstVisitor: SiteVisitorRow | null;
  };
  const people = new Map<string, Acc>();
  const sessions = new Set<string>();
  const pages = new Map<string, { value: number; seconds: number }>();
  const dayPeople = new Map<string, Set<string>>();
  const daySigned = new Map<string, Set<string>>();
  let seconds = 0;

  const sorted = [...views].sort((a, b) => a.started_at.localeCompare(b.started_at));
  for (const view of sorted) {
    const key = keyOf(view.visitor_id, view.user_id);
    const visitor = visitorById.get(view.visitor_id) ?? null;
    let acc = people.get(key);
    if (!acc) {
      const uid = key.startsWith('u:') ? key.slice(2) : null;
      const account = uid ? accountById.get(uid) : undefined;
      acc = {
        person: {
          key,
          kind: uid ? 'account' : 'visitor',
          name: account?.full_name ?? null,
          email: account?.email ?? visitor?.email ?? null,
          tag: (uid ?? view.visitor_id).slice(0, 6).toUpperCase(),
          firstSeen: view.started_at,
          lastSeen: view.started_at,
          browsers: 0,
          visits: 0,
          views: 0,
          seconds: 0,
          device: null,
          browser: null,
          os: null,
          place: null,
          country: null,
          source: 'Direct',
          language: null,
          screen: null,
          ip: null,
          journey: [],
          returning: false,
          requests: 0,
          joined: account?.created_at ?? null,
          lastSignIn: account?.last_sign_in_at ?? null,
          provider: account?.provider ?? null,
        },
        sessions: new Set(),
        browsers: new Set(),
        latestVisitor: null,
        firstVisitor: null,
      };
      people.set(key, acc);
    }
    const p = acc.person;
    p.views += 1;
    p.seconds += view.seconds;
    p.lastSeen = view.started_at;
    acc.sessions.add(view.session_id ?? view.visitor_id);
    acc.browsers.add(view.visitor_id);
    if (visitor) {
      acc.latestVisitor = visitor;
      acc.firstVisitor ??= visitor;
    }
    p.journey.push({ path: view.path, title: view.title, at: view.started_at, seconds: view.seconds });

    sessions.add(view.session_id ?? `${view.visitor_id}:${istDay(view.started_at)}`);
    seconds += view.seconds;
    bump(pages, view.path, view.seconds);
    const day = istDay(view.started_at);
    (dayPeople.get(day) ?? dayPeople.set(day, new Set()).get(day)!).add(key);
    if (key.startsWith('u:')) (daySigned.get(day) ?? daySigned.set(day, new Set()).get(day)!).add(key);
  }

  const sources = new Map<string, { value: number; seconds: number }>();
  const places = new Map<string, { value: number; seconds: number }>();
  const devices = new Map<string, { value: number; seconds: number }>();
  let returning = 0;

  for (const acc of people.values()) {
    const p = acc.person;
    p.visits = acc.sessions.size;
    p.browsers = acc.browsers.size;
    // Who they are now: the most recent browser. Where they came from: the first.
    const latest = acc.latestVisitor;
    if (latest) {
      p.device = latest.device;
      p.browser = latest.browser;
      p.os = latest.os;
      p.place = place(latest);
      p.country = latest.country;
      p.language = latest.language;
      p.screen = latest.screen;
      p.ip = latest.ip;
      p.email ??= latest.email;
    }
    const first = acc.firstVisitor;
    if (first) {
      p.source = sourceOf(first, ownHost);
      // First seen is the browser's first visit ever, not the first in range.
      for (const vid of acc.browsers) {
        const v = visitorById.get(vid);
        if (v && v.first_seen < p.firstSeen) p.firstSeen = v.first_seen;
      }
    }
    p.returning = p.visits > 1 || (since !== null && p.firstSeen < since);
    if (p.returning) returning += 1;
    p.journey = p.journey.slice(-200).reverse();
    bump(sources, p.source);
    bump(places, latest?.country ? place({ ...latest, city: null, region: null }) ?? 'Unknown' : 'Unknown');
    bump(devices, p.device ?? 'Unknown');
  }

  // ── Requests, matched to people where the browser or the address is known ──
  const keyByEmail = new Map<string, string>();
  for (const p of people.values()) if (p.person.email) keyByEmail.set(p.person.email.toLowerCase(), p.person.key);
  for (const a of accounts) if (a.email && !keyByEmail.has(a.email.toLowerCase())) keyByEmail.set(a.email.toLowerCase(), `u:${a.id}`);

  const inRange = (at: string) => since === null || at >= since;
  const requests: Request[] = [
    ...access.filter((r) => inRange(r.created_at)).map((r) => {
      const byVisitor = r.visitor_id && visitorById.has(r.visitor_id) ? keyOf(r.visitor_id, null) : null;
      return {
        id: `a${r.id}`,
        kind: 'access' as const,
        at: r.created_at,
        name: r.name,
        email: r.email,
        company: r.company,
        what: r.interest ?? 'General enquiry',
        message: r.message,
        personKey: byVisitor ?? keyByEmail.get(r.email.toLowerCase()) ?? null,
      };
    }),
    ...roadmap.filter((r) => inRange(r.created_at)).map((r) => ({
      id: `f${r.id}`,
      kind: 'roadmap' as const,
      at: r.created_at,
      name: r.name,
      email: r.email,
      company: null,
      what: `Wants ${r.feature_slug}`,
      message: r.reason,
      personKey: r.actor_id ? `u:${r.actor_id}` : (keyByEmail.get(r.email.toLowerCase()) ?? null),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  for (const r of requests) {
    const acc = r.personKey ? people.get(r.personKey) : undefined;
    if (acc) acc.person.requests += 1;
  }

  // ── The chart: one bar per day, ending today ──
  const spanDays = since ? Math.max(1, Math.round((Date.parse(`${today}T00:00:00+05:30`) - Date.parse(since)) / 86_400_000) + 1) : null;
  const firstDay = sorted[0] ? istDay(sorted[0].started_at) : today;
  const count = Math.min(120, spanDays ?? Math.max(1, Math.round((Date.parse(today) - Date.parse(firstDay)) / 86_400_000) + 1));
  const days: Report['days'] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.parse(`${today}T12:00:00+05:30`) - i * 86_400_000);
    const day = istDay(d);
    days.push({ day, people: dayPeople.get(day)?.size ?? 0, signedIn: daySigned.get(day)?.size ?? 0 });
  }

  const list = [...people.values()].map((a) => a.person).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  const signedIn = list.filter((p) => p.kind === 'account').length;

  return {
    totals: {
      people: list.length,
      signedIn,
      anonymous: list.length - signedIn,
      returning,
      visits: sessions.size,
      views: views.length,
      seconds,
      requests: requests.length,
      accounts: accounts.length,
      newAccounts: accounts.filter((a) => inRange(a.created_at)).length,
    },
    days,
    people: list,
    requests,
    pages: top(pages, 8),
    sources: top(sources, 6),
    places: top(places, 6),
    devices: top(devices, 3),
  };
}

/** "2h 05m", "4m 10s", "35s". */
export function duration(total: number): string {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${s}s`;
}
