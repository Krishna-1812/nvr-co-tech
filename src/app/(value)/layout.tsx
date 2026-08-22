import { requireOrgMember } from '@/lib/supabase/server';
import { valuationSection } from '@/lib/nav';
import { AppShell } from '@/components/AppShell';

/**
 * Valuation Desk.
 *
 * Its own route group, like Ledger Reconciliation and for the same reason: (app)
 * is Voucher Desk, and its rail carries an approval count and a New voucher
 * button, neither of which means anything while you are assembling a peer set.
 * All three groups render the same AppShell and differ only in the Section they
 * hand it.
 */
export default async function ValuationLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOrgMember();

  return (
    <AppShell user={user} section={valuationSection({ role: user.role })}>
      {children}
    </AppShell>
  );
}
