'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteReconciliation } from '@/app/actions/reconciliation';
import { ReconBadge } from '@/components/recon/ReconBadge';
import { Button } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import type { ReconStatus } from '@/lib/recon/types';

/**
 * One saved reconciliation in the list.
 *
 * The whole card is the link, with the delete control layered above it — the
 * same arrangement the workspace uses for a live tool, and for the same reason:
 * the common action should be the whole target, and the rare destructive one
 * should be a small deliberate thing you have to aim at.
 *
 * Deleting asks first. There is no recycle bin behind this table, unlike
 * vouchers, because a reconciliation can simply be run again from the same two
 * files. That makes the confirmation the only guard, so it is a real one.
 */
export function HistoryRow({
  id,
  title,
  asAt,
  status,
  variance,
  varianceLabel,
  closing,
  toleranceDays,
  counts,
  ranAt,
}: {
  id: string;
  title: string;
  asAt: string;
  status: ReconStatus;
  variance: number;
  varianceLabel: string;
  closing: string;
  toleranceDays: number | null;
  counts: { matched: number; timing: number; oneSided: number; amountDiff: number };
  ranAt: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      const outcome = await deleteReconciliation(id);
      if (outcome.ok) {
        toast.success('Deleted.');
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(outcome.error);
      }
    });
  };

  const settled = Math.abs(variance) < 0.01;
  const differences = counts.timing + counts.oneSided + counts.amountDiff;

  return (
    <div className="surface-lit a-lift group relative overflow-hidden rounded-2xl">
      <Link
        href={`/reconcile/history/${id}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:outline-none"
      >
        <span className="sr-only">Open {title}</span>
      </Link>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ReconBadge status={status} size="sm" />
            <p className="a-label">as at {asAt}</p>
            {toleranceDays !== null && <p className="a-label">±{toleranceDays}d</p>}
          </div>
          <p className="mt-2 truncate font-semibold tracking-tight" title={title}>
            {title}
          </p>
          <p className="text-subtle mt-1 text-xs">
            {counts.matched} matched
            {differences > 0 && (
              <>
                {' · '}
                {differences} to look at
              </>
            )}
            {' · run '}
            {ranAt}
          </p>
        </div>

        <dl className="flex shrink-0 items-center gap-6">
          <div>
            <dt className="a-label">Closing</dt>
            <dd className="numeric mt-1 text-sm font-semibold">{closing}</dd>
          </div>
          <div>
            <dt className="a-label">Unexplained</dt>
            <dd
              className={cn(
                'numeric mt-1 text-sm font-semibold',
                settled
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400',
              )}
              title={settled ? 'The two books agree' : 'Nothing on the statement accounts for this'}
            >
              {varianceLabel}
            </dd>
          </div>
        </dl>

        <div className="relative z-20 flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${title}`}
            className="text-subtle grid size-8 place-items-center rounded-lg transition hover:bg-[var(--surface-sunken)] hover:text-red-600 dark:hover:text-red-400"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
          <ArrowRight
            className="text-subtle size-4 transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          />
        </div>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this reconciliation?"
        description="It goes for good. There is no recycle bin behind this list, but you can run it again from the same two files."
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirming(false)} disabled={busy}>
            Keep it
          </Button>
          <Button variant="danger" onClick={remove} loading={busy}>
            <Trash2 className="size-4" aria-hidden />
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
