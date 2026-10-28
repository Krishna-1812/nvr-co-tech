import { describe, expect, it } from 'vitest';
import { fromThisSite, visitorAddress } from './request';

const req = (headers: Record<string, string>, url = 'https://www.example.test/api/chat') =>
  new Request(url, { method: 'POST', headers });

describe('whether a request came from this site', () => {
  it('takes a request from its own origin', () => {
    expect(fromThisSite(req({ origin: 'https://www.example.test', host: 'www.example.test' }))).toBe(true);
  });

  it('takes the forwarded host the platform reports', () => {
    expect(
      fromThisSite(
        req({ origin: 'https://www.example.test', host: 'internal:3000', 'x-forwarded-host': 'www.example.test' }, 'http://internal:3000/api/chat'),
      ),
    ).toBe(true);
  });

  it('refuses another site', () => {
    expect(fromThisSite(req({ origin: 'https://elsewhere.example', host: 'www.example.test' }))).toBe(false);
  });

  it('refuses an origin that is not a URL', () => {
    expect(fromThisSite(req({ origin: 'null', host: 'www.example.test' }))).toBe(false);
  });

  it('refuses a request with no origin that the browser marks cross-site', () => {
    expect(fromThisSite(req({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(fromThisSite(req({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
  });
});

describe('the address a visitor is counted by', () => {
  it('is the first forwarded address', () => {
    expect(visitorAddress(req({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
  });

  it('falls back to the real-ip header, then to one shared bucket', () => {
    expect(visitorAddress(req({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
    expect(visitorAddress(req({}))).toBe('unknown');
  });
});
