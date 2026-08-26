import { NextResponse } from 'next/server';
import { requireFinder } from '@/lib/finder/gate';

/**
 * What this tool has spent.
 *
 * Deliberately **not** a balance. No endpoint reachable with this key reports
 * the account total — Apollo's usage endpoint returns per-endpoint rate limits
 * and wants a master key this platform does not hold — and the same key funds
 * other features besides, so a figure called "remaining" would be a guess
 * dressed as a reading. What the ledger knows exactly is what Contact Finder
 * spent, and that is all it claims.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireFinder();
  if (!gate.ok) return gate.response;

  // IST, because the workspace runs on it and "today" has to mean the same day
  // here as it does in the header of every other screen.
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
  const today = now.slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01T00:00:00+05:30`;
  const dayStart = `${today}T00:00:00+05:30`;

  const { data, error } = await gate.supabase
    .from('finder_credit_ledger')
    .select('action, credits, created_at')
    .gte('created_at', monthStart)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    console.warn(`finder: credit read failed: ${error.message}`);
    return NextResponse.json({ available: false, month: 0, today: 0, by_action: {} });
  }

  let month = 0;
  let day = 0;
  const byAction: Record<string, number> = {};

  for (const row of data ?? []) {
    const credits = row.credits ?? 0;
    month += credits;
    if (row.created_at >= dayStart) day += credits;
    byAction[row.action] = (byAction[row.action] ?? 0) + credits;
  }

  return NextResponse.json({ available: true, month, today: day, by_action: byAction });
}
