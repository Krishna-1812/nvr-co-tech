/**
 * Reading a User-Agent string.
 *
 * Done here rather than with a library because the whole tracker is built on
 * the promise that nothing about a visitor leaves this codebase, and pulling in
 * a UA-parsing dependency to answer "Chrome or Safari" is a large surface for a
 * small question. What is wanted is three coarse buckets for a breakdown chart,
 * not a version-accurate fingerprint.
 *
 * The order of the checks is the whole trick. Every browser lies in the same
 * direction — Edge claims to be Chrome, Chrome claims to be Safari, Safari
 * claims to be Mozilla — so the more specific token has to be tested first or
 * everything collapses into one bucket.
 */

/**
 * Anything that is not a person.
 *
 * `preview` and `monitor` are in here because link unfurlers and uptime checks
 * are the two things most likely to inflate a page's numbers overnight without
 * anybody noticing. They are matched loosely on purpose: a false positive costs
 * one row filed under bots, a false negative costs a metric.
 */
const BOT =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|monitor|headless|lighthouse|gtmetrix|preview|curl|wget|python-requests|axios|http-client/i;

export function isBot(ua: string | null | undefined): boolean {
  return BOT.test(ua ?? '');
}

/** Most specific first: everything below claims to be everything above it. */
const BROWSERS: [RegExp, string][] = [
  [/edg(?:e|ios|a)?\//i, 'Edge'],
  [/opr\/|opera/i, 'Opera'],
  [/samsungbrowser/i, 'Samsung Internet'],
  [/firefox|fxios/i, 'Firefox'],
  [/chrome|crios|chromium/i, 'Chrome'],
  [/safari/i, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  // Before Linux: Android carries "Linux" in the same string.
  [/android/i, 'Android'],
  // Before macOS: an iPad's UA says "Mac OS X" too.
  [/iphone|ipad|ipod/i, 'iOS'],
  [/cros/i, 'ChromeOS'],
  [/windows|win64|win32/i, 'Windows'],
  [/mac os x|macintosh/i, 'macOS'],
  [/linux|ubuntu|fedora|debian/i, 'Linux'],
];

export type DeviceKind = 'Mobile' | 'Tablet' | 'Desktop';

export type Agent = { browser: string; os: string; device: DeviceKind };

/**
 * Browser, system and form factor, or "Unknown" for each part that could not be
 * told. Unknown is a real answer here and is kept as one: a breakdown chart
 * that quietly drops what it could not parse understates its own uncertainty.
 */
export function readAgent(ua: string | null | undefined): Agent {
  const s = ua ?? '';
  const found = (table: [RegExp, string][]) => table.find(([re]) => re.test(s))?.[1] ?? 'Unknown';

  return { browser: found(BROWSERS), os: found(SYSTEMS), device: readDevice(s) };
}

function readDevice(ua: string): DeviceKind {
  // An Android tablet is the awkward case: it says "Android" like a phone and
  // omits "Mobile", which is the only thing distinguishing the two.
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'Tablet';
  if (/mobi|iphone|ipod|android|blackberry|windows phone/i.test(ua)) return 'Mobile';
  return 'Desktop';
}

/**
 * A coarse device fingerprint for the identity graph.
 *
 * Deliberately coarse: browser, system and screen size, and nothing else. It is
 * only ever used to record a weak `co_occurrence` edge, which by design can
 * never merge two people. A sharper fingerprint would be a tracking device
 * rather than a hint, and it would still not be allowed to prove anything.
 */
export function deviceFingerprint(agent: Agent, screen: string | null | undefined): string {
  return [agent.browser, agent.os, agent.device, screen || 'unknown-screen'].join('|');
}

/**
 * The client IP, from the proxy chain.
 *
 * X-Forwarded-For is a comma-separated list appended to by each hop, so the
 * first entry is the original client and everything after it is infrastructure.
 * Taking the last entry — which reads more naturally as "the most recent truth"
 * — gets you the address of your own load balancer on every single request.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || null;
}
