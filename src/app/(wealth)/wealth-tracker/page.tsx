import type { Metadata } from 'next';
import { requireOrgMember } from '@/lib/supabase/server';
import { WealthWorkbench } from '@/components/wealth/WealthWorkbench';

export const metadata: Metadata = { title: 'Wealth Tracker' };

/**
 * The tool. A server page holding one client component: the record lives in
 * the reader's browser, so all the server supplies is who is signed in, which
 * is the key the record is kept under.
 */
export default async function WealthTrackerPage() {
  const user = await requireOrgMember();
  const first = (user.full_name ?? '').trim();
  return <WealthWorkbench userId={user.id} selfName={first} />;
}
