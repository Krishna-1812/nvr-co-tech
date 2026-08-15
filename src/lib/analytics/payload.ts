import { deviceFingerprint, isBot, readAgent } from './ua';

/**
 * Turning what the browser sent into what the database stores.
 *
 * The beacon is unauthenticated and its body is whatever arrived over the wire,
 * so nothing in here trusts a single field. Every number is clamped, every
 * string is bounded, and anything unrecognised is dropped rather than passed
 * along — the database function on the other side clamps a second time, and
 * both of those are cheap compared to one bad row in a chart nobody can
 * explain.
 *
 * Three things are computed here rather than in the browser, because the
 * browser is the wrong place to be trusted about any of them: the browser and
 * operating system (from the User-Agent header, not from a client claim),
 * whether this is a crawler, and the IP address.
 */

/** Long enough for any real URL; short enough that a row cannot be a payload. */
const MAX_TEXT = 2_000;
const MAX_SHORT = 200;
/** The tracker caps its own event log at this. The server does not take its word. */
const MAX_EVENTS = 80;

const text = (value: unknown, limit = MAX_SHORT): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, limit) : null;
};

const count = (value: unknown, max = 1_000_000): number => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), max);
};

/**
 * The hostname a visitor came from, or "direct".
 *
 * Stripped of `www.` so that a referral from www.example.com and one from
 * example.com are one line in the report rather than two — which is the same
 * mistake as the renamed-page problem, one page's traffic quietly split across
 * two buckets with no error anywhere.
 */
export function referrerHost(referrer: unknown): string {
  const raw = text(referrer, MAX_TEXT);
  if (!raw) return 'direct';

  try {
    return new URL(raw).hostname.replace(/^www\./i, '').toLowerCase() || 'direct';
  } catch {
    return 'direct';
  }
}

/**
 * Flatten the CTA tally into one string.
 *
 * "signup×3 · log_in×1". A jsonb object would query more comfortably, and it
 * would also mean the shape on the wire and the shape in the column could drift
 * apart; the parser that reads this back lives beside the writer in
 * aggregate.ts, so there is exactly one definition of the format.
 */
export function flattenCta(cta: unknown): string | null {
  if (!cta || typeof cta !== 'object' || Array.isArray(cta)) return null;

  const parts = Object.entries(cta as Record<string, unknown>)
    .map(([label, n]) => [label.trim().slice(0, 64), count(n, 9_999)] as const)
    .filter(([label, n]) => label && n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => `${label}×${n}`);

  return parts.length ? parts.join(' · ').slice(0, MAX_TEXT) : null;
}

/** Only the three stages exist, and only in that order. Anything else is noise. */
function formStage(value: unknown): 'open' | 'started' | 'submitted' | null {
  return value === 'open' || value === 'started' || value === 'submitted' ? value : null;
}

function events(value: unknown): unknown[] | null {
  if (!Array.isArray(value)) return null;
  const kept = value.slice(0, MAX_EVENTS).filter((e) => e && typeof e === 'object');
  return kept.length ? kept : null;
}

export type BeaconPayload = Record<string, unknown>;

/**
 * The payload `record_visitor_view` expects.
 *
 * Keys match the function's jsonb reads exactly. It returns null when the body
 * has no visitor and no session, which is the one condition that makes a page
 * view meaningless rather than merely incomplete.
 */
export function visitorRow(
  body: BeaconPayload,
  { ua, ip }: { ua: string | null; ip: string | null },
): Record<string, unknown> | null {
  const visitorId = text(body.visitorId ?? body.visitor_id, 64);
  const sessionId = text(body.sessionId ?? body.session_id, 64);
  if (!visitorId || !sessionId) return null;

  const agent = readAgent(ua);
  const screen = text(body.screen, 32);

  return {
    visitor_id: visitorId,
    session_id: sessionId,
    is_new_visitor: body.isNewVisitor === true || body.is_new_visitor === true,

    page_url: text(body.pageUrl ?? body.page_url, MAX_TEXT) ?? '/',
    page_title: text(body.pageTitle ?? body.page_title, 300),
    referrer: text(body.referrer, MAX_TEXT),
    referrer_host: referrerHost(body.referrer),

    utm_source: text(body.utmSource ?? body.utm_source),
    utm_medium: text(body.utmMedium ?? body.utm_medium),
    utm_campaign: text(body.utmCampaign ?? body.utm_campaign),
    utm_term: text(body.utmTerm ?? body.utm_term),
    utm_content: text(body.utmContent ?? body.utm_content),

    landing_page: text(body.landingPage ?? body.landing_page, MAX_TEXT),
    pages_in_session: Math.max(count(body.pagesInSession ?? body.pages_in_session, 10_000), 1),

    // A day is the ceiling for both: past that the tab was abandoned, not read.
    time_on_page_s: count(body.timeOnPage ?? body.time_on_page_s, 86_400),
    engaged_time_s: count(body.engagedTime ?? body.engaged_time_s, 86_400),
    max_scroll_pct: Math.min(count(body.maxScroll ?? body.max_scroll_pct, 100), 100),
    total_clicks: count(body.clicks ?? body.total_clicks, 100_000),
    cta_clicks: flattenCta(body.cta),
    video: body.video === 'opened' ? 'opened' : null,
    form_stage: formStage(body.formStage ?? body.form_stage),
    search_terms: text(body.searchTerms ?? body.search_terms, MAX_TEXT),
    rage_clicks: count(body.rageClicks ?? body.rage_clicks, 100_000),

    lcp_ms: count(body.lcp, 600_000),
    cls: Math.min(Number(body.cls) || 0, 100),
    inp_ms: count(body.inp, 600_000),

    viewport: text(body.viewport, 32),
    screen,
    language: text(body.language, 32),
    browser: agent.browser,
    os: agent.os,
    device: agent.device,
    is_bot: isBot(ua),
    ip,
    device_fp: deviceFingerprint(agent, screen),
    events: events(body.events),
  };
}

/** The payload `record_page_view` expects, for a signed-in reader. */
export function pageViewRow(
  body: BeaconPayload,
  { ua, ip, email, visitorId }: { ua: string | null; ip: string | null; email: string | null; visitorId: string | null },
): Record<string, unknown> | null {
  const seconds = count(body.seconds, 86_400);
  // Under a second is a redirect or a back button, not somebody reading.
  if (seconds < 1) return null;

  const agent = readAgent(ua);

  return {
    email,
    page_title: text(body.title ?? body.page_title, 300),
    page_url: text(body.page ?? body.page_url, MAX_TEXT) ?? '/',
    seconds,
    ip,
    browser: agent.browser,
    os: agent.os,
    device: agent.device,
    visitor_id: visitorId,
  };
}

/**
 * Read a request body that may not be JSON.
 *
 * `navigator.sendBeacon` posts as `text/plain` — that is not configurable and
 * it is the whole reason the beacon survives a page unload at all. So a handler
 * that relies on a JSON content type receives nothing from the one delivery
 * mechanism that actually works, which is a genuinely maddening bug to find.
 * Both paths are read here, and a body that is neither becomes an empty object
 * rather than an error: the tracker must never be able to make a page fail.
 */
export async function readBody(request: Request): Promise<BeaconPayload> {
  try {
    const raw = await request.text();
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as BeaconPayload)
      : {};
  } catch {
    return {};
  }
}
