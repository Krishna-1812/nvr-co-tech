import { describe, expect, it } from 'vitest';
import { buildHit } from './hit';
import { buildReport, duration, istDay, sourceOf } from './report';
import type { SiteViewRow, SiteVisitorRow } from '@/lib/supabase/types';

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';
const V3 = '33333333-3333-4333-8333-333333333333';
const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function visitor(id: string, patch: Partial<SiteVisitorRow> = {}): SiteVisitorRow {
  return {
    id, first_seen: '2026-10-10T04:00:00Z', last_seen: '2026-10-17T04:00:00Z', user_id: null, email: null,
    first_path: '/', first_referrer: null, utm_source: null, utm_medium: null, utm_campaign: null,
    browser: 'Chrome', os: 'Windows', device: 'Desktop', screen: '1920x1080', language: 'en-IN', timezone: 'Asia/Kolkata',
    country: 'IN', region: 'KA', city: 'Bengaluru', ip: '1.2.3.4', user_agent: 'x', ...patch,
  };
}
let n = 0;
function view(visitor_id: string, at: string, seconds: number, patch: Partial<SiteViewRow> = {}): SiteViewRow {
  n += 1;
  return { id: `v${n}`, visitor_id, session_id: `${visitor_id}-s`, user_id: null, path: '/', title: null, referrer: null, started_at: at, seconds, ...patch };
}

describe('buildReport', () => {
  const visitors = [
    visitor(V1, { user_id: U, email: 'asha@example.com' }),
    visitor(V2, { user_id: U, device: 'Mobile', first_seen: '2026-10-16T04:00:00Z' }),
    visitor(V3, { first_referrer: 'https://www.linkedin.com/feed', first_seen: '2026-10-17T04:00:00Z' }),
  ];
  const views = [
    // Before signing in, this browser's views carry no user; the visitor row does.
    view(V1, '2026-10-15T05:00:00Z', 60, { path: '/tools' }),
    view(V1, '2026-10-16T05:00:00Z', 120, { user_id: U, path: '/wealth-tracker', session_id: 'later' }),
    view(V2, '2026-10-16T09:00:00Z', 30, { user_id: U, path: '/hub' }),
    view(V3, '2026-10-17T06:00:00Z', 45, { path: '/' }),
  ];
  const report = buildReport({
    visitors,
    views,
    accounts: [{ id: U, email: 'asha@example.com', full_name: 'Asha Rao', created_at: '2026-10-16T04:55:00Z', last_sign_in_at: '2026-10-16T05:00:00Z', provider: 'google' }],
    access: [{ id: 1, created_at: '2026-10-17T06:01:00Z', name: 'Ravi', email: 'ravi@example.com', company: null, interest: 'Access to Voucher Desk', message: 'Hi', ip: null, source: null, visitor_id: V3 }],
    roadmap: [],
    since: '2026-10-11T18:30:00.000Z',
    today: '2026-10-18',
  });

  it('adds a signed-in person up across every browser, including what they did before signing in', () => {
    const asha = report.people.find((p) => p.kind === 'account')!;
    expect(asha.name).toBe('Asha Rao');
    expect(asha.browsers).toBe(2);
    expect(asha.views).toBe(3);
    expect(asha.seconds).toBe(210);
    expect(asha.visits).toBe(3);
    expect(asha.provider).toBe('google');
    // Most recent browser describes them now.
    expect(asha.device).toBe('Mobile');
  });

  it('keeps an anonymous browser as its own person, with its source and its request', () => {
    const anon = report.people.find((p) => p.kind === 'visitor')!;
    expect(anon.tag).toBe('333333');
    expect(anon.source).toBe('LinkedIn');
    expect(anon.requests).toBe(1);
    expect(report.requests[0].personKey).toBe(anon.key);
  });

  it('counts people, visits, views and time without double counting', () => {
    expect(report.totals).toMatchObject({ people: 2, signedIn: 1, anonymous: 1, views: 4, seconds: 255, requests: 1, newAccounts: 1 });
    expect(report.totals.returning).toBe(1);
    expect(report.days.at(-1)).toEqual({ day: '2026-10-18', people: 0, signedIn: 0 });
    expect(report.days.find((d) => d.day === '2026-10-16')).toEqual({ day: '2026-10-16', people: 1, signedIn: 1 });
    // One view each, so the tie goes to time spent.
    expect(report.pages[0].label).toBe('/wealth-tracker');
  });
});

describe('helpers', () => {
  it('reads days in India, sources in a word, durations plainly', () => {
    expect(istDay('2026-10-17T19:00:00Z')).toBe('2026-10-18');
    expect(sourceOf({ utm_source: null, first_referrer: 'https://www.google.co.in/' })).toBe('Google');
    // Answer engines, by the page they link from or the tag they add.
    expect(sourceOf({ utm_source: 'chatgpt.com', first_referrer: null })).toBe('ChatGPT');
    expect(sourceOf({ utm_source: null, first_referrer: 'https://chatgpt.com/' })).toBe('ChatGPT');
    expect(sourceOf({ utm_source: null, first_referrer: 'https://www.perplexity.ai/search?q=x' })).toBe('Perplexity');
    expect(sourceOf({ utm_source: null, first_referrer: 'https://gemini.google.com/app' })).toBe('Gemini');
    expect(sourceOf({ utm_source: null, first_referrer: 'https://copilot.microsoft.com/' })).toBe('Copilot');
    expect(sourceOf({ utm_source: null, first_referrer: 'https://claude.ai/chat/1' })).toBe('Claude');
    expect(sourceOf({ utm_source: null, first_referrer: 'https://duckduckgo.com/' })).toBe('DuckDuckGo');
    expect(sourceOf({ utm_source: 'newsletter', first_referrer: 'https://x.com' })).toBe('newsletter');
    expect(sourceOf({ utm_source: null, first_referrer: 'https://www.thefinanceintelligence.com/tools' }, 'www.thefinanceintelligence.com')).toBe('Direct');
    expect(duration(35)).toBe('35s');
    expect(duration(250)).toBe('4m 10s');
    expect(duration(7500)).toBe('2h 05m');
  });
});

describe('buildHit', () => {
  const h = (ua: string) =>
    new Headers({ 'user-agent': ua, 'x-vercel-ip-country': 'IN', 'x-vercel-ip-city': 'New%20Delhi' });
  const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

  it('keeps the shape, adds what the server knows, and never trusts the body beyond that', () => {
    const hit = buildHit({ type: 'time', vid: V1, view_id: V2, seconds: 99999, path: '/x', user_id: U }, h(chrome), '9.9.9.9')!;
    expect(hit).toMatchObject({ type: 'time', vid: V1, seconds: 21600, browser: 'Chrome', os: 'Windows', device: 'Desktop', city: 'New Delhi', country: 'IN', ip: '9.9.9.9' });
    expect(hit).not.toHaveProperty('user_id');
  });

  it('drops bots and anything without proper IDs', () => {
    expect(buildHit({ type: 'view', vid: V1, view_id: V2 }, h('Googlebot/2.1'), null)).toBeNull();
    expect(buildHit({ type: 'view', vid: 'nope', view_id: V2 }, h(chrome), null)).toBeNull();
    expect(buildHit({ type: 'other', vid: V1, view_id: V2 }, h(chrome), null)).toBeNull();
  });
});
