import { getViewer } from '@/lib/supabase/server';
import { wealthSection } from '@/lib/nav';
import { AppShell } from '@/components/AppShell';

/**
 * Wealth Tracker.
 *
 * Its own route group so the shared shell is handed this tool's Section, and
 * the rail, the dock and the palette belong to it.
 */
export default async function WealthLayout({ children }: { children: React.ReactNode }) {
  // Open to everybody, signed in or not (lib/access). No organisation needed:
  // the work is a person's own, kept in their browser and their account.
  const { user, admin } = await getViewer();

  return (
    <AppShell user={user} admin={admin} section={wealthSection()}>
      {children}
    </AppShell>
  );
}
