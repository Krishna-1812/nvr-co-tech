import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { STATUS_META, type VoucherStatus } from '@/lib/domain/workflow';

/**
 * Status is the most important thing on any voucher row, so it gets a colour, a
 * dot, and a word — never colour alone (that would exclude colour-blind users
 * and fail print).
 *
 * Each status names one token and the chip is mixed from it, rather than each
 * status carrying a hand-picked light shade and a hand-picked dark shade. The
 * two pending states share a colour deliberately: they are the same fact — this
 * is with an approver — and the word after the dot says which of the two.
 */
const TONE: Record<VoucherStatus, string> = {
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
  pending_first: '1st approval',
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
  const tone = { '--tone': TONE[status] } as CSSProperties;
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
 * A two-step progress indicator for the approval chain. Shows at a glance how
 * far along a voucher is — v1 had no concept of progress at all.
 *
 * Drawn as a filled rail rather than two dots and a line, because the thing an
 * approver is scanning for is how much of the chain is left, not how many
 * signatures exist.
 */
export function ApprovalProgress({ status }: { status: VoucherStatus }) {
  const first = ['pending_second', 'approved', 'paid'].includes(status);
  const second = ['approved', 'paid'].includes(status);
  const rejected = status === 'rejected';

  const tone = rejected ? 'var(--status-rejected)' : 'var(--status-approved)';
  const done = rejected ? 0 : Number(first) + Number(second);

  return (
    <div
      className="flex items-center gap-2"
      role="img"
      aria-label={
        rejected ? 'Sent back for correction' : `${done} of 2 approvals given`
      }
    >
      <span aria-hidden className="flex gap-1">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="h-1.5 w-6 rounded-full transition-colors"
            style={{ background: i < done ? tone : 'var(--border-strong)' }}
          />
        ))}
      </span>
      <span
        aria-hidden
        className={cn('numeric text-xs font-medium', done === 0 && 'text-subtle')}
      >
        {rejected ? '—' : `${done}/2`}
      </span>
    </div>
  );
}
