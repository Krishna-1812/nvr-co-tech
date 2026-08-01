import { Inbox } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import {
  canApprove,
  canApproveVoucher,
  approvalBlockedReason,
  type VoucherLike,
} from '@/lib/domain/workflow';
import { EmptyState } from '@/components/ui/primitives';
import { ApprovalCard, type ApprovalRow } from './ApprovalCard';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Approvals · NVR Voucher' };

/**
 * The approval queue — the screen v1 had no equivalent of.
 *
 * Vouchers you cannot action (because you raised them, or already gave the
 * first approval) are still shown, greyed, with the reason spelled out. Hiding
 * them would leave an approver wondering where their voucher went.
 */
export default async function ApprovalsPage() {
  const user = await requireUser();
  if (!canApprove(user.role)) redirect('/');

  const supabase = await createClient();

  const { data: vouchers } = await supabase
    .from('vouchers')
    .select(
      `*,
       chapter:chapters!vouchers_chapter_id_fkey(name, code),
       initiator:profiles!vouchers_initiated_by_fkey(full_name, email),
       first_approver:profiles!vouchers_approver_1_fkey(full_name, email)`,
    )
    .in('status', ['pending_first', 'pending_second'])
    .is('deleted_at', null)
    // Oldest first: the queue is a queue, and ageing vouchers matter most.
    .order('submitted_at', { ascending: true });

  /*
   * The Database types are hand-written with empty Relationships, so supabase-js
   * cannot infer the shape of the embedded chapter/initiator/approver joins.
   * Assert it here — regenerating types from the live schema removes the need:
   *   npx supabase gen types typescript --project-id <ref>
   */
  const rows = (vouchers ?? []) as unknown as (ApprovalRow & VoucherLike)[];
  const me = { id: user.id, role: user.role };

  const actionable = rows.filter((v) => canApproveVoucher(v, me));
  const blocked = rows.filter((v) => !canApproveVoucher(v, me));

  const totalValue = actionable.reduce((sum, v) => sum + Number(v.grand_total ?? 0), 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
        <p className="text-muted mt-1 text-sm">
          {actionable.length === 0
            ? 'Nothing is waiting on you.'
            : `${actionable.length} voucher${actionable.length === 1 ? '' : 's'} waiting on you` +
              ` · ₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
      </header>

      {actionable.length === 0 && blocked.length === 0 ? (
        <div className="surface rounded-xl">
          <EmptyState
            icon={<Inbox className="size-8" />}
            title="Queue is clear"
            description="Vouchers submitted for approval will appear here, oldest first."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {actionable.map((v) => (
            <ApprovalCard key={v.id} voucher={v} currentUserId={user.id} />
          ))}
        </div>
      )}

      {blocked.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-subtle text-xs font-semibold tracking-wide uppercase">
            In the queue, but not yours to action ({blocked.length})
          </h2>
          {blocked.map((v) => (
            <ApprovalCard
              key={v.id}
              voucher={v}
              currentUserId={user.id}
              blockedReason={approvalBlockedReason(v, me) ?? undefined}
            />
          ))}
        </section>
      )}
    </div>
  );
}
