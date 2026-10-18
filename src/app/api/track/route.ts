import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildHit } from '@/lib/analytics/hit';
import { clientIp } from '@/lib/analytics/ua';

/**
 * Where the tracker (components/Tracker) posts each page view and its time.
 *
 * The Supabase client here carries the visitor's own session cookie, so when
 * they are signed in `track_hit()` sees them through `auth.uid()` and joins
 * this browser, and everything it did before, to their account. The account is
 * never taken from the request body.
 *
 * Always answers 204: the tracker does not wait on it and has nothing to do
 * with an error, and a failure here must never surface on a page.
 */
export async function POST(request: Request) {
  const raw = await request.text().catch(() => '');
  if (raw.length > 8_000) return new NextResponse(null, { status: 204 });

  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const hit = buildHit(body, request.headers, clientIp(request.headers));
  if (hit) {
    const supabase = await createClient();
    await supabase.rpc('track_hit', { p: hit }).then(
      () => undefined,
      () => undefined,
    );
  }
  return new NextResponse(null, { status: 204 });
}
