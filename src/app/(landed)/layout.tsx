import { getViewer } from '@/lib/supabase/server';
import { landedSection } from '@/lib/nav';
import { AppShell } from '@/components/AppShell';

/**
 * True Property Cost.
 *
 * Its own route group for the same reason Ledger Reconciliation has one: the
 * shell is shared, and the Section handed to it is what makes the rail, the
 * dock and the palette belong to this tool rather than to Voucher Desk.
 */
export default async function LandedLayout({ children }: { children: React.ReactNode }) {
  // Open to everybody, signed in or not (lib/access). No organisation needed:
  // the work is a person's own, kept in their browser and their account.
  const { user, admin } = await getViewer();

  return (
    <AppShell user={user} admin={admin} section={landedSection()}>
      {children}
    </AppShell>
  );
}
