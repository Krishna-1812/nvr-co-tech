import { Scale } from 'lucide-react';
import { getViewer, requireUser } from '@/lib/supabase/server';
import { canUseTool } from '@/lib/access';
import { lockedSection, reconSection } from '@/lib/nav';
import { AppShell } from '@/components/AppShell';
import { LockedTool } from '@/components/access/LockedTool';

/**
 * Ledger Reconciliation.
 *
 * Its own route group rather than a page under (app), for the same reason the
 * workspace has one: (app) is Voucher Desk, and that layout carries a rail of
 * voucher destinations, an approval count and a New voucher button, none of
 * which mean anything while you are matching two ledgers. Both groups render the
 * same AppShell and differ only in the Section they hand it.
 */
export default async function ReconLayout({ children }: { children: React.ReactNode }) {
  // Admins only since the workspace opened (lib/access); see (app)/layout.
  const viewer = await getViewer();
  if (!canUseTool('ledger-reconciliation', viewer.admin, viewer.grants)) {
    return (
      <AppShell user={viewer.user} section={lockedSection('ledger-reconciliation', 'Ledger Reconciliation', '/reconcile', Scale)}>
        <LockedTool slug="ledger-reconciliation" signedIn={!!viewer.user} name={viewer.user?.full_name} email={viewer.user?.authEmail} />
      </AppShell>
    );
  }
  // A session, not an organisation: a reconciliation is its creator's alone
  // (0008), so belonging to a firm is not a condition of running one.
  const user = await requireUser();

  return (
    <AppShell user={user} admin={viewer.admin} section={reconSection()}>
      {children}
    </AppShell>
  );
}
