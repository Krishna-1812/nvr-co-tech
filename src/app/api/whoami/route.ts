import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/supabase/server';
import { isAnalyticsAdmin } from '@/lib/analytics/admin';

/**
 * Who is signed in, and may they see the analytics.
 *
 * One endpoint answering both, and that is the point rather than a convenience.
 * Any surface that needs to show or hide an admin-only control reads this flag
 * instead of keeping its own copy of the allowlist — and the flag itself comes
 * from the same Postgres function the row-level policies call, so what this
 * says and what the database will actually hand over cannot disagree.
 *
 * A duplicated admin list is the easiest way for gated interface to drift out of
 * sync with gated data, and the drift is silent: the menu item appears, the
 * page opens, and every table on it is empty.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ signedIn: false, isAdmin: false });
  }

  return NextResponse.json({
    signedIn: true,
    name: user.full_name,
    email: user.authEmail ?? user.email,
    avatar: user.avatarUrl ?? null,
    role: user.role,
    isAdmin: await isAnalyticsAdmin(),
  });
}
