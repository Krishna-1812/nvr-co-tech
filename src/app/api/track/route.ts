import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/supabase/server';
import { readBody, pageViewRow } from '@/lib/analytics/payload';
import { recordPageView, recordIdentity } from '@/lib/analytics/store';
import { clientIp } from '@/lib/analytics/ua';
import { readVisitorCookie } from '@/lib/analytics/cookie';

/**
 * How long a signed-in person spent on a page.
 *
 * The counterpart to /api/atrack, and the reason both exist rather than one: on
 * the public site we know a browser, and here we know a person. The join
 * between them is the visitor id, which is read from the cookie on this
 * request rather than from the body — the browser is not the right place to be
 * asked who it is.
 *
 * That cookie is also what makes the identification retroactive. Somebody reads
 * four pages of the marketing site anonymously on Tuesday and signs in on
 * Thursday; the same id was carried through both, so Tuesday becomes theirs.
 * This endpoint is where that link is written down.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const user = await getCurrentUser();
    const visitorId = readVisitorCookie(request.headers.get('cookie'));

    const row = pageViewRow(body, {
      ua: request.headers.get('user-agent'),
      ip: clientIp(request.headers),
      // The session, not the body. A page-view endpoint that accepts an email
      // from its caller is an endpoint that will be sent somebody else's.
      email: user?.authEmail ?? user?.email ?? null,
      visitorId,
    });

    if (row) await recordPageView(row);

    /*
     * A signed-in page view is proof of identity, so it is also an
     * identification — the same class of evidence as a form submission. Written
     * every time rather than only on sign-in, because the cookie can be cleared
     * and reissued between sessions and each new id needs its own link to the
     * person; the graph deduplicates repeats itself.
     */
    if (row && visitorId && user) {
      await recordIdentity({
        visitor_id: visitorId,
        email: user.authEmail ?? user.email,
        full_name: user.full_name,
        source: 'sign_in',
      });
    }
  } catch {
    // Never worth a failure on a page somebody is using.
  }

  return NextResponse.json({ ok: true });
}
