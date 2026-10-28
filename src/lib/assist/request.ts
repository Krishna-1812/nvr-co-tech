/**
 * Two questions about who sent a request, for the chat anybody can use.
 */

/**
 * Whether a request came from a page on this site.
 *
 * Not a security control: anybody with a terminal can send whatever Origin they
 * like. What it stops is the cheap abuse, which is somebody else's web page
 * quietly using this chat (and this key) from its visitors' browsers. Browsers
 * always send Origin on a cross-site POST and never let a page forge it.
 *
 * A request with no Origin at all is let through only when the browser's own
 * fetch metadata says it is not cross-site; older browsers and some privacy
 * settings send neither, and those are let through, since the rate limits are
 * what actually bound the cost.
 */
export function fromThisSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return request.headers.get('sec-fetch-site') !== 'cross-site';

  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }

  const ours = [request.headers.get('x-forwarded-host'), request.headers.get('host')];
  try {
    ours.push(new URL(request.url).host);
  } catch {
    // A relative URL in a test; the headers are enough.
  }
  return ours.some((h) => h && h.split(',')[0].trim() === host);
}

/**
 * The address to count a visitor's questions against.
 *
 * The first entry of x-forwarded-for, which the host sets to the address the
 * connection came from (Vercel overwrites whatever the client sent). Several
 * people behind one office or one mobile carrier share an address; the limit is
 * set high enough for a few of them asking at once.
 */
export function visitorAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}
