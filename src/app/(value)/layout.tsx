import { Layers } from 'lucide-react';
import { getViewer, requireUser } from '@/lib/supabase/server';
import { isAnalyticsAdmin } from '@/lib/analytics/admin';
import { canUseTool } from '@/lib/access';
import { lockedSection, valuationSection } from '@/lib/nav';
import { AppShell } from '@/components/AppShell';
import { LockedTool } from '@/components/access/LockedTool';

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
  // Admins only since the workspace opened (lib/access); see (app)/layout.
  const viewer = await getViewer();
  if (!canUseTool('valuation-desk', viewer.admin)) {
    return (
      <AppShell user={viewer.user} section={lockedSection('valuation-desk', 'Valuation Desk', '/comps', Layers)}>
        <LockedTool slug="valuation-desk" signedIn={!!viewer.user} name={viewer.user?.full_name} email={viewer.user?.authEmail} />
      </AppShell>
    );
  }
  // The registry is shared and readable by any session (0028); no
  // organisation is needed to read it.
  const user = await requireUser();
  const canSeed = await isAnalyticsAdmin();

  return (
    <AppShell user={user} admin section={valuationSection({ canSeed })}>
      {children}
    </AppShell>
  );
}
