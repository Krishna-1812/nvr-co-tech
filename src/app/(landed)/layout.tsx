import { requireOrgMember } from '@/lib/supabase/server';
import { landedSection } from '@/lib/nav';
import { AppShell } from '@/components/AppShell';

/**
 * Landed Cost.
 *
 * Its own route group for the same reason Ledger Reconciliation has one: the
 * shell is shared, and the Section handed to it is what makes the rail, the
 * dock and the palette belong to this tool rather than to Voucher Desk.
 */
export default async function LandedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOrgMember();

  return (
    <AppShell user={user} section={landedSection()}>
      {children}
    </AppShell>
  );
}
