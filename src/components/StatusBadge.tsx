import type { CSSProperties } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_META, type VoucherStatus } from '@/lib/domain/workflow';

/**
 * Status is the most important thing on any voucher row, so it gets a colour, a
 * dot, and a word — never colour alone (that would exclude colour-blind users and
 * fail print).
 *
 * Each status names one token and the chip is mixed from it, rather than each
 * status carrying a hand-picked light shade and a hand-picked dark shade. The two
 * pending states share a colour deliberately: they are the same fact — this is
 * with an approver — and the word after the dot says which of the two.
 *
 * Exported, because the same colour has to appear on the row's status rail, on its
 * magnitude bar, on the pipeline segment it belongs to and on the dashboard card
 * that counts it. One map, so a green chip and a green bar can never be two
 * different greens.
 */
export const STATUS_TONE: Record<VoucherStatus, string> = {
  draft: 'var(--status-draft)',
  pending_first: 'var(--status-pending)',
  pending_second: 'var(--status-pending)',
  approved: 'var(--status-approved)',
  rejected: 'var(--status-rejected)',
  paid: 'var(--status-paid)',
};

/**
 * "Awaiting 1st approval" does not fit beside an amount on a 360px phone, and
 * truncating it would hide the digit that distinguishes the two states.
 */
const SHORT_LABEL: Record<VoucherStatus, string> = {
  draft: 'Draft',
  pending_first: 'Pending',
  pending_second: '2nd approval',
  approved: 'Approved',
  rejected: 'Sent back',
  paid: 'Paid',
};

export function StatusBadge({
  status,
  size = 'md',
  className,
}: {
  status: VoucherStatus;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const meta = STATUS_META[status];
  const tone = { '--tone': STATUS_TONE[status] } as CSSProperties;
  // Something is waiting on a person. A halo round the dot says so without
  // animating: a queue of twenty rows must not be twenty things pulsing.
  const waiting = status === 'pending_first' || status === 'pending_second';

  return (
    <span
      title={meta.description}
      style={tone}
      className={cn(
        'tinted inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 shrink-0 rounded-full bg-[var(--tone)]',
          waiting && 'ring-2 ring-[color-mix(in_oklab,var(--tone)_35%,transparent)]',
        )}
      />
      <span className="sm:hidden">{SHORT_LABEL[status]}</span>
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  );
}

/**
 * Whether a voucher's one required approval is in or still outstanding.
 *
 * This used to draw two rungs — the workflow required two different
 * approvers. Approval is one signature now (0015): the queue only ever has
 * one thing to wait for, so a single mark rather than a two-rung chain is
 * what is actually true. A voucher that entered the queue before that
 * shipped and is still sitting in pending_second reads the same as any other
 * one still waiting — the distinction was never something an approver
 * scanning the queue needed to see.
 */
export function ApprovalProgress({
  status,
  className,
}: {
  status: VoucherStatus;
  className?: string;
}) {
  const rejected = status === 'rejected';
  const done = status === 'approved' || status === 'paid';
  const waiting = status === 'pending_first' || status === 'pending_second';

  const tone = rejected ? 'var(--status-rejected)' : 'var(--status-approved)';

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="img"
      aria-label={rejected ? 'Sent back for correction' : done ? 'Approved' : 'Waiting for approval'}
      style={{ '--tone': tone } as CSSProperties}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-4 place-items-center rounded-full border transition-all',
          done
            ? 'on-tone border-transparent'
            : waiting
              ? 'border-dashed border-[var(--tone)] ring-2 ring-[color-mix(in_oklab,var(--tone)_18%,transparent)]'
              : 'border-dashed border-[var(--border-strong)]',
        )}
        style={done ? { background: tone } : undefined}
      >
        {done && <Check className="size-2.5" strokeWidth={3.5} />}
      </span>

      <span aria-hidden className={cn('numeric ml-0.5 text-xs font-medium', !done && 'text-subtle')}>
        {rejected ? <X className="size-3" /> : done ? 'Approved' : 'Pending'}
      </span>
    </div>
  );
}
