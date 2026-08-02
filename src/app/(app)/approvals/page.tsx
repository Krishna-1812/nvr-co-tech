import { Inbox } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import {
  canApprove,
  canApproveVoucher,
  approvalBlockedReason,
  type VoucherLike,
} from '@/lib/domain/workflow';
import { fmtRupees } from '@/lib/domain/voucher';
import { ageInDays } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { Card, EmptyState } from '@/components/ui/primitives';
import { ApprovalCard, type ApprovalRow } from './ApprovalCard';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Approvals' };

/**
 * The approval queue — the screen v1 had no equivalent of.
 *
 * Vouchers you cannot action (because you raised them, or already gave the
 * first approval) are still shown, greyed, with the reason spelled out. Hiding
 * them would leave an approver wondering where their voucher went.
 */
export default async function ApprovalsPage() {
  const user = await requireUser();
  if (!canApprove(user.role)) redirect('/dashboard');

  const supabase = await createClient();

  const { data: vouchers } = await supabase
    .from('vouchers')
    .select(
      `*,
       chapter:chapters!vouchers_chapter_id_fkey(name, code),
       initiator:profiles!vouchers_initiated_by_fkey(full_name, email),
       first_approver:profiles!vouchers_approver_1_fkey(full_name, email),
       voucher_attachments(id)`,
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
  // The queue is ordered oldest first, so the head of it is the one ageing.
  const oldest = actionable[0]?.submitted_at ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Queue"
        title="Approvals"
        description={
          actionable.length === 0
            ? 'Nothing is waiting on you.'
            : 'Oldest first — the top of this list is what has been waiting longest.'
        }
      />

      {/*
        Depth, value and age, before any individual voucher. An approver's first
        question is whether the queue needs an hour or five minutes, and that is
        answered by these three numbers rather than by scrolling.
      */}
      {actionable.length > 0 && (
        <dl className="stagger grid gap-3 sm:grid-cols-3">
          <QueueStat label="Waiting on you" value={String(actionable.length)} />
          <QueueStat label="Total value" value={fmtRupees(totalValue)} />
          <QueueStat
            label="Longest waiting"
            value={oldest ? `${ageInDays(oldest)} days` : '—'}
            tone={oldest && ageInDays(oldest) >= 7 ? 'var(--status-rejected)' : undefined}
          />
        </dl>
      )}

      {actionable.length === 0 && blocked.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="Queue is clear"
            description="Vouchers submitted for approval will appear here, oldest first."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {actionable.map((v) => (
            <ApprovalCard key={v.id} voucher={v} currentUserId={user.id} />
          ))}
        </div>
      )}

      {blocked.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-subtle flex items-center gap-3 text-[11px] font-semibold tracking-[0.06em] uppercase">
            In the queue, but not yours to action ({blocked.length})
            <span aria-hidden className="h-px flex-1 bg-[var(--border-c)]" />
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

/** One figure from the top of the queue. Tone marks a number that is a problem. */
function QueueStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="p-4">
      <dt className="text-muted text-[11px] font-semibold tracking-[0.06em] uppercase">{label}</dt>
      <dd className="amount mt-1.5 text-2xl font-bold" style={tone ? { color: tone } : undefined}>
        {value}
      </dd>
    </Card>
  );
}
