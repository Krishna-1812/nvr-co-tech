import { describe, expect, it } from 'vitest';
import { buildPeople, countVisits, haystack, splitStaff, summarise, tally, SESSION_GAP_MS } from './people';
import type { PageViewRow, VisitorIdentityRow, VisitorViewRow } from './types';

/**
 * The join is the risky part of this module, so that is what is pinned down
 * here: which anonymous browsing gets attached to whom, where the boundary
 * between "before we knew them" and "after" falls, and the arithmetic that the
 * KPI cards read straight off.
 */

const view = (over: Partial<PageViewRow>): PageViewRow => ({
  id: 1,
  occurred_at: '2026-08-01T10:00:00Z',
  occurred_on: '2026-08-01',
  weekday: 'Sat',
  email: 'raj@acme.com',
  page_title: 'Register',
  page_url: 'https://x.test/vouchers',
  seconds: 30,
  ip: null,
  browser: 'Chrome',
  os: 'Windows',
  device: 'desktop',
  visitor_id: 'v1',
  ...over,
});

const anon = (over: Partial<VisitorViewRow>): VisitorViewRow => ({
  id: 1,
  occurred_at: '2026-07-01T10:00:00Z',
  occurred_on: '2026-07-01',
  weekday: 'Wed',
  visitor_id: 'v1',
  session_id: 's1',
  is_new_visitor: true,
  page_url: 'https://x.test/pricing',
  page_title: 'Pricing',
  referrer: 'https://google.com/',
  referrer_host: 'google.com',
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
  landing_page: '/pricing',
  pages_in_session: 1,
  time_on_page_s: 20,
  engaged_time_s: 15,
  max_scroll_pct: 60,
  total_clicks: 1,
  cta_clicks: null,
  video: null,
  form_stage: null,
  search_terms: null,
  rage_clicks: 0,
  lcp_ms: 1200,
  cls: 0.02,
  inp_ms: 90,
  viewport: null,
  screen: null,
  language: null,
  browser: 'Chrome',
  os: 'Windows',
  device: 'desktop',
  is_bot: false,
  ip: null,
  events: null,
  ...over,
});

describe('countVisits', () => {
  it('counts nothing for no activity', () => {
    expect(countVisits([])).toBe(0);
  });

  it('treats a run of close-together views as one visit', () => {
    const base = Date.parse('2026-08-01T10:00:00Z');
    expect(countVisits([base, base + 60_000, base + 120_000])).toBe(1);
  });

  it('splits on a gap longer than the session window', () => {
    const base = Date.parse('2026-08-01T10:00:00Z');
    expect(countVisits([base, base + SESSION_GAP_MS + 1000])).toBe(2);
  });

  it('does not split on a gap exactly at the window', () => {
    const base = Date.parse('2026-08-01T10:00:00Z');
    expect(countVisits([base, base + SESSION_GAP_MS])).toBe(1);
  });

  it('does not care what order the timestamps arrive in', () => {
    const base = Date.parse('2026-08-01T10:00:00Z');
    const times = [base + SESSION_GAP_MS * 3, base, base + 1000];
    expect(countVisits(times)).toBe(2);
  });
});

describe('buildPeople', () => {
  it('links pre-signup browsing through the tracking cookie', () => {
    const [person] = buildPeople({
      signedIn: [view({})],
      visitor: [anon({}), anon({ id: 2, occurred_at: '2026-07-01T10:05:00Z' })],
    });

    expect(person.preSignupPages).toBe(2);
    expect(person.source).toBe('google.com');
  });

  it('does not count a signed-in-era view as pre-signup, even on the same cookie', () => {
    // The tracking cookie outlives the sign-up, so anonymous rows keep arriving
    // under it afterwards. Those are not pre-signup pages and inflating the
    // figure with them would defeat the point of the join.
    const [person] = buildPeople({
      signedIn: [view({ occurred_at: '2026-08-01T10:00:00Z' })],
      visitor: [
        anon({ occurred_at: '2026-07-01T10:00:00Z' }),
        anon({ id: 2, occurred_at: '2026-08-02T10:00:00Z' }),
      ],
    });

    expect(person.preSignupPages).toBe(1);
  });

  it('attaches browsing named by an explicit identity capture', () => {
    const identity: VisitorIdentityRow = {
      id: 1,
      identified_at: '2026-07-02T10:00:00Z',
      visitor_id: 'v9',
      full_name: 'Raj Mehta',
      email: 'raj@acme.com',
      company: 'Acme',
      title: null,
      source: 'lead_form',
    };

    const [person] = buildPeople({
      signedIn: [view({})],
      visitor: [anon({ visitor_id: 'v9', occurred_at: '2026-07-01T09:00:00Z' })],
      identities: [identity],
    });

    expect(person.preSignupPages).toBe(1);
    expect(person.visitorIds).toContain('v9');
  });

  it('never attributes browsing it has no deterministic link for', () => {
    const [person] = buildPeople({
      signedIn: [view({})],
      // Same IP, same browser, same device as the signed-in person, different
      // cookie. Circumstantial only, so it must not be attached.
      visitor: [anon({ visitor_id: 'someone-else' })],
    });

    expect(person.preSignupPages).toBe(0);
  });

  it('excludes bot rows from linked browsing', () => {
    const [person] = buildPeople({
      signedIn: [view({})],
      visitor: [anon({ is_bot: true })],
    });

    expect(person.preSignupPages).toBe(0);
  });

  it('leaves company blank for a webmail address rather than naming the provider', () => {
    const [person] = buildPeople({ signedIn: [view({ email: 'raj@gmail.com' })] });
    expect(person.company).toBeNull();
  });

  it('reads a company off a real work domain', () => {
    const [person] = buildPeople({ signedIn: [view({ email: 'raj@acme.com' })] });
    expect(person.company).toBe('acme.com');
  });

  it('folds addresses that differ only by case into one person', () => {
    const people = buildPeople({
      signedIn: [view({ email: 'Raj@Acme.com' }), view({ id: 2, email: 'raj@acme.com' })],
    });

    expect(people).toHaveLength(1);
    expect(people[0].pageViews).toBe(2);
  });

  it('orders the journey newest first and caps it', () => {
    const signedIn = Array.from({ length: 10 }, (_, i) =>
      view({ id: i, occurred_at: `2026-08-0${(i % 9) + 1}T10:00:00Z`, page_title: `Page ${i}` }),
    );

    const [person] = buildPeople({ signedIn, journeyCap: 4 });

    expect(person.journey).toHaveLength(4);
    const times = person.journey.map((e) => Date.parse(e.at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('keeps the most recent events when capping, not the oldest', () => {
    const [person] = buildPeople({
      signedIn: [
        view({ id: 1, occurred_at: '2026-08-01T10:00:00Z', page_title: 'Oldest' }),
        view({ id: 2, occurred_at: '2026-08-09T10:00:00Z', page_title: 'Newest' }),
      ],
      journeyCap: 1,
    });

    expect(person.journey[0].label).toBe('Newest');
  });

  it('interleaves tool runs into the timeline and counts the tools used', () => {
    const [person] = buildPeople({
      signedIn: [view({ occurred_at: '2026-08-01T10:00:00Z' })],
      runs: [
        { email: 'raj@acme.com', feature_slug: 'ledger-reconciliation', created_at: '2026-08-02T10:00:00Z' },
        { email: 'raj@acme.com', feature_slug: 'ledger-reconciliation', created_at: '2026-08-03T10:00:00Z' },
        { email: 'raj@acme.com', feature_slug: 'audit-copilot', created_at: '2026-08-04T10:00:00Z' },
      ],
    });

    expect(person.runs).toBe(3);
    // Most-used tool first, so the table's secondary line names the right one.
    expect(person.features).toEqual(['ledger-reconciliation', 'audit-copilot']);
    expect(person.journey.filter((e) => e.kind === 'run')).toHaveLength(3);
    expect(person.lastSeen).toBe('2026-08-04T10:00:00Z');
  });

  it('takes the display name from the profile directory', () => {
    const [person] = buildPeople({
      signedIn: [view({})],
      profiles: [{ email: 'raj@acme.com', full_name: 'Raj Mehta', avatar_url: 'https://x.test/a.png' }],
    });

    expect(person.name).toBe('Raj Mehta');
    expect(person.photo).toBe('https://x.test/a.png');
  });

  it('takes the workspace they belong to from the directory, alongside the domain guess', () => {
    // Two different claims about the same person, and they are allowed to
    // disagree: the organisation is the tenant on their profile row, the company
    // is their email domain. A consultant at acme.com inside Northwind is a real
    // shape and collapsing the two would hide it.
    const [person] = buildPeople({
      signedIn: [view({})],
      profiles: [
        {
          email: 'raj@acme.com',
          full_name: 'Raj Mehta',
          avatar_url: null,
          organization_name: 'Northwind Trading',
        },
      ],
    });

    expect(person.organisation).toBe('Northwind Trading');
    expect(person.company).toBe('acme.com');
  });

  it('leaves the workspace null for somebody who signed up and never onboarded', () => {
    // organization_id is null until create_organization or accept_invite runs,
    // so the operator function hands back a null name. That state is the whole
    // onboarding drop-off measure and must not be filled in with a guess.
    const [person] = buildPeople({
      signedIn: [view({})],
      profiles: [
        { email: 'raj@acme.com', full_name: 'Raj Mehta', avatar_url: null, organization_name: null },
      ],
    });

    expect(person.organisation).toBeNull();
    expect(person.company).toBe('acme.com');
  });

  it('ignores page views with no address at all', () => {
    expect(buildPeople({ signedIn: [view({ email: null })] })).toHaveLength(0);
  });
});

describe('splitStaff', () => {
  it('sorts people by the allowlist, not by their domain', () => {
    const people = buildPeople({
      signedIn: [
        view({ email: 'staff@thefinanceintelligence.com' }),
        view({ id: 2, email: 'other@thefinanceintelligence.com' }),
        view({ id: 3, email: 'client@acme.com' }),
      ],
    });

    const { staff, external } = splitStaff(people, ['STAFF@thefinanceintelligence.com']);

    expect(staff.map((p) => p.email)).toEqual(['staff@thefinanceintelligence.com']);
    // A colleague who is not on the list lands in the external view. Wrong in the
    // safe direction: it shows a teammate as a customer rather than hiding a
    // customer as a teammate.
    expect(external.map((p) => p.email).sort()).toEqual([
      'client@acme.com',
      'other@thefinanceintelligence.com',
    ]);
  });
});

describe('summarise', () => {
  it('averages pages-before-signup over linked people only', () => {
    const people = buildPeople({
      signedIn: [view({ email: 'a@acme.com', visitor_id: 'v1' }), view({ id: 2, email: 'b@acme.com', visitor_id: 'v2' })],
      // Only the first person browsed beforehand.
      visitor: [anon({ visitor_id: 'v1' }), anon({ id: 2, visitor_id: 'v1', occurred_at: '2026-07-01T10:01:00Z' })],
    });

    const totals = summarise(people);

    expect(totals.people).toBe(2);
    expect(totals.linked).toBe(1);
    // Two pages over the one person it can describe, not over both.
    expect(totals.avgPagesBefore).toBe(2);
  });

  it('reports zero rather than dividing by nobody', () => {
    expect(summarise([]).avgPagesBefore).toBe(0);
  });
});

describe('tally', () => {
  it('counts, sorts and trims to the shape BarList renders', () => {
    expect(tally(['Chrome', 'Safari', 'Chrome', null, '', 'Edge'], 2)).toEqual([
      { label: 'Chrome', count: 2 },
      { label: 'Safari', count: 1 },
    ]);
  });
});

describe('haystack', () => {
  it('gathers every searchable field, lowercased', () => {
    const [person] = buildPeople({
      signedIn: [view({})],
      runs: [{ email: 'raj@acme.com', feature_slug: 'audit-copilot', created_at: '2026-08-02T10:00:00Z' }],
      profiles: [{ email: 'raj@acme.com', full_name: 'Raj Mehta', avatar_url: null }],
    });

    const text = haystack(person);

    expect(text).toContain('raj mehta');
    expect(text).toContain('acme.com');
    expect(text).toContain('audit-copilot');
    expect(text).toBe(text.toLowerCase());
  });
});
