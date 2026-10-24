import type { Metadata } from 'next';
import { getViewer } from '@/lib/supabase/server';
import { WillWorkbench } from '@/components/will/WillWorkbench';

export const metadata: Metadata = { title: 'Will Maker', robots: { index: false, follow: false } };

/**
 * The tool. A server page holding client components: the draft lives in the
 * reader's browser, so all the server supplies is who is signed in, which is
 * the key the draft is kept under (`guest` for a visitor).
 */
export default async function WillMakerPage() {
  const { user } = await getViewer();
  const userId = user?.id ?? 'guest';
  return <WillWorkbench key={userId} userId={userId} selfName={(user?.full_name ?? '').trim()} signedIn={!!user} email={user?.email ?? ''} />;
}
