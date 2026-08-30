import type { CSSProperties } from 'react';
import { Check, PenLine, Undo2, Wallet } from 'lucide-react';
import { fmtDate } from '@/lib/domain/voucher';
import type { PersonRef } from '@/lib/domain/rows';
import type { VoucherStatus } from '@/lib/domain/workflow';
import { Avatar } from '@/components/Avatar';
import { cn } from '@/lib/utils';

/**
 * The chain of custody for one voucher: raised, approved, paid.
 *
 * This replaced a stack of three labelled rows in a sidebar. The reason it is
 * worth the space is that a payment voucher is not a record with some approval
 * fields on it. It is a sequence of acts by different people, and the thing
 * anyone opening this page wants to know is which act is next and who owes it. A
 * row of rungs says that; a definition list does not.
 *
 * A rung that has not happened is drawn, not omitted. An outstanding approval is
 * the single most useful fact on this page, and it has to occupy space to be seen.
 *
 * A sent-back voucher gets an extra state rather than an extra rung: the approval
 * rung goes back to empty (Postgres genuinely voids it) and a red marker sits
 * where the chain broke, because "returned to the start" is what actually
 * happened.
 *
 * ── Why there is no second-approval rung any more ───────────────────────────
 *
 * There was one, and it drew for every voucher. One signature has been all a
 * voucher needs since 0015, so on anything raised since then that rung could
 * never fill: a voucher waiting in the queue showed two outstanding approvals
 * when one was outstanding, and a finished voucher spent a quarter of this
 * component explaining that a step did not apply to it. A rung whose only
 * possible caption is "not required" is not information.
 *
 * It is still drawn for a voucher that genuinely has a second approval, or is
 * still sitting in pending_second, both of which mean it entered the queue
 * before 0015. Those rows are real and their history has to be readable. The
 * labels change with it: with one rung the act is "Approved", and only a chain
 * that really has two calls them first and second.
 *
 * An organization can also turn approval off entirely (0013), and then the
 * approval rung is marked skipped rather than waiting once the voucher settles,
 * because there is nobody to wait on.
 */

type Step = {
  key: string;
  label: string;
  icon: typeof Check;
  /** Whose act this was. Drawn as their face on the rung. */
  person: PersonRef;
  /** The caption under the rung: a name, or for the payment, its reference. */
  who: string | null;
  when: string;
  done: boolean;
  /** Nothing is ever going to fill this rung — draw it "not required", not "waiting". */
  skip?: boolean;
};

/** The name to print for somebody, when their picture is not enough. */
const nameOf = (p: PersonRef) => p?.full_name ?? p?.email ?? null;

export function ApprovalChain({
  status,
  raisedBy,
  raisedAt,
  firstApprover,
  firstAt,
  secondApprover,
  secondAt,
  paidBy,
  paidAt,
  utr,
  rejectedBy,
}: {
  status: VoucherStatus;
  raisedBy: PersonRef;
  raisedAt: string | null;
  firstApprover: PersonRef;
  firstAt: string | null;
  secondApprover: PersonRef;
  secondAt: string | null;
  paidBy: PersonRef;
  paidAt: string | null;
  utr: string | null;
  rejectedBy: PersonRef;
}) {
  const rejected = status === 'rejected';
  // Nothing further is coming once a voucher is approved or paid, so an approval
  // rung still empty at that point was never going to fill.
  const finalized = status === 'approved' || status === 'paid';

  /*
   * Only a voucher from before 0015 can have a second approval to show. Three
   * separate signs of it, because a row can be at any point in that old flow: it
   * has the approver, or it has the timestamp, or it is still sitting in the
   * status that waits for one.
   */
  const twoStage =
    Boolean(secondApprover) || Boolean(secondAt) || status === 'pending_second';

  const steps: Step[] = [
    {
      key: 'raised',
      label: 'Raised',
      icon: PenLine,
      person: raisedBy,
      who: nameOf(raisedBy),
      when: fmtDate(raisedAt),
      done: Boolean(raisedBy),
    },
    {
      key: 'first',
      label: twoStage ? 'First approval' : 'Approved',
      icon: Check,
      person: firstApprover,
      who: nameOf(firstApprover),
      when: fmtDate(firstAt),
      done: Boolean(firstApprover),
      skip: finalized && !firstApprover,
    },
    ...(twoStage
      ? [
          {
            key: 'second',
            label: 'Second approval',
            icon: Check,
            person: secondApprover,
            who: nameOf(secondApprover),
            when: fmtDate(secondAt),
            done: Boolean(secondApprover),
            skip: finalized && !secondApprover,
          },
        ]
      : []),
    {
      key: 'paid',
      /*
       * The one rung whose caption is not a name. Who released the money is on the
       * rung as their face; the reference is the fact somebody reading this
       * actually needs, and it is the only place on the page it appears.
       */
      label: 'Paid',
      icon: Wallet,
      person: paidBy,
      who: status === 'paid' ? (utr ? `UTR ${utr}` : 'Recorded') : null,
      when: fmtDate(paidAt),
      done: status === 'paid',
    },
  ];

  // The rung the voucher is currently sitting on. -1 when it is finished, when
  // it has been sent back and is not sitting anywhere, or when every unfilled
  // rung ahead of it is one that was never going to fill.
  const next = rejected ? -1 : steps.findIndex((s) => !s.done && !s.skip);

  return (
    <div>
      {/* Three columns normally, four for a voucher old enough to have two
          approvals. Written out rather than interpolated, because Tailwind reads
          the class names out of the source. */}
      <ol
        className={cn(
          'grid gap-x-2 gap-y-5',
          steps.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
        )}
      >
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
                    Sent back{rejectedBy ? ` by ${nameOf(rejectedBy)}` : ''}
                  </p>
                ) : (
                  <p className="text-subtle mt-1 text-[13px]">
                    {step.skip ? 'Not required' : i === next ? 'Waiting' : 'Not yet'}
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
 *
 * A completed rung is the person who completed it.
 *
 * The face replaces the tick rather than joining it, which is the only way this
 * works: every rung here is a circle whose appearance carries the state, so a face
 * beside one would be a second circle competing with the thing the reader is meant
 * to be scanning. Instead the state moves to the ring and the small badge, and the
 * middle of the circle — previously a tick, which told you nothing you could not
 * see from its colour — carries who signed for it.
 *
 * The empty rungs are untouched, so the shape of the row still answers "what is
 * outstanding" before any face is looked at: faces behind you, circles ahead.
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

  if (step.done && step.person) {
    return (
      <span aria-hidden className="relative shrink-0">
        {/* The ring is the green that the tick used to be, so a completed rung is
            still green at a glance and still matches its lit connector. */}
        <span
          className="block rounded-full"
          style={{
            boxShadow:
              '0 0 0 2px var(--status-approved), 0 4px 12px color-mix(in oklab, var(--status-approved) 32%, transparent)',
          }}
        >
          <Avatar
            name={step.person.full_name}
            email={step.person.email}
            url={step.person.avatar_url}
            px={56}
            className="size-7 rounded-full text-[10px]"
          />
        </span>

        {/* The act, as a badge. Small on purpose: the ring already says done, and
            this says which kind of done — signed, or paid. */}
        <span
          className="on-tone absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full border-2"
          style={{
            background: 'var(--status-approved)',
            borderColor: 'var(--surface-raised)',
          }}
        >
          <step.icon className="size-2" strokeWidth={4} />
        </span>
      </span>
    );
  }

  if (step.done) {
    return (
      <span
        aria-hidden
        className="on-tone grid size-7 shrink-0 place-items-center rounded-full"
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
