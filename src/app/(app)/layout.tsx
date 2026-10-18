import { LayoutDashboard } from 'lucide-react';
import { requireOrgMember, createClient, getViewer } from '@/lib/supabase/server';
import { canApprove } from '@/lib/domain/workflow';
import { canUseTool } from '@/lib/access';
import { lockedSection, voucherSection } from '@/lib/nav';
import { AppShell } from '@/components/AppShell';
import { LockedTool } from '@/components/access/LockedTool';

/**
 * Voucher Desk.
 *
 * For a platform admin only since the workspace opened (lib/access). Anybody
 * else, signed in or not, gets the tool described and the request for it, on
 * every screen under here, so a deep link to a voucher lands on that too. Each
 * route handler and server action behind these screens asks the same question
 * again (`toolRefusal`), because a layout guards a screen and not a request.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!canUseTool('voucher-desk', viewer.admin)) {
    return (
      <AppShell user={viewer.user} section={lockedSection('voucher-desk', 'Voucher Desk', '/dashboard', LayoutDashboard)}>
        <LockedTool slug="voucher-desk" signedIn={!!viewer.user} name={viewer.user?.full_name} email={viewer.user?.authEmail} />
      </AppShell>
    );
  }
  const user = await requireOrgMember();

  // Queue badge: how many vouchers this person could actually action.
  let pendingCount = 0;
  if (canApprove(user.role)) {
    const supabase = await createClient();
    const { count } = await supabase
      .from('vouchers')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending_first', 'pending_second'])
      .is('deleted_at', null)
      // You can never approve your own voucher, so it should not inflate the badge.
      .neq('created_by', user.id);
    pendingCount = count ?? 0;
  }

  return (
    <AppShell user={user} admin section={voucherSection({ role: user.role, pendingCount })}>
      {children}
    </AppShell>
  );
}
