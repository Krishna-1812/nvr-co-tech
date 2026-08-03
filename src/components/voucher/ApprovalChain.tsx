import type { CSSProperties } from 'react';
import { Check, PenLine, Undo2, Wallet } from 'lucide-react';
import { fmtDate } from '@/lib/domain/voucher';
import type { VoucherStatus } from '@/lib/domain/workflow';
import { cn } from '@/lib/utils';

/**
 * The chain of custody for one voucher, drawn as four rungs on a rail.
 *
 * This replaced a stack of three labelled rows in a sidebar. The reason it is
 * worth the space is that a payment voucher is not a record with some approval
 * fields on it — it is a sequence of four acts by up to four different people,
 * and the thing anyone opening this page wants to know is which act is next and
 * who owes it. A row of rungs says that; a definition list does not.
 *
 * A rung that has not happened is drawn, not omitted. An outstanding approval is
 * the single most useful fact on this page, and it has to occupy space to be seen.
 *
 * A sent-back voucher gets a fifth state rather than a fifth rung: the two approval
 * rungs go back to empty (Postgres genuinely voids them) and a red marker sits where
 * the chain broke, because "returned to the start" is what actually happened.
 */

type Step = {
  key: string;
  label: string;
  icon: typeof Check;
  who: string | null;
  when: string;
  done: boolean;
};

export function ApprovalChain({
  status,
  raisedBy,
  raisedAt,
  firstApprover,
  firstAt,
  secondApprover,
  secondAt,
  paidAt,
  utr,
  rejectedBy,
}: {
  status: VoucherStatus;
  raisedBy: string | null;
  raisedAt: string | null;
  firstApprover: string | null;
  firstAt: string | null;
  secondApprover: string | null;
  secondAt: string | null;
  paidAt: string | null;
  utr: string | null;
  rejectedBy: string | null;
}) {
  const rejected = status === 'rejected';

  const steps: Step[] = [
    {
      key: 'raised',
      label: 'Raised',
      icon: PenLine,
      who: raisedBy,
      when: fmtDate(raisedAt),
      done: Boolean(raisedBy),
    },
    {
      key: 'first',
      label: 'First approval',
      icon: Check,
      who: firstApprover,
      when: fmtDate(firstAt),
      done: Boolean(firstApprover),
    },
    {
      key: 'second',
      label: 'Second approval',
      icon: Check,
      who: secondApprover,
      when: fmtDate(secondAt),
      done: Boolean(secondApprover),
    },
    {
      key: 'paid',
      label: 'Paid',
      icon: Wallet,
      who: status === 'paid' ? (utr ? `UTR ${utr}` : 'Recorded') : null,
      when: fmtDate(paidAt),
      done: status === 'paid',
    },
  ];

  // The rung the voucher is currently sitting on. -1 when it is finished, or when
  // it has been sent back and is not sitting anywhere.
  const next = rejected ? -1 : steps.findIndex((s) => !s.done);

  return (
    <div>
      <ol className="grid gap-x-2 gap-y-5 sm:grid-cols-4">
        {steps.map((step, i) => (
          <li key={step.key} className="relative min-w-0">
            {/*
              The connector to the next rung. Lit only as far as the chain has
              actually got, so the unlit remainder is the work outstanding.
              Horizontal from `sm` up; below that the rungs stack and the
              connector would be pointing the wrong way, so it is dropped.
            */}
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className="absolute top-[13px] left-[calc(50%+1.25rem)] hidden h-px w-[calc(100%-2.5rem)] sm:block"
                style={{
                  background: steps[i + 1].done
                    ? 'var(--status-approved)'
                    : rejected && i === 0
                      ? 'var(--status-rejected)'
                      : 'var(--border-strong)',
                  opacity: steps[i + 1].done ? 0.55 : 1,
                }}
              />
            )}

            <div className="flex items-start gap-3 sm:flex-col sm:items-center sm:text-center">
              <Node step={step} isNext={i === next} broke={rejected && i === 1} />
              <div className="min-w-0 sm:mt-3 sm:w-full">
                <p className="a-label truncate">{step.label}</p>
                {step.done ? (
                  <>
                    <p className="mt-1 truncate text-[13px] font-semibold">{step.who}</p>
                    {step.when && (
                      <p className="text-subtle numeric mt-0.5 text-[11px]">{step.when}</p>
                    )}
                  </>
                ) : rejected && i === 1 ? (
                  <p
                    className="mt-1 truncate text-[13px] font-semibold"
                    style={{ color: 'var(--status-rejected)' }}
                  >
                    Sent back{rejectedBy ? ` by ${rejectedBy}` : ''}
                  </p>
                ) : (
                  <p className="text-subtle mt-1 text-[13px]">
                    {i === next ? 'Waiting' : 'Not yet'}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * One rung. Three states worth distinguishing: done, being waited on, and not yet
 * — plus the broken rung on a sent-back voucher. The waiting rung gets a soft halo
 * so it is findable in a glance at the row.
 */
function Node({
  step,
  isNext,
  broke,
}: {
  step: Step;
  isNext: boolean;
  broke: boolean;
}) {
  if (broke) {
    return (
      <span
        aria-hidden
        style={{ '--tone': 'var(--status-rejected)' } as CSSProperties}
        className="tinted grid size-7 shrink-0 place-items-center rounded-full border"
      >
        <Undo2 className="size-3.5" />
      </span>
    );
  }

  if (step.done) {
    return (
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full text-white"
        style={{
          background: 'var(--status-approved)',
          boxShadow: '0 4px 12px color-mix(in oklab, var(--status-approved) 35%, transparent)',
        }}
      >
        <step.icon className="size-3.5" strokeWidth={3} />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-full border-2 border-dashed',
        isNext
          ? 'a-blip border-[var(--status-pending)] ring-4 ring-[color-mix(in_oklab,var(--status-pending)_14%,transparent)]'
          : 'border-[var(--border-strong)]',
      )}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: isNext ? 'var(--status-pending)' : 'var(--border-strong)' }}
      />
    </span>
  );
}
