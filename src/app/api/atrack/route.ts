import { NextResponse } from 'next/server';
import { readBody, visitorRow } from '@/lib/analytics/payload';
import { recordVisitorView } from '@/lib/analytics/store';
import { clientIp } from '@/lib/analytics/ua';
import { checkRateLimit } from '@/lib/ratelimit';
import { logServerError } from '@/lib/errors/server';

/**
 * Where the anonymous beacon lands.
 *
 * Public and unauthenticated, because an anonymous visitor has no session by
 * definition. What stops that being a hole is on the other side: this endpoint
 * cannot write to `visitor_analytics` directly, and neither can anybody holding
 * the publishable key. The table has no insert policy at all, and the only door
 * is a SECURITY DEFINER function that decides for itself what a row may contain.
 * See migration 0010.
 *
 * It answers `{ ok: true }` to everything, including its own failures and its
 * own rate limit. A tracking endpoint that returns anything else gets that
 * logged in somebody's browser console on a marketing page, and the analytics
 * are never worth that. Nothing downstream reads the response anyway:
 * `sendBeacon` cannot see it. An excess of requests from one address is simply
 * not recorded rather than refused, and a genuine failure is written to
 * error_log instead of being lost — see migration 0011.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Generous: real traffic from one address is a handful of page views a minute. */
const LIMIT = 120;
const WINDOW_SECONDS = 300;

const ok = () => NextResponse.json({ ok: true });

export async function POST(request: Request) {
  try {
    const ip = clientIp(request.headers);
    const rate = await checkRateLimit(`atrack:${ip ?? 'unknown'}`, LIMIT, WINDOW_SECONDS);
    if (!rate.allowed) return ok();

    const body = await readBody(request);

    const row = visitorRow(body, {
      // The header, not the payload. A client claiming to be a different
      // browser is the one thing a client is in no position to be asked.
      ua: request.headers.get('user-agent'),
      ip,
    });

    // No visitor and no session means there is nothing this row could be about.
    if (row) await recordVisitorView(row);
  } catch (error) {
    await logServerError({
      route: '/api/atrack',
      message: error instanceof Error ? error.message : 'Unknown error in /api/atrack',
      stack: error instanceof Error ? error.stack : null,
    });
  }

  return ok();
}

/**
 * Some browsers preflight a beacon depending on how it was sent. Answering here
 * costs nothing and saves an unexplained failure on one browser in ten.
 */
export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
