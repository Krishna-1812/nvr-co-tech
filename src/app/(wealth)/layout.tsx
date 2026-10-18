import { requireOrgMember } from '@/lib/supabase/server';
import { wealthSection } from '@/lib/nav';
import { AppShell } from '@/components/AppShell';

/**
 * Wealth Tracker.
 *
 * Its own route group so the shared shell is handed this tool's Section, and
 * the rail, the dock and the palette belong to it.
 */
export default async function WealthLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOrgMember();

  return (
    <AppShell user={user} section={wealthSection()}>
      {children}
    </AppShell>
  );
}
