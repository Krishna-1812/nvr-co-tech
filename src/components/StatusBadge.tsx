import { cn } from '@/lib/utils';
import { STATUS_META, type VoucherStatus } from '@/lib/domain/workflow';

/**
 * Status is the most important thing on any voucher row, so it gets a colour, a
 * dot, and a word — never colour alone (that would exclude colour-blind users
 * and fail print).
 */
const TONE_STYLE: Record<VoucherStatus, { dot: string; chip: string }> = {
  draft: {
    dot: 'bg-[var(--status-draft)]',
    chip: 'bg-[var(--surface-sunken)] text-[var(--text-muted)] border-[var(--border-c)]',
  },
  pending_first: {
    dot: 'bg-[var(--status-pending)]',
    chip: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900',
  },
  pending_second: {
    dot: 'bg-[var(--status-pending)]',
    chip: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900',
  },
  approved: {
    dot: 'bg-[var(--status-approved)]',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
  },
  rejected: {
    dot: 'bg-[var(--status-rejected)]',
    chip: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900',
  },
  paid: {
    dot: 'bg-[var(--status-paid)]',
    chip: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-900',
  },
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
  const style = TONE_STYLE[status];
  // Something is waiting on a person. The dot breathes to say so.
  const waiting = status === 'pending_first' || status === 'pending_second';

  return (
    <span
      title={meta.description}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        style.chip,
        className,
      )}
    >
      <span aria-hidden className="relative grid size-1.5 shrink-0 place-items-center">
        {waiting && (
          <span
            className={cn('absolute size-full animate-ping rounded-full opacity-75', style.dot)}
          />
        )}
        <span className={cn('size-full rounded-full', style.dot)} />
      </span>
      {meta.label}
    </span>
  );
}

/**
 * A two-step progress indicator for the approval chain. Shows at a glance how
 * far along a voucher is — v1 had no concept of progress at all.
 */
export function ApprovalProgress({ status }: { status: VoucherStatus }) {
  const first = ['pending_second', 'approved', 'paid'].includes(status);
  const second = ['approved', 'paid'].includes(status);
  const rejected = status === 'rejected';

  const step = (done: boolean, label: string) => (
    <div className="flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          rejected
            ? 'bg-[var(--status-rejected)]'
            : done
              ? 'bg-[var(--status-approved)]'
              : 'bg-[var(--border-strong)]',
        )}
      />
      <span className={cn('text-xs', done ? 'font-medium' : 'text-subtle')}>{label}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-3" role="group" aria-label="Approval progress">
      {step(first, '1st')}
      <span aria-hidden className="h-px w-4 bg-[var(--border-strong)]" />
      {step(second, '2nd')}
    </div>
  );
}
