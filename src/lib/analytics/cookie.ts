/**
 * The one cookie this site sets, and how the server reads it.
 *
 * It holds a random identifier and nothing else — no email, no name, nothing
 * derived from anything a person typed. Its whole job is to be the same string
 * on Tuesday's anonymous visit and Thursday's sign-in, so that the two can be
 * recognised as one person's journey without either visit having to know about
 * the other.
 *
 * `SameSite=Lax` because it must survive somebody arriving from a link in an
 * email and must not be sent on a cross-site request. First-party, one year,
 * readable by our own JavaScript on purpose: the tracker writes it and the
 * server reads it, and there is no third party in that loop.
 */

export const VISITOR_COOKIE = 'fi_vid';

/**
 * Parsed by hand rather than through `cookies()`, because the two callers that
 * want it are a route handler holding a Request and the tracker's own beacon.
 * A UUID is all this is ever allowed to be, so anything that is not shaped like
 * one is discarded rather than passed along into a database function.
 */
export function readVisitorCookie(header: string | null | undefined): string | null {
  if (!header) return null;

  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== VISITOR_COOKIE) continue;

    const value = decodeURIComponent(rest.join('=')).trim();
    return /^[0-9a-f-]{8,64}$/i.test(value) ? value : null;
  }

  return null;
}
