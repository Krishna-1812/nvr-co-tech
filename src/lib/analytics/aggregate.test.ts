import { describe, expect, it } from 'vitest';
import {
  bounceRate,
  conversionRate,
  ctaBreakdown,
  daily,
  formFunnel,
  overview,
  parseCta,
  rageHotspots,
  scrollDepth,
  searchTerms,
  summarise,
  topLandingPages,
  topPages,
  webVitals,
} from './aggregate';
import type { VisitorViewRow } from './types';

/**
 * The dashboard arithmetic.
 *
 * Every test here guards against the same class of bug: a figure that is wrong
 * but believable. Nothing throws when bots are counted as people or when an
 * unmeasured Core Web Vital is averaged in as zero — the number simply shifts,
 * in a direction that flatters or alarms, and stays wrong until somebody
 * happens to check it by hand.
 */

let nextId = 1;

const row = (over: Partial<VisitorViewRow> = {}): VisitorViewRow => ({
  id: nextId++,
  occurred_at: '2026-08-15T10:00:00.000Z',
  occurred_on: '2026-08-15',
  weekday: 'Sat',
  visitor_id: 'v1',
  session_id: 's1',
  is_new_visitor: false,
  page_url: '/',
  page_title: 'Home',
  referrer: null,
  referrer_host: 'direct',
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
  landing_page: '/',
  pages_in_session: 1,
  time_on_page_s: 30,
  engaged_time_s: 20,
  max_scroll_pct: 40,
  total_clicks: 2,
  cta_clicks: null,
  video: null,
  form_stage: null,
  search_terms: null,
  rage_clicks: 0,
  lcp_ms: 0,
  cls: 0,
  inp_ms: 0,
  viewport: '1440x900',
  screen: '1920x1080',
  language: 'en-IN',
  browser: 'Chrome',
  os: 'Windows',
  device: 'Desktop',
  is_bot: false,
  ip: '203.0.113.9',
  events: null,
  ...over,
});

describe('the overview figures', () => {
  it('leaves crawlers out of every human count', () => {
    const result = overview([
      row({ visitor_id: 'v1' }),
      row({ visitor_id: 'bot', session_id: 'sb', is_bot: true }),
    ]);

    expect(result.pageViews).toBe(1);
    expect(result.visitors).toBe(1);
    expect(result.botViews).toBe(1);
  });

  it('counts new against the visitor, not against the page view', () => {
    // Somebody's first view is flagged and their second is not. Counting rows
    // would report the same person as both new and returning.
    const result = overview([
      row({ visitor_id: 'v1', session_id: 's1', is_new_visitor: true }),
      row({ visitor_id: 'v1', session_id: 's1' }),
      row({ visitor_id: 'v2', session_id: 's2' }),
    ]);

    expect(result.visitors).toBe(2);
    expect(result.newVisitors).toBe(1);
    expect(result.returningVisitors).toBe(1);
  });

  it('takes the deepest reported session length rather than counting rows', () => {
    // One lost beacon must not invent a bounce that did not happen.
    const rows = [
      row({ session_id: 'deep', pages_in_session: 4 }),
      row({ session_id: 'shallow', pages_in_session: 1 }),
    ];

    expect(bounceRate(rows)).toBe(50);
  });

  it('reports no bounce rate at all rather than dividing by nothing', () => {
    expect(bounceRate([])).toBe(0);
    expect(overview([]).averageEngaged).toBe(0);
  });
});

describe('the time series', () => {
  it('includes the days nothing happened', () => {
    // A sparse line joins Monday to Friday and shows a slope where there was a
    // quiet week.
    const series = daily([row({ occurred_on: '2026-08-15' })], 7, new Date('2026-08-15T12:00:00Z'));

    expect(series).toHaveLength(7);
    expect(series[6]).toEqual({ day: '2026-08-15', views: 1, visitors: 1 });
    expect(series[0].views).toBe(0);
  });
});

describe('page and campaign tallies', () => {
  it('counts a landing page once per session, not once per row', () => {
    const rows = [
      row({ session_id: 's1', landing_page: '/pricing', page_url: '/pricing' }),
      row({ session_id: 's1', landing_page: '/pricing', page_url: '/about' }),
      row({ session_id: 's2', landing_page: '/about', page_url: '/about' }),
    ];

    expect(topLandingPages(rows)).toEqual([
      { label: '/about', count: 1 },
      { label: '/pricing', count: 1 },
    ]);
    // Page views are counted per row, which is the difference being tested.
    expect(topPages(rows)[0]).toEqual({ label: '/about', count: 2 });
  });
});

describe('behaviour', () => {
  it('reads the flattened CTA tally back into counts', () => {
    expect(parseCta('signup×3 · log_in×1')).toEqual([
      { label: 'signup', count: 3 },
      { label: 'log_in', count: 1 },
    ]);
    expect(parseCta(null)).toEqual([]);
    expect(parseCta('rubbish')).toEqual([]);
  });

  it('sums CTA counts across rows rather than counting the rows', () => {
    expect(
      ctaBreakdown([row({ cta_clicks: 'signup×2' }), row({ cta_clicks: 'signup×3 · log_in×1' })]),
    ).toEqual([
      { label: 'signup', count: 5 },
      { label: 'log_in', count: 1 },
    ]);
  });

  it('makes the funnel cumulative so no step is larger than the one before it', () => {
    const rows = [
      row({ session_id: 'a', form_stage: 'open' }),
      row({ session_id: 'b', form_stage: 'started' }),
      row({ session_id: 'c', form_stage: 'submitted' }),
    ];

    expect(formFunnel(rows)).toEqual([
      { stage: 'open', sessions: 3 },
      { stage: 'started', sessions: 2 },
      { stage: 'submitted', sessions: 1 },
    ]);
  });

  it('buckets scroll depth into four rather than a hundred', () => {
    const depths = [10, 30, 60, 90, 100].map((p) => row({ max_scroll_pct: p }));
    expect(scrollDepth(depths).map((b) => b.count)).toEqual([1, 1, 1, 2]);
  });

  it('splits search terms and drops the single characters', () => {
    expect(searchTerms([row({ search_terms: 'gst|tds|a' }), row({ search_terms: 'GST' })])).toEqual([
      { label: 'gst', count: 2 },
      { label: 'tds', count: 1 },
    ]);
  });

  it('sums rage clicks per page, which is where a broken control shows up', () => {
    expect(
      rageHotspots([
        row({ page_url: '/pricing', rage_clicks: 3 }),
        row({ page_url: '/pricing', rage_clicks: 2 }),
        row({ page_url: '/about', rage_clicks: 0 }),
      ]),
    ).toEqual([{ label: '/pricing', count: 5 }]);
  });
});

describe('Core Web Vitals', () => {
  it('excludes the unmeasured zeroes instead of averaging them in', () => {
    // Zero means "not measured", never "measured as zero". Counting them drags
    // every score towards a value nothing recorded.
    const result = webVitals([row({ lcp_ms: 2_000 }), row({ lcp_ms: 0 }), row({ lcp_ms: 3_000 })]);

    expect(result.lcp).toBe(2_500);
    expect(result.sampled).toBe(2);
  });

  it('says nothing rather than zero when nothing was measured', () => {
    expect(webVitals([row()])).toEqual({ lcp: null, cls: null, inp: null, sampled: 0 });
  });
});

describe('conversion', () => {
  it('counts a converting visitor once however many times they submitted', () => {
    const rows = [
      row({ visitor_id: 'v1', session_id: 's1', form_stage: 'submitted' }),
      row({ visitor_id: 'v1', session_id: 's2', form_stage: 'submitted' }),
      row({ visitor_id: 'v2', session_id: 's3' }),
    ];

    expect(conversionRate(rows)).toEqual({ converted: 1, visitors: 2, rate: 50 });
  });
});

describe('one visitor, summarised', () => {
  it('reads the journey forwards and keeps the furthest stage reached', () => {
    const rows = [
      row({ occurred_at: '2026-08-15T12:00:00Z', page_url: '/pricing', form_stage: 'open' }),
      row({ occurred_at: '2026-08-15T10:00:00Z', page_url: '/', landing_page: '/', form_stage: 'submitted' }),
    ];

    const summary = summarise(rows)!;
    expect(summary.pages).toEqual(['/', '/pricing']);
    expect(summary.firstSeen).toBe('2026-08-15T10:00:00Z');
    expect(summary.furthestStage).toBe('submitted');
  });

  it('resolves against the most recent address, not the first', () => {
    // Somebody who has moved from home wifi to an office is far more
    // interesting at the office.
    const summary = summarise([
      row({ occurred_at: '2026-08-15T10:00:00Z', ip: '203.0.113.1' }),
      row({ occurred_at: '2026-08-15T12:00:00Z', ip: '198.51.100.7' }),
    ])!;

    expect(summary.ip).toBe('198.51.100.7');
  });

  it('has nothing to say about no rows', () => {
    expect(summarise([])).toBeNull();
  });
});
