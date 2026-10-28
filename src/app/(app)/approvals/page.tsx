import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CheckCheck, Eye, Timer } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { personCols, tolerateMissingColumns } from '@/lib/supabase/columns';
import {
  canApprove,
  canApproveVoucher,
  approvalBlockedReason,
  type VoucherLike,
} from '@/lib/domain/workflow';
import { fmtRupees } from '@/lib/domain/voucher';
import { ageInDays } from '@/lib/utils';
import { buttonClass } from '@/components/ui/primitives';
import { ToolHero, HeroStat, HeroChip } from '@/components/ui/ToolHero';
import { ArchScene, SealFigure } from '@/components/ui/Scene';
import { ApprovalCard, type ApprovalRow } from './ApprovalCard';

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

  const { data: vouchers } = await tolerateMissingColumns(() =>
    supabase
      .from('vouchers')
      .select(
        `*,
         chapter:chapters!vouchers_chapter_id_fkey(name, code),
         initiator:profiles!vouchers_initiated_by_fkey(${personCols()}),
         first_approver:profiles!vouchers_approver_1_fkey(${personCols()}),
         voucher_attachments(id)`,
      )
      .in('status', ['pending_first', 'pending_second'])
      .is('deleted_at', null)
      // Oldest first: the queue is a queue, and ageing vouchers matter most.
      .order('submitted_at', { ascending: true }),
  );

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

  /*
   * The queue's value by how long it has waited, for the bar under the hero.
   * The same three bands as the card rails and the age chips (fresh, ageing,
   * overdue), so the amber in the bar and the amber on the third card down are
   * one fact. Bands with nothing in them are dropped rather than drawn as a
   * sliver.
   */
  const bands = [
    {
      key: 'fresh',
      label: `Under ${STALE_DAYS} days`,
      tone: 'var(--status-approved)',
      rows: actionable.filter((v) => ageInDays(v.submitted_at) < STALE_DAYS),
    },
    {
      key: 'ageing',
      label: `${STALE_DAYS} to ${OVERDUE_DAYS - 1} days`,
      tone: 'var(--status-warn)',
      rows: actionable.filter((v) => {
        const d = ageInDays(v.submitted_at);
        return d >= STALE_DAYS && d < OVERDUE_DAYS;
      }),
    },
    {
      key: 'overdue',
      label: `${OVERDUE_DAYS} days or more`,
      tone: 'var(--status-rejected)',
      rows: actionable.filter((v) => ageInDays(v.submitted_at) >= OVERDUE_DAYS),
    },
  ]
    .map((b) => ({ ...b, value: b.rows.reduce((s, v) => s + Number(v.grand_total ?? 0), 0) }))
    .filter((b) => b.rows.length > 0);

  const ageTone =
    oldestDays >= OVERDUE_DAYS
      ? 'var(--status-rejected)'
      : oldestDays >= STALE_DAYS
        ? 'var(--status-warn)'
        : 'var(--status-approved)';
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
  const count = actionable.length;

  return (
    <div className="space-y-6">
      {/*
        The answer first, as every tool now opens: how deep the queue is, what it
        is worth, how long its head has waited. Those three used to be a row of
        cards under a plain title; they are the hero's sentence and its working
        now, because an approver's first question is not "what is in the queue",
        it is "does this need an hour or five minutes".
      */}
      {count > 0 ? (
        <ToolHero
          id="queue"
          label="Approvals · oldest first"
          pill={{
            icon: Timer,
            text: oldestDays === 0 ? 'All raised today' : `Oldest ${days(oldestDays)}`,
            tone: ageTone,
            live: true,
          }}
          title={`${count === 1 ? 'One voucher is' : `${count} vouchers are`} waiting on you.`}
          glow={ageTone}
          sub={
            <>
              <span className="numeric font-semibold text-[var(--text-c)]">
                {fmtRupees(totalValue)}
              </span>{' '}
              in all, authorised by you if you approve every one.{' '}
              {oldestDays === 0
                ? 'Everything here arrived today.'
                : `The oldest has waited ${days(oldestDays)}.`}
            </>
          }
          scene={
            <ArchScene
              motif="voucher"
              className="h-full min-h-[18rem]"
              seal={
                oldestDays > 0 ? (
                  <SealFigure value={days(oldestDays)} note="the longest wait" />
                ) : undefined
              }
            />
          }
        >
          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            <HeroStat
              label="Waiting"
              value={count}
              note={
                missingInvoice > 0
                  ? `${missingInvoice} with no invoice attached`
                  : 'Every one has a document'
              }
              tone={missingInvoice > 0 ? 'var(--status-warn)' : undefined}
            />
            <HeroStat
              label="Longest wait"
              value={days(oldestDays)}
              note={
                stale > 1 ? `${stale} have waited ${STALE_DAYS} days or more` : 'The head of the queue'
              }
              tone={ageTone}
            />
            <HeroStat
              label="Queue value"
              value={fmtRupees(totalValue)}
              note="If you approve all of it"
              strong
              className="col-span-2 sm:col-span-1"
            />
          </div>

          {/* What the money has been waiting, in one bar: 2px gaps, and a legend
              under it with each band's value and count in words. */}
          {totalValue > 0 && (
            <div className="mt-7">
              <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
                {bands.map((b, i) => (
                  <span
                    key={b.key}
                    title={`${b.label}: ${fmtRupees(b.value)}`}
                    className="a-fill h-full"
                    style={{
                      flexGrow: Math.max(b.value, totalValue * 0.02),
                      flexBasis: 0,
                      background: b.tone,
                      animationDelay: `${150 + i * 120}ms`,
                    }}
                  />
                ))}
              </div>
              <dl className="mt-3.5 grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                {bands.map((b) => (
                  <div key={b.key} className="flex items-baseline justify-between gap-3 sm:block">
                    <dt className="text-muted inline-flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 rounded-[3px]"
                        style={{ background: b.tone }}
                      />
                      Waiting {b.label.toLowerCase()}
                    </dt>
                    <dd className="mt-0.5 font-semibold tabular-nums sm:pl-[1.125rem]">
                      {fmtRupees(b.value)}{' '}
                      <span className="text-subtle font-normal">
                        · {b.rows.length} {b.rows.length === 1 ? 'voucher' : 'vouchers'}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {blocked.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-2">
              <HeroChip icon={Eye}>
                {blocked.length} more in the queue, waiting on someone else
              </HeroChip>
            </div>
          )}
        </ToolHero>
      ) : (
        <ToolHero
          id="queue"
          label="Approvals"
          pill={{ icon: CheckCheck, text: 'Queue clear', tone: 'var(--status-approved)' }}
          title="Nothing is waiting on you."
          sub={
            blocked.length > 0
              ? `${blocked.length === 1 ? 'One voucher is' : `${blocked.length} vouchers are`} in the queue, but not yours to action. They are listed below so you can see where they stand.`
              : 'Vouchers submitted for approval appear here, oldest first, the moment they are sent.'
          }
          scene={<ArchScene motif="voucher" className="h-full min-h-[18rem]" />}
        >
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link href="/vouchers" className={buttonClass({ className: 'group' })}>
              Open the register
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>
        </ToolHero>
      )}

      {count > 0 && (
        <section aria-labelledby="queue-list" className="space-y-3">
          <h2
            id="queue-list"
            className="text-subtle flex items-center gap-3 text-[11px] font-semibold tracking-[0.06em] uppercase"
          >
            Yours to decide ({count})
            <span aria-hidden className="h-px flex-1 bg-[var(--border-c)]" />
          </h2>
          <div className="stagger space-y-3">
            {actionable.map((v) => (
              <ApprovalCard key={v.id} voucher={v} currentUserId={user.id} />
            ))}
          </div>
        </section>
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
