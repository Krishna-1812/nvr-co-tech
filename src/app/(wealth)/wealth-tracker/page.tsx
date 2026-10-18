import type { Metadata } from 'next';
import { getViewer } from '@/lib/supabase/server';
import { WealthWorkbench } from '@/components/wealth/WealthWorkbench';
import { WealthSave } from '@/components/access/ToolSave';

export const metadata: Metadata = { title: 'Wealth Tracker' };

/**
 * The tool. A server page holding client components: the record lives in the
 * reader's browser, so all the server supplies is who is signed in, which is
 * the key the record is kept under (`guest` for a visitor, who may use the
 * whole tool without an account — lib/access).
 */
export default async function WealthTrackerPage() {
  const { user } = await getViewer();
  const userId = user?.id ?? 'guest';
  const first = (user?.full_name ?? '').trim();
  return (
    <div className="space-y-4">
      <WealthSave userId={userId} signedIn={!!user} />
      <WealthWorkbench key={userId} userId={userId} selfName={first} signedIn={!!user} />
    </div>
  );
}
