'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteReconciliation } from '@/app/actions/reconciliation';
import { RECON_TONE, ReconBadge } from '@/components/recon/ReconBadge';
import { CATEGORY_LABEL, CATEGORY_TONE, LEDGER_TONE } from '@/components/recon/tone';
import { Button } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import type { DifferenceType, ReconStatus } from '@/lib/recon/types';

/**
 * One saved reconciliation in the list.
 *
 * The whole card is the link, with the delete control layered above it — the
 * same arrangement the workspace uses for a live tool, and for the same reason:
 * the common action should be the whole target, and the rare destructive one
 * should be a small deliberate thing you have to aim at.
 *
 * Each row carries a small version of the bar the result itself opens with,
 * what became of every entry, so a run with forty one-sided items looks
 * different from a clean one before it is opened. The colour on the left edge is
 * the outcome, and the badge says it in words beside it.
 *
 * Deleting asks first. There is no recycle bin behind this table, unlike
 * vouchers, because a reconciliation can simply be run again from the same two
 * files. That makes the confirmation the only guard, so it is a real one.
 */
export function HistoryRow({
  id,
  ledgerA,
  ledgerB,
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
  ledgerA: string;
  ledgerB: string;
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
  const title = `${ledgerA} against ${ledgerB}`;

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
  const parts: { key: DifferenceType; value: number }[] = [
    { key: 'MATCHED', value: counts.matched },
    { key: 'TIMING', value: counts.timing },
    { key: 'ONE_SIDED', value: counts.oneSided },
    { key: 'AMOUNT_DIFF', value: counts.amountDiff },
  ];
  const entries = differences + counts.matched;

  return (
    <div
      style={{ '--tone': RECON_TONE[status] } as CSSProperties}
      className="surface-lit a-ring a-lift group relative overflow-hidden rounded-3xl"
    >
      <Link
        href={`/reconcile/history/${id}`}
        className="absolute inset-0 z-10 rounded-3xl focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:outline-none"
      >
        <span className="sr-only">Open {title}</span>
      </Link>

      {/* The outcome, down the left edge. Said in words by the badge too. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--tone)] opacity-80" />

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 py-4 pr-4 pl-5 sm:py-5 sm:pr-5 sm:pl-6">
        <div className="min-w-0 flex-1 basis-72">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ReconBadge status={status} size="sm" />
            <p className="a-label">as at {asAt}</p>
            {toleranceDays !== null && <p className="a-label">±{toleranceDays}d</p>}
          </div>

          <p className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold tracking-tight">
            <Book name={ledgerA} tone={LEDGER_TONE.A} />
            <span className="text-subtle text-[13px] font-normal">against</span>
            <Book name={ledgerB} tone={LEDGER_TONE.B} />
          </p>

          {/* What became of every entry, as the result's own bar, in small. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {entries > 0 && (
              <span
                aria-hidden
                className="flex h-1.5 w-28 shrink-0 gap-px overflow-hidden rounded-full sm:w-36"
              >
                {parts
                  .filter((p) => p.value > 0)
                  .map((p) => (
                    <span
                      key={p.key}
                      title={`${CATEGORY_LABEL[p.key]}: ${p.value}`}
                      className="h-full"
                      style={{ flexGrow: p.value, flexBasis: 0, background: CATEGORY_TONE[p.key] }}
                    />
                  ))}
              </span>
            )}
            <p className="text-subtle text-xs">
              <span className="tabular-nums">{counts.matched}</span> matched
              {differences > 0 && (
                <>
                  {' · '}
                  <span className="tabular-nums">{differences}</span> to look at
                </>
              )}
              {' · run '}
              {ranAt}
            </p>
          </div>
        </div>

        <dl className="surface-sunken grid shrink-0 grid-cols-2 gap-x-6 rounded-2xl border px-4 py-3">
          <div className="min-w-0">
            <dt className="a-label">Closing</dt>
            <dd className="mt-1 text-sm font-semibold tracking-tight tabular-nums">{closing}</dd>
          </div>
          <div className="min-w-0">
            <dt className="a-label">Unexplained</dt>
            <dd
              className="mt-1 text-sm font-semibold tracking-tight tabular-nums"
              style={{
                color: settled
                  ? 'color-mix(in oklab, var(--status-approved) 82%, var(--text-c))'
                  : 'color-mix(in oklab, var(--status-warn) 82%, var(--text-c))',
              }}
              title={settled ? 'The two books agree' : 'Nothing on the statement accounts for this'}
            >
              {varianceLabel}
            </dd>
          </div>
        </dl>

        <div className="relative z-20 ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${title}`}
            className="text-subtle grid size-9 place-items-center rounded-xl transition hover:bg-[var(--surface-sunken)] hover:text-[var(--status-rejected)]"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
          <span
            aria-hidden
            className="surface-sunken text-subtle grid size-9 place-items-center rounded-xl border transition group-hover:text-[var(--text-c)]"
          >
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
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

/** A ledger's name, with the colour it has had on every screen of the run. */
function Book({ name, tone }: { name: string; tone: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: tone }} />
      <span className="truncate" title={name}>
        {name}
      </span>
    </span>
  );
}
