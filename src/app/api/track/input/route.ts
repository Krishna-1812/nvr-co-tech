import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MAX_RECORD, buildInput } from '@/lib/analytics/input';

/**
 * Where lib/analytics/capture posts what people enter: an open tool's record,
 * or a batch of fields filled and buttons pressed (migration 0036).
 *
 * Like /api/track, the Supabase client carries the visitor's own session, so
 * `track_input()` takes the account from `auth.uid()` and never from the
 * body, and it always answers 204, because nothing on a page waits on it.
 */
export async function POST(request: Request) {
  const raw = await request.text().catch(() => '');
  // The record itself, plus room for the envelope and JSON escaping.
  if (raw.length > MAX_RECORD * 1.2) return new NextResponse(null, { status: 204 });

  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const input = buildInput(body, request.headers.get('user-agent'));
  if (input) {
    const supabase = await createClient();
    await supabase.rpc('track_input', { p: input }).then(
      () => undefined,
      () => undefined,
    );
  }
  return new NextResponse(null, { status: 204 });
}
