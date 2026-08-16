import { requireOrgMember, createClient } from '@/lib/supabase/server';
import { canApprove } from '@/lib/domain/workflow';
import { voucherSection } from '@/lib/nav';
import { AppShell } from '@/components/AppShell';

/** Voucher Desk. Middleware has already guaranteed a session. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
    <AppShell user={user} section={voucherSection({ role: user.role, pendingCount })}>
      {children}
    </AppShell>
  );
}
