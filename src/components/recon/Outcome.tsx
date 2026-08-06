'use client';

import type { CSSProperties } from 'react';
import { formatINR } from '@/lib/recon/amount';
import { formatLedgerDate } from '@/lib/recon/dates';
import type { ReconResult } from '@/lib/recon/types';
import { cn } from '@/lib/utils';
import { RECON_META, RECON_TONE, ReconBadge } from './ReconBadge';

/**
 * The answer.
 *
 * One panel at the top of the results, carrying the four figures somebody would
 * write down if they were told the outcome over the phone: did it tie out, by
 * how much did the balance have to move, where did it land, and what is left
 * unexplained.
 *
 * The variance gets the largest type on the screen when it is not zero, and
 * disappears into a quiet "nil" when it is. That asymmetry is the point. A
 * reconciliation that worked needs one word; one that did not needs a number,
 * immediately, before anything else on the page.
 */
export function Outcome({ result }: { result: ReconResult }) {
  const { statement } = result;
  const tone = RECON_TONE[statement.status];
  const meta = RECON_META[statement.status];

  const added = statement.lines
    .filter((l) => l.operation === 'add')
    .reduce((sum, l) => sum + l.amount, 0);
  const deducted = statement.lines
    .filter((l) => l.operation === 'less')
    .reduce((sum, l) => sum + l.amount, 0);
  const net = Math.round((added - deducted) * 100) / 100;
  const settled = Math.abs(statement.variance) < 0.01;

  return (
    <section
      style={{ '--tone': tone } as CSSProperties}
      className="surface-lit a-ring relative overflow-hidden rounded-3xl"
    >
      {/* Atmosphere in the outcome's own colour, so a bad result does not arrive
          on the same calm green surface as a good one. */}
      <span
        aria-hidden
        className="a-orb -top-32 -right-20 size-80 opacity-50"
        style={{ background: `radial-gradient(circle, ${tone}, transparent 68%)` }}
      />
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${tone}, transparent)` }}
      />
      <span
        aria-hidden
        className="a-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(70%_60%_at_10%_0%,#000,transparent)]"
      />

      <div className="relative p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="a-label">
              {statement.startingLedgerName} → {statement.otherLedgerName} · as at{' '}
              {formatLedgerDate(statement.reconciliationDate)}
            </p>
            <h2 className="m-display mt-2.5 text-[clamp(1.5rem,3.2vw,2rem)]">{meta.label}</h2>
            <p className="text-muted mt-2 max-w-xl text-sm leading-relaxed text-pretty">
              {meta.description}
            </p>
          </div>
          <ReconBadge status={statement.status} />
        </div>

        <dl className="mt-7 grid gap-px overflow-hidden rounded-2xl border bg-[var(--border-c)] sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Balance you started at"
            value={formatINR(statement.startingBalance)}
            side={statement.startingBalanceType}
            note={statement.startingLedgerName}
          />
          <Metric
            label="Net adjustment"
            value={`${net > 0 ? '+' : net < 0 ? '−' : ''}${formatINR(Math.abs(net))}`}
            note={`${statement.lines.length} ${statement.lines.length === 1 ? 'item' : 'items'} on the statement`}
          />
          <Metric
            label="Balance you arrived at"
            value={formatINR(statement.calculatedClosing)}
            side={statement.targetClosingType}
            note={statement.otherLedgerName}
          />
          <Metric
            label="Left unexplained"
            value={settled ? 'Nil' : formatINR(Math.abs(statement.variance))}
            note={
              settled
                ? 'The two books agree'
                : `The books differ by this much after everything above`
            }
            tone={settled ? undefined : tone}
            emphasis={!settled}
          />
        </dl>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  side,
  note,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  /** Dr or Cr, where the figure is a balance. */
  side?: string;
  note: string;
  tone?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="bg-[var(--surface-raised)] px-4 py-4">
      <dt className="a-label">{label}</dt>
      <dd>
        <span
          className={cn('a-figure mt-2 block', emphasis ? 'text-[1.6rem]' : 'text-[1.35rem]')}
          style={tone ? { color: tone } : undefined}
        >
          {value}
          {side && <span className="text-muted ml-1.5 text-xs font-medium">{side}</span>}
        </span>
        <span className="text-subtle mt-1.5 block truncate text-[11px]" title={note}>
          {note}
        </span>
      </dd>
    </div>
  );
}
