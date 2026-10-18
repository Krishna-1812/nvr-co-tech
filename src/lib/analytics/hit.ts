import { isBot, readAgent } from './ua';

/**
 * One message from the tracker, checked and turned into what `track_hit()`
 * (migration 0033) stores.
 *
 * The browser sends what only it knows: which page, how long, its screen,
 * language and time zone, and the campaign tags on the address it arrived at.
 * The server adds what only it knows: the address the request came from, the
 * country and city the host derives from it, and the browser and system read
 * from the user agent. Nothing here is trusted beyond its shape: IDs must look
 * like IDs, text is cut to length, time is a whole number of seconds.
 *
 * Pure, so the rules can be tested without a request.
 */

export type HitType = 'view' | 'time';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(v: unknown, n: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, n);
  return t || null;
}

/** Vercel URL-encodes the city ("New%20Delhi"). */
function header(h: Headers, name: string): string | null {
  const v = h.get(name);
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export function buildHit(
  body: unknown,
  headers: Headers,
  ip: string | null,
): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const type = b.type === 'view' || b.type === 'time' ? (b.type as HitType) : null;
  const vid = typeof b.vid === 'string' && UUID.test(b.vid) ? b.vid : null;
  const viewId = typeof b.view_id === 'string' && UUID.test(b.view_id) ? b.view_id : null;
  if (!type || !vid || !viewId) return null;

  const ua = headers.get('user-agent');
  if (isBot(ua)) return null;
  const agent = readAgent(ua);

  const seconds = Number(b.seconds);
  return {
    type,
    vid,
    view_id: viewId,
    sid: text(b.sid, 64),
    path: text(b.path, 500),
    title: text(b.title, 200),
    referrer: text(b.referrer, 500),
    seconds: Number.isFinite(seconds) ? Math.max(0, Math.min(21600, Math.round(seconds))) : 0,
    utm_source: text(b.utm_source, 120),
    utm_medium: text(b.utm_medium, 120),
    utm_campaign: text(b.utm_campaign, 120),
    screen: text(b.screen, 20),
    language: text(b.language, 40),
    timezone: text(b.timezone, 60),
    browser: agent.browser,
    os: agent.os,
    device: agent.device,
    user_agent: text(ua, 400),
    ip: text(ip, 60),
    country: text(header(headers, 'x-vercel-ip-country'), 8),
    region: text(header(headers, 'x-vercel-ip-country-region'), 80),
    city: text(header(headers, 'x-vercel-ip-city'), 120),
  };
}
