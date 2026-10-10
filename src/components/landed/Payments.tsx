'use client';

import type { CSSProperties } from 'react';
import { AlertTriangle, ArrowDownUp, Landmark, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/recon/amount';
import { dayNumber, type Instalment, type InstalmentResult, type LandedCost, type Problem } from '@/lib/landed/calc';
import { blankInstalment } from '@/lib/landed/store';
import { NumberInput, SourceToggle } from './Controls';
import { Panel } from './Panels';
import { SOURCE_TONE, compactINR } from './shared';

/**
 * The payments, as the construction schedule they are.
 *
 * Each one is a stop on a rail, numbered in the order it was entered and ringed
 * in the colour of its source, and each says on its own line what it will have
 * cost by possession. That figure is the whole tool at the scale of one cheque,
 * which is where people actually make the own-or-borrowed decision.
 */
export function Payments({
  instalments,
  result,
  issues,
  onChange,
}: {
  instalments: Instalment[];
  result: LandedCost;
  issues: Problem[];
  onChange: (next: Instalment[]) => void;
}) {
  const byId = new Map<string, InstalmentResult>(result.rows.map((r) => [r.id, r]));
  const bad = new Set(issues.map((p) => p.id).filter(Boolean));
  const setRow = (id: string, patch: Partial<Instalment>) =>
    onChange(instalments.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const sorted = [...instalments].every(
    (i, n, all) => n === 0 || !i.date || !all[n - 1].date || dayNumber(all[n - 1].date) <= dayNumber(i.date),
  );

  return (
    <Panel
      icon={<Landmark className="size-4" />}
      title="Down payment and instalments"
      description="Each payment as it was made, or as the builder's demand schedule says it will be."
      action={
        !sorted ? (
          <button
            type="button"
            onClick={() =>
              onChange(
                [...instalments].sort((a, b) => {
                  const x = dayNumber(a.date);
                  const y = dayNumber(b.date);
                  if (Number.isNaN(x)) return 1;
                  if (Number.isNaN(y)) return -1;
                  return x - y;
                }),
              )
            }
            className="text-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
          >
            <ArrowDownUp className="size-3.5" aria-hidden />
            Sort by date
          </button>
        ) : undefined
      }
    >
      <ol className="relative px-5 pt-5 pb-2 sm:px-6">
        {instalments.map((row, n) => {
          const r = byId.get(row.id);
          const last = n === instalments.length - 1;
          return (
            <li key={row.id} className="relative flex gap-4 pb-4">
              {/* The rail. */}
              {!last && (
                <span aria-hidden className="absolute top-10 bottom-0 left-[17px] w-[2px] rounded-full bg-[var(--border-c)]" />
              )}
              <span
                aria-hidden
                style={{ '--tone': SOURCE_TONE[row.source] } as CSSProperties}
                className="tinted relative z-[1] mt-1 grid size-9 shrink-0 place-items-center rounded-full border-2 text-[13px] font-bold tabular-nums"
              >
                {n + 1}
              </span>

              <div
                className={cn(
                  'surface-sunken min-w-0 flex-1 rounded-2xl border p-3 transition sm:p-3.5',
                  bad.has(row.id) && 'border-[color:color-mix(in_oklab,var(--status-warn)_45%,var(--border-c))]',
                )}
              >
                {/* Two lines: what and when, then how much and from where. Four abreast
                    clipped the source switch once the panel shared the row. */}
                <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_13rem]">
                  <Input
                    aria-label={`Payment ${n + 1} description`}
                    value={row.label}
                    onChange={(e) => setRow(row.id, { label: e.target.value })}
                    placeholder={n === 0 ? 'Booking amount' : `Instalment ${n}`}
                  />
                  <Input
                    aria-label={`Payment ${n + 1} date`}
                    type="date"
                    value={row.date}
                    onChange={(e) => setRow(row.id, { date: e.target.value })}
                  />
                  <NumberInput
                    aria-label={`Payment ${n + 1} amount in rupees`}
                    value={row.amount || undefined}
                    onCommit={(v) => setRow(row.id, { amount: v ?? 0 })}
                    placeholder="0"
                    prefix="₹"
                    inputClassName="font-semibold"
                  />
                  <SourceToggle
                    value={row.source}
                    onChange={(source) => setRow(row.id, { source })}
                    label={`Payment ${n + 1} source of funds`}
                  />
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-0.5 text-[12.5px]">
                  {r ? (
                    r.afterOc ? (
                      <span className="text-subtle">Paid on or after the OC date, so it carries no cost of funds</span>
                    ) : (
                      <span className="text-muted">
                        <span className="font-semibold text-[var(--accent)] tabular-nums">+{formatINR(r.interest)}</span> by
                        possession · {r.days.toLocaleString('en-IN')} days at {r.rate}% ·{' '}
                        <span className="tabular-nums">{compactINR(r.atPossession)}</span> in all
                      </span>
                    )
                  ) : (
                    <span className="text-subtle">Add a date and an amount to count this payment</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange(instalments.filter((i) => i.id !== row.id))}
                    aria-label={`Remove payment ${n + 1}`}
                    className="text-subtle -my-1 inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium transition hover:bg-[var(--surface-raised)] hover:text-[var(--status-rejected)]"
                  >
                    <X className="size-3.5" aria-hidden />
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}

        <li className="flex gap-4">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-dashed text-[var(--text-subtle)]">
            <Plus className="size-4" />
          </span>
          <button
            type="button"
            onClick={() => {
              const lastRow = instalments.at(-1);
              onChange([...instalments, blankInstalment(lastRow?.source ?? 'self')]);
            }}
            className="text-muted flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-[13.5px] font-semibold transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
          >
            Add a payment
          </button>
        </li>
      </ol>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5 text-[13px] sm:px-6">
        <span className="text-muted">
          {result.rows.length} of {instalments.length} counted
        </span>
        <span className="flex items-center gap-4">
          <span className="text-muted inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full" style={{ background: SOURCE_TONE.self }} />
            Own <span className="font-semibold text-[var(--text-c)] tabular-nums">{compactINR(result.self.paid)}</span>
          </span>
          <span className="text-muted inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full" style={{ background: SOURCE_TONE.borrowed }} />
            Borrowed <span className="font-semibold text-[var(--text-c)] tabular-nums">{compactINR(result.borrowed.paid)}</span>
          </span>
        </span>
      </div>

      {issues.length > 0 && (
        <div
          style={{ '--tone': 'var(--status-warn)' } as CSSProperties}
          className="tinted mx-5 mb-5 rounded-2xl border px-4 py-3 text-sm sm:mx-6"
          role="status"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            Not counted yet
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
            {issues.map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
