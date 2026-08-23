import { requireOrgMember } from '@/lib/supabase/server';
import { isAnalyticsAdmin } from '@/lib/analytics/admin';
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
 *
 * `canSeed` decides whether "Seed the registry" is even offered in the rail —
 * resolved from `isAnalyticsAdmin()`, the platform-wide allowlist, not from
 * `user.role`. That role is per-organisation, and "Seed the registry" writes
 * into the registry every organisation reads, so a tenant's own admin is the
 * wrong gate for it (see the comment on `valuationSection`). Memoised per
 * request, so asking again inside `AppShell` costs nothing.
 */
export default async function ValuationLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOrgMember();
  const canSeed = await isAnalyticsAdmin();

  return (
    <AppShell user={user} section={valuationSection({ canSeed })}>
      {children}
    </AppShell>
  );
}
