import { NextResponse } from 'next/server';
import { readBody, visitorRow } from '@/lib/analytics/payload';
import { recordVisitorView } from '@/lib/analytics/store';
import { clientIp } from '@/lib/analytics/ua';

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
 * It answers `{ ok: true }` to everything, including its own failures. A
 * tracking endpoint that returns a 500 gets that 500 logged in somebody's
 * browser console on a marketing page, and the analytics are never worth that.
 * Nothing downstream reads the response anyway: `sendBeacon` cannot see it.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ok = () => NextResponse.json({ ok: true });

export async function POST(request: Request) {
  try {
    const body = await readBody(request);

    const row = visitorRow(body, {
      // The header, not the payload. A client claiming to be a different
      // browser is the one thing a client is in no position to be asked.
      ua: request.headers.get('user-agent'),
      ip: clientIp(request.headers),
    });

    // No visitor and no session means there is nothing this row could be about.
    if (row) await recordVisitorView(row);
  } catch {
    // Deliberately swallowed. See above.
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
