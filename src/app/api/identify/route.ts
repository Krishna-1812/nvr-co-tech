import { NextResponse } from 'next/server';
import { readBody } from '@/lib/analytics/payload';
import { recordIdentity } from '@/lib/analytics/store';
import { clientIp } from '@/lib/analytics/ua';
import { checkRateLimit } from '@/lib/ratelimit';
import { logServerError } from '@/lib/errors/server';

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
 *
 * Unlike the beacon, a caller here is a system rather than a visitor's browser,
 * so a real 429 is the right answer to too many requests — the whole point is
 * for whatever is calling this to learn to back off. The limit is keyed by
 * address rather than by the token, since the token is the one thing a caller
 * without it is trying to guess.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMIT = 20;
const WINDOW_SECONDS = 300;

export async function POST(request: Request) {
  const secret = process.env.ANALYTICS_IDENTIFY_TOKEN;
  if (!secret) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const ip = clientIp(request.headers);
  const rate = await checkRateLimit(`identify:${ip ?? 'unknown'}`, LIMIT, WINDOW_SECONDS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'retry-after': String(rate.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url);
  const offered = request.headers.get('x-identify-token') ?? url.searchParams.get('token');
  if (offered !== secret) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 403 });
  }

  try {
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
  } catch (error) {
    await logServerError({
      route: '/api/identify',
      message: error instanceof Error ? error.message : 'Unknown error in /api/identify',
      stack: error instanceof Error ? error.stack : null,
    });
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
