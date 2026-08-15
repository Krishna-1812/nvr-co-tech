import { describe, expect, it } from 'vitest';
import { flattenCta, pageViewRow, readBody, referrerHost, visitorRow } from './payload';
import { clientIp, deviceFingerprint, isBot, readAgent } from './ua';

/**
 * The boundary between the browser and the database.
 *
 * Everything arriving here is unauthenticated and unverified, so these tests
 * are mostly about what gets refused and what gets clamped. The other half is
 * the small set of facts the server works out for itself rather than believing
 * the client about: which browser, whether this is a crawler, and the address.
 */

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

describe('reading a User-Agent', () => {
  it('does not let Edge and Chrome collapse into one another', () => {
    // Every browser claims to be the one above it in the table. Order is what
    // stops all of them landing in the same bucket.
    expect(readAgent(CHROME).browser).toBe('Chrome');
    expect(readAgent(`${CHROME} Edg/124.0`).browser).toBe('Edge');
    expect(readAgent(IPHONE).browser).toBe('Safari');
  });

  it('reads the system before the family it claims to belong to', () => {
    // Android carries "Linux"; an iPad carries "Mac OS X".
    expect(readAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile').os).toBe('Android');
    expect(readAgent(IPHONE).os).toBe('iOS');
    expect(readAgent(CHROME).os).toBe('Windows');
  });

  it('tells an Android tablet from an Android phone', () => {
    expect(readAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari').device).toBe('Mobile');
    expect(readAgent('Mozilla/5.0 (Linux; Android 14; SM-X200) Safari').device).toBe('Tablet');
    expect(readAgent(CHROME).device).toBe('Desktop');
  });

  it('says Unknown rather than guessing', () => {
    expect(readAgent(null)).toEqual({ browser: 'Unknown', os: 'Unknown', device: 'Desktop' });
  });

  it('spots the crawlers, unfurlers and uptime checks', () => {
    for (const ua of ['Googlebot/2.1', 'facebookexternalhit/1.1', 'curl/8.4.0', 'HeadlessChrome', 'python-requests/2.31']) {
      expect(isBot(ua)).toBe(true);
    }
    expect(isBot(CHROME)).toBe(false);
  });

  it('keeps the device fingerprint coarse on purpose', () => {
    // It may only ever create a weak co-occurrence edge, which by design can
    // never merge two people. A sharper one would be a tracking device.
    expect(deviceFingerprint(readAgent(CHROME), '1920x1080')).toBe('Chrome|Windows|Desktop|1920x1080');
  });

  it('takes the first hop of the forwarded chain, not the last', () => {
    // The last entry is always your own load balancer.
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1, 172.16.0.4' });
    expect(clientIp(headers)).toBe('203.0.113.9');
    expect(clientIp(new Headers({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe('normalising the beacon', () => {
  const body = {
    visitorId: 'v-1',
    sessionId: 's-1',
    pageUrl: '/pricing',
    referrer: 'https://www.google.com/search?q=vouchers',
    cta: { signup: 3, log_in: 1, empty: 0 },
    maxScroll: 140,
    timeOnPage: 42,
    cls: 0.03,
  };

  it('refuses a page view with no visitor or no session', () => {
    expect(visitorRow({ ...body, visitorId: '' }, { ua: CHROME, ip: null })).toBeNull();
    expect(visitorRow({ ...body, sessionId: undefined }, { ua: CHROME, ip: null })).toBeNull();
  });

  it('works out the browser itself instead of believing the payload', () => {
    const row = visitorRow({ ...body, browser: 'Netscape' }, { ua: CHROME, ip: '203.0.113.9' })!;
    expect(row.browser).toBe('Chrome');
    expect(row.is_bot).toBe(false);
    expect(row.ip).toBe('203.0.113.9');
  });

  it('clamps a scroll percentage that cannot be real', () => {
    expect(visitorRow(body, { ua: CHROME, ip: null })!.max_scroll_pct).toBe(100);
  });

  it('strips www so one referrer is one line in the report', () => {
    expect(referrerHost('https://www.google.com/search?q=x')).toBe('google.com');
    expect(referrerHost('not a url')).toBe('direct');
    expect(referrerHost(null)).toBe('direct');
  });

  it('flattens the CTA tally biggest first and drops the empty ones', () => {
    expect(flattenCta({ signup: 3, log_in: 1, never: 0 })).toBe('signup×3 · log_in×1');
    expect(flattenCta(null)).toBeNull();
    expect(flattenCta([])).toBeNull();
  });

  it('keeps only the three funnel stages that exist', () => {
    expect(visitorRow({ ...body, formStage: 'started' }, { ua: CHROME, ip: null })!.form_stage).toBe('started');
    expect(visitorRow({ ...body, formStage: 'nearly' }, { ua: CHROME, ip: null })!.form_stage).toBeNull();
  });

  it('discards a signed-in page view under a second', () => {
    // That is a redirect or a back button, not somebody reading.
    const args = { ua: CHROME, ip: null, email: 'a@b.com', visitorId: 'v-1' };
    expect(pageViewRow({ page: '/vouchers', seconds: 0 }, args)).toBeNull();
    expect(pageViewRow({ page: '/vouchers', seconds: 12 }, args)!.seconds).toBe(12);
  });

  it('reads a beacon posted as text/plain, which is the only kind that arrives', () => {
    // sendBeacon posts as text/plain and that is not configurable. A handler
    // that insists on a JSON content type receives nothing from the one
    // delivery mechanism that survives a page unload.
    const request = new Request('https://example.com', {
      method: 'POST',
      body: JSON.stringify({ visitorId: 'v-1' }),
      headers: { 'content-type': 'text/plain' },
    });

    return expect(readBody(request)).resolves.toEqual({ visitorId: 'v-1' });
  });

  it('turns an unreadable body into an empty object rather than an error', () => {
    const request = new Request('https://example.com', { method: 'POST', body: '<html>' });
    return expect(readBody(request)).resolves.toEqual({});
  });
});
