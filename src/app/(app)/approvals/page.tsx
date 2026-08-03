import type { CSSProperties } from 'react';
import { Inbox, Layers, Timer, Wallet } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import {
  canApprove,
  canApproveVoucher,
  approvalBlockedReason,
  type VoucherLike,
} from '@/lib/domain/workflow';
import { ageInDays } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { Card, EmptyState } from '@/components/ui/primitives';
import { Figure } from '@/components/app/Figure';
import { ApprovalCard, type ApprovalRow } from './ApprovalCard';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Approvals' };

/** Waiting this long is worth flagging; twice this long is worth alarming about. */
const STALE_DAYS = 3;
const OVERDUE_DAYS = 7;

/**
 * The approval queue — the screen v1 had no equivalent of.
 *
 * Vouchers you cannot action (because you raised them, or already gave the first
 * approval) are still shown, greyed, with the reason spelled out. Hiding them would
 * leave an approver wondering where their voucher went.
 *
 * The three figures at the top exist because an approver's first question is not
 * "what is in the queue", it is "does this need an hour or five minutes". Depth,
 * value and the age of the head of the queue answer that without scrolling.
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
  const oldestDays = oldest ? ageInDays(oldest) : 0;
  const stale = actionable.filter((v) => ageInDays(v.submitted_at) >= STALE_DAYS).length;
  const missingInvoice = actionable.filter(
    (v) => (v.voucher_attachments?.length ?? 0) === 0,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Queue"
        title="Approvals"
        description={
          actionable.length === 0
            ? 'Nothing is waiting on you.'
            : 'Oldest first. The top of this list is what has been waiting longest.'
        }
      />

      {actionable.length > 0 && (
        <dl className="stagger grid gap-3 sm:grid-cols-3">
          <QueueStat
            label="Waiting on you"
            value={actionable.length}
            icon={<Layers className="size-4" />}
            note={
              missingInvoice > 0
                ? `${missingInvoice} with no invoice attached`
                : 'Every one has a document behind it'
            }
            tone={missingInvoice > 0 ? 'var(--status-warn)' : 'var(--status-pending)'}
          />
          <QueueStat
            label="Total value"
            value={totalValue}
            kind="rupees"
            icon={<Wallet className="size-4" />}
            note="Authorised by you, if you approve all of it"
            tone="var(--status-pending)"
            delay={90}
          />
          <QueueStat
            label="Longest waiting"
            value={oldestDays}
            suffix={oldestDays === 1 ? ' day' : ' days'}
            icon={<Timer className="size-4" />}
            note={stale > 1 ? `${stale} have waited ${STALE_DAYS} days or more` : 'The head of the queue'}
            tone={
              oldestDays >= OVERDUE_DAYS
                ? 'var(--status-rejected)'
                : oldestDays >= STALE_DAYS
                  ? 'var(--status-warn)'
                  : 'var(--status-approved)'
            }
            alarm={oldestDays >= OVERDUE_DAYS}
            delay={180}
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
        <section className="space-y-3 pt-2">
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

/**
 * One figure from the top of the queue.
 *
 * `tone` is not decoration: it is the same traffic light the cards below use, so
 * an amber "longest waiting" and an amber ageing chip on the third card down are
 * saying the same thing. `alarm` adds a lit top edge, and is reserved for a queue
 * that has genuinely been left too long.
 */
function QueueStat({
  label,
  value,
  kind = 'count',
  suffix,
  icon,
  note,
  tone,
  alarm = false,
  delay = 0,
}: {
  label: string;
  value: number;
  kind?: 'count' | 'rupees';
  suffix?: string;
  icon: React.ReactNode;
  note: string;
  tone: string;
  alarm?: boolean;
  delay?: number;
}) {
  return (
    <Card
      style={{ '--tone': tone } as CSSProperties}
      className="relative overflow-hidden p-4 sm:p-5"
    >
      {alarm && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,transparent,var(--tone),transparent)]"
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <dt className="a-label pt-1">{label}</dt>
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-xl border"
          style={{
            color: tone,
            borderColor: 'color-mix(in oklab, var(--tone) 30%, transparent)',
            background: 'color-mix(in oklab, var(--tone) 10%, transparent)',
          }}
        >
          {icon}
        </span>
      </div>
      <dd className="mt-3">
        <span className="flex items-baseline gap-1" style={{ color: alarm ? tone : undefined }}>
          <Figure value={value} kind={kind} delay={delay} className="text-3xl" />
          {suffix && <span className="text-muted text-sm font-medium">{suffix}</span>}
        </span>
        <p className="text-subtle mt-2 text-xs">{note}</p>
      </dd>
    </Card>
  );
}
