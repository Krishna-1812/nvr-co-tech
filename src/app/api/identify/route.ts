import { NextResponse } from 'next/server';
import { readBody } from '@/lib/analytics/payload';
import { recordIdentity } from '@/lib/analytics/store';

/**
 * "This visitor is this person" — from a system, not from a browser.
 *
 * The way a CRM, a marketing platform or our own backend tells us who somebody
 * is, keyed by visitor id rather than by anything the visitor's own page could
 * assert. That is the whole reason it exists separately from the beacon: a
 * claim about somebody's identity should not be accepted from the same place
 * the identity is being claimed about.
 *
 * Which makes the shared secret the only thing standing between this endpoint
 * and anybody on the internet writing a name into the identity graph. So:
 *
 *   * With no secret configured it does not exist. A 404, not a 403 — an
 *     endpoint that announces it is disabled has still announced itself.
 *   * With one configured, the caller presents it and a mismatch is refused.
 *
 * Everything it writes is a `deterministic` edge, which is the strongest thing
 * the graph has and the only kind allowed to merge two identities. That is the
 * right classification — a CRM saying so is proof in the sense that matters —
 * and it is also exactly why the gate above is not optional.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.ANALYTICS_IDENTIFY_TOKEN;
  if (!secret) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const url = new URL(request.url);
  const offered = request.headers.get('x-identify-token') ?? url.searchParams.get('token');
  if (offered !== secret) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 403 });
  }

  const body = await readBody(request);
  const visitorId = typeof body.vid === 'string' ? body.vid.trim() : '';
  if (!visitorId) {
    return NextResponse.json({ error: 'vid is required.' }, { status: 400 });
  }

  const pick = (key: string) => {
    const value = body[key];
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null;
  };

  await recordIdentity({
    visitor_id: visitorId.slice(0, 64),
    full_name: pick('name'),
    email: pick('email'),
    company: pick('company'),
    title: pick('title'),
    crm_id: pick('crm_id'),
    source: pick('source') ?? 'provider',
  });

  return NextResponse.json({ ok: true });
}
