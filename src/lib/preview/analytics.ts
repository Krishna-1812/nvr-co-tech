/**
 * Sample traffic for preview mode.
 *
 * Generated rather than hand-written, and in its own file rather than in
 * fixtures.ts, because it is a different kind of sample. A voucher fixture
 * exists so a screen has one voucher to render; this exists because the
 * analytics screens need a few hundred rows before a trend line, a bounce rate
 * or a scroll histogram means anything at all — and unlike a voucher, a preview
 * user cannot produce this by using the app. Nobody can generate somebody
 * else's traffic.
 *
 * Deterministic on purpose. A seeded generator rather than Math.random, so the
 * same numbers appear on every reload and a screenshot taken today can be
 * compared with one taken next week.
 *
 * Every address is inside the ranges RFC 5737 reserves for documentation, so
 * they resolve to nothing anywhere. In preview that is exactly right: the
 * de-anonymisation engine is never consulted here, so what these screens prove
 * is that the components render — never that a resolution is correct. Only
 * Postgres and the live internet can prove that.
 */

const DAY = 86_400_000;
/** The same fixed "now" fixtures.ts uses, so the two samples agree on dates. */
const NOW = new Date('2026-08-02T09:30:00.000Z').getTime();

const ago = (days: number, hours = 0) =>
  new Date(NOW - days * DAY - hours * 3_600_000).toISOString();
const dateOnly = (days: number) => new Date(NOW - days * DAY).toISOString().slice(0, 10);

/** Mulberry32. Small, fast, and the same sequence every time. */
let seed = 20260815;
function rand(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));

const PAGES: readonly (readonly [string, string])[] = [
  ['/', 'The Finance Intelligence'],
  ['/agents', 'Every agent'],
  ['/agents/voucher-desk', 'Voucher Desk'],
  ['/agents/ledger-reconciliation', 'Ledger Reconciliation'],
  ['/agents/gst-reconciliation', 'GST Reconciliation'],
  ['/about', 'About'],
  ['/contact', 'Book a walkthrough'],
];

const REFERRERS = ['direct', 'direct', 'google.com', 'linkedin.com', 'news.ycombinator.com'];
const BROWSERS = ['Chrome', 'Chrome', 'Safari', 'Edge', 'Firefox'];
const SYSTEMS = ['Windows', 'macOS', 'Android', 'iOS'];
const CTAS = ['signup×1', 'watch_walkthrough×1', 'lead:Talk to us×1', 'agent_card:Voucher Desk×2'];
const TERMS = ['gst', 'tds', 'reconciliation', 'voucher'];

type Row = Record<string, unknown>;

function build(): Row[] {
  const rows: Row[] = [];
  let id = 1;

  for (let visitor = 0; visitor < 64; visitor += 1) {
    const visitorId = `pv-${String(visitor).padStart(3, '0')}`;
    const sessions = rand() < 0.25 ? between(2, 3) : 1;
    const browser = pick(BROWSERS);
    const os = pick(SYSTEMS);
    const device = os === 'Android' || os === 'iOS' ? 'Mobile' : 'Desktop';
    const referrer = pick(REFERRERS);
    const ip = `198.51.100.${between(1, 254)}`;
    const campaign = rand() < 0.18;
    /*
     * A third of the sample has no first-ever view inside the window — they
     * were already visiting before it opened. Without that, every visitor is
     * flagged new and the returning figure on the overview sits at zero, which
     * reads as a broken tile rather than as a fortnight of first-timers.
     */
    let isNew = rand() < 0.66;

    for (let session = 0; session < sessions; session += 1) {
      const sessionId = `ps-${visitor}-${session}`;
      const daysBack = between(0, 13);
      const depth = rand() < 0.42 ? 1 : between(2, 5);
      const landing = pick(PAGES)[0];
      /*
       * A visit that goes deep is much likelier to reach the lead form. That
       * correlation is the thing the funnel screen exists to show, so the
       * sample has to have it — otherwise the funnel renders as three bars of
       * roughly equal length, which looks like a bug in the chart.
       */
      const reaches = depth >= 3 && rand() < 0.4;

      for (let page = 0; page < depth; page += 1) {
        const [url, title] = page === 0 ? ([landing, 'Landing'] as const) : pick(PAGES);
        const engaged = between(5, 180);

        rows.push({
          id: id++,
          occurred_at: ago(daysBack, between(0, 20)),
          occurred_on: dateOnly(daysBack),
          weekday: new Date(NOW - daysBack * DAY).toLocaleDateString('en-IN', { weekday: 'short' }),
          visitor_id: visitorId,
          session_id: sessionId,
          is_new_visitor: isNew && page === 0,
          page_url: url,
          page_title: title,
          referrer: referrer === 'direct' ? null : `https://${referrer}/`,
          referrer_host: referrer,
          utm_source: campaign ? 'linkedin' : null,
          utm_medium: campaign ? 'social' : null,
          utm_campaign: campaign ? 'launch-recon' : null,
          utm_term: null,
          utm_content: null,
          landing_page: landing,
          pages_in_session: depth,
          time_on_page_s: engaged + between(0, 90),
          engaged_time_s: engaged,
          max_scroll_pct: between(12, 100),
          total_clicks: between(0, 9),
          cta_clicks: rand() < 0.3 ? pick(CTAS) : null,
          video: rand() < 0.12 ? 'opened' : null,
          form_stage: reaches && page === depth - 1 ? pick(['open', 'started', 'submitted']) : null,
          search_terms: rand() < 0.14 ? pick(TERMS) : null,
          rage_clicks: rand() < 0.07 ? between(1, 3) : 0,
          lcp_ms: between(1200, 3800),
          cls: Math.round(rand() * 120) / 1000,
          inp_ms: between(60, 320),
          viewport: device === 'Mobile' ? '390x844' : '1512x852',
          screen: device === 'Mobile' ? '390x844' : '1920x1080',
          language: 'en-IN',
          browser,
          os,
          device,
          is_bot: false,
          ip,
          events: null,
        });
      }
      isNew = false;
    }
  }

  // A handful of crawlers, so the "excluded" figure on the overview is not zero
  // and the exclusion can be seen doing its job rather than merely claimed.
  for (let bot = 0; bot < 9; bot += 1) {
    const daysBack = between(0, 13);
    rows.push({
      id: id++,
      occurred_at: ago(daysBack),
      occurred_on: dateOnly(daysBack),
      weekday: 'Mon',
      visitor_id: `pb-${bot}`,
      session_id: `pbs-${bot}`,
      is_new_visitor: true,
      page_url: '/',
      page_title: 'The Finance Intelligence',
      referrer: null,
      referrer_host: 'direct',
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      landing_page: '/',
      pages_in_session: 1,
      time_on_page_s: 1,
      engaged_time_s: 0,
      max_scroll_pct: 100,
      total_clicks: 0,
      cta_clicks: null,
      video: null,
      form_stage: null,
      search_terms: null,
      rage_clicks: 0,
      lcp_ms: 0,
      cls: 0,
      inp_ms: 0,
      viewport: '800x600',
      screen: '800x600',
      language: 'en',
      browser: 'Unknown',
      os: 'Linux',
      device: 'Desktop',
      is_bot: true,
      ip: '203.0.113.7',
      events: null,
    });
  }

  return rows.sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));
}

export const visitor_analytics: Row[] = build();

/**
 * Two people who said who they were.
 *
 * One filled in the lead form, one signed in. Both are deterministic links,
 * because those are the only kind this system ever creates — there is no sample
 * here of somebody being identified by inference, since that is not something
 * the code can do.
 */
export const visitor_identities: Row[] = [
  {
    id: 1,
    identified_at: ago(3),
    visitor_id: 'pv-004',
    full_name: 'Priya Raghunathan',
    email: 'priya@example.co.in',
    company: 'Example Textiles',
    title: 'Financial Controller',
    source: 'lead_form',
  },
  {
    id: 2,
    identified_at: ago(6),
    visitor_id: 'pv-011',
    full_name: 'Sanjay Iyer',
    email: 'sanjay@example.com',
    company: null,
    title: null,
    source: 'sign_in',
  },
];

export const identity_nodes: Row[] = [
  { id: 1, kind: 'visitor_id', value: 'pv-004', attrs: {}, first_seen: ago(9), last_seen: ago(3) },
  {
    id: 2,
    kind: 'email',
    value: 'priya@example.co.in',
    attrs: {
      full_name: 'Priya Raghunathan',
      title: 'Financial Controller',
      company: 'Example Textiles',
      source: 'lead_form',
    },
    first_seen: ago(3),
    last_seen: ago(3),
  },
  { id: 3, kind: 'visitor_id', value: 'pv-011', attrs: {}, first_seen: ago(12), last_seen: ago(6) },
  {
    id: 4,
    kind: 'email',
    value: 'sanjay@example.com',
    attrs: { full_name: 'Sanjay Iyer', source: 'sign_in' },
    first_seen: ago(6),
    last_seen: ago(6),
  },
];

export const identity_edges: Row[] = [
  {
    id: 1,
    src_id: 1,
    dst_id: 2,
    kind: 'deterministic',
    confidence: 1,
    source: 'lead_form',
    first_seen: ago(3),
    last_seen: ago(3),
    observations: 1,
  },
  {
    id: 2,
    src_id: 3,
    dst_id: 4,
    kind: 'deterministic',
    confidence: 1,
    source: 'sign_in',
    first_seen: ago(6),
    last_seen: ago(6),
    observations: 4,
  },
];
