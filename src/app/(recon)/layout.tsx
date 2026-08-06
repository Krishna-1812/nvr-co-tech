import { requireUser } from '@/lib/supabase/server';
import { reconSection } from '@/lib/nav';
import { AppShell } from '@/components/AppShell';

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
  const user = await requireUser();

  return (
    <AppShell user={user} section={reconSection()}>
      {children}
    </AppShell>
  );
}
