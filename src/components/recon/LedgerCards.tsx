'use client';

import type { CSSProperties } from 'react';
import { TriangleAlert } from 'lucide-react';
import { formatINR } from '@/lib/recon/amount';
import type { LedgerSummary } from '@/lib/recon/types';
import { LEDGER_TONE } from './tone';

/**
 * What each book says about itself.
 *
 * Before the two are compared, each one has to be shown on its own, because the
 * first question about any reconciliation is whether the two closing balances
 * being reconciled are the ones you expected. Getting that wrong — reconciling
 * to last month's statement, or to a file that stops halfway — produces a
 * perfectly tidy statement of the wrong thing.
 *
 * The stated closing is shown next to the calculated one wherever the file
 * printed one, and disagreement between them is called out. That disagreement is
 * the only condition this tool cannot reconcile away, and it means the file
 * itself is wrong.
 */
export function LedgerCards({ a, b }: { a: LedgerSummary; b: LedgerSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Summary summary={a} />
      <Summary summary={b} />
    </div>
  );
}

function Summary({ summary }: { summary: LedgerSummary }) {
  const tone = LEDGER_TONE[summary.key];
  const contradicts = summary.closingMatchesProvided === false;

  return (
    <div
      style={{ '--tone': tone } as CSSProperties}
      className="surface-lit a-ring relative overflow-hidden rounded-2xl p-5"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${tone}, transparent)` }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="a-label" style={{ color: tone }}>
            Ledger {summary.key}
          </p>
          <p className="mt-1.5 truncate font-semibold tracking-tight">{summary.name}</p>
        </div>
        <span className="tinted shrink-0 rounded-lg border px-2 py-0.5 text-xs font-bold">
          {summary.balanceType}
        </span>
      </div>

      <div className="surface-sunken a-inner mt-4 rounded-xl border px-4 py-3.5">
        <p className="a-label">Closing balance</p>
        <p className="a-figure mt-1.5 text-[1.7rem]">
          {formatINR(summary.calculatedClosing)}
          <span className="text-muted ml-1.5 text-sm font-medium">{summary.balanceType}</span>
        </p>
      </div>

      <dl className="mt-4 divide-y divide-dashed text-sm">
        <Row label="Opening balance" value={formatINR(Math.abs(summary.openingBalance))} />
        <Row label="Total debits" value={formatINR(summary.totalDebits)} />
        <Row label="Total credits" value={formatINR(summary.totalCredits)} />
        <Row label="Lines counted" value={String(summary.transactionCount)} />
        {/* Short enough not to be clipped on a phone, where the label sits
            beside a figure and truncating it would hide which closing it is. */}
        {summary.providedClosing !== null && (
          <Row label="Closing, as stated" value={formatINR(Math.abs(summary.providedClosing))} />
        )}
      </dl>

      {contradicts && (
        <p
          style={{ '--tone': 'var(--status-warn)' } as CSSProperties}
          className="tinted mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed font-medium text-pretty"
        >
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          This file disagrees with itself: the closing balance it prints does not follow from the
          lines above it. Check the source before relying on this reconciliation.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-muted min-w-0 truncate text-[13px]">{label}</dt>
      <dd className="numeric shrink-0 text-[13px] font-medium">{value}</dd>
    </div>
  );
}
