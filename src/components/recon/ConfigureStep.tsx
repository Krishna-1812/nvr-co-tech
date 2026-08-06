'use client';

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, CalendarDays, Info, Play, Scale } from 'lucide-react';
import { Button, Card, CardBody, CardTitle, Field, Input } from '@/components/ui/primitives';
import { formatINR } from '@/lib/recon/amount';
import { buildSummary } from '@/lib/recon/calculator';
import { formatLedgerDate } from '@/lib/recon/dates';
import type { Ledger, LedgerKey } from '@/lib/recon/types';
import { cn } from '@/lib/utils';
import { LEDGER_TONE } from './tone';

/**
 * Step three: which book you are starting from, and as of when.
 *
 * Both questions matter more than they look. A reconciliation statement is
 * directional — it walks from one balance to the other — and the one you start
 * from is the one you are asking about, usually your own books. The date decides
 * which lines have happened yet, and it is the difference between a cheque being
 * an outstanding item and it not existing.
 *
 * Each choice shows the balance it produces, live. Choosing between "Ledger A"
 * and "Ledger B" is a guess; choosing between "Company books, 10,24,500 Dr" and
 * "Bank statement, 10,32,700 Cr" is a decision.
 */
export function ConfigureStep({
  ledgerA,
  ledgerB,
  startingLedger,
  onStartingLedger,
  date,
  autoDate,
  minDate,
  maxDate,
  onDate,
  toleranceDays,
  onToleranceDays,
  onBack,
  onRun,
  busy,
  blocked,
  error,
}: {
  ledgerA: Ledger;
  ledgerB: Ledger;
  startingLedger: LedgerKey;
  onStartingLedger: (key: LedgerKey) => void;
  date: string;
  autoDate: string | null;
  minDate: string | null;
  maxDate: string | null;
  onDate: (date: string) => void;
  /** Null means no window: any counterpart posted by the date is on time. */
  toleranceDays: number | null;
  onToleranceDays: (days: number | null) => void;
  onBack: () => void;
  onRun: () => void;
  busy: boolean;
  /** True when the files have errors, which no choice here can fix. */
  blocked: boolean;
  error: string | null;
}) {
  // Recomputed as the date moves, because that is the point of showing them.
  const summaries = useMemo(
    () =>
      date
        ? {
            A: buildSummary(ledgerA, 'A', date),
            B: buildSummary(ledgerB, 'B', date),
          }
        : null,
    [ledgerA, ledgerB, date],
  );

  const tooEarly = Boolean(minDate && date && date < minDate);

  return (
    <Card>
      <CardTitle
        icon={<Scale className="size-4" />}
        title="What to reconcile"
        description="The book you are starting from, and the date you are reconciling to."
      />

      <CardBody className="space-y-7">
        {/* ── Which book ── */}
        <fieldset>
          <legend className="text-sm font-medium">Start from</legend>
          <p className="text-subtle mt-1 text-xs">
            The statement begins at this balance and works towards the other one.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(['A', 'B'] as const).map((key) => {
              const ledger = key === 'A' ? ledgerA : ledgerB;
              const summary = summaries?.[key];
              const active = startingLedger === key;
              const tone = LEDGER_TONE[key];

              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onStartingLedger(key)}
                  style={{ '--tone': tone } as CSSProperties}
                  className={cn(
                    'hover-lift rounded-2xl border p-4 text-left transition',
                    active
                      ? 'border-[var(--tone)] bg-[color-mix(in_oklab,var(--tone)_9%,var(--surface-raised))] ring-1 ring-[var(--tone)]'
                      : 'surface hover:border-[var(--border-strong)]',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="a-label" style={{ color: tone }}>
                      Ledger {key}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-4 place-items-center rounded-full border',
                        active ? 'border-[var(--tone)]' : 'border-[var(--border-strong)]',
                      )}
                    >
                      {active && (
                        <span className="size-2 rounded-full" style={{ background: tone }} />
                      )}
                    </span>
                  </span>

                  <span className="mt-2 block truncate text-sm font-semibold">{ledger.name}</span>

                  {summary && (
                    <>
                      <span className="a-figure mt-2 block text-[1.35rem]">
                        {formatINR(summary.calculatedClosing)}
                        <span className="text-muted ml-1.5 text-sm font-medium">
                          {summary.balanceType}
                        </span>
                      </span>
                      <span className="text-subtle mt-1.5 block text-[11px]">
                        {summary.transactionCount} of {ledger.transactions.length}{' '}
                        {ledger.transactions.length === 1 ? 'line' : 'lines'} counted
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        <hr />

        {/* ── As of when ── */}
        <div>
          <Field
            label="Reconcile as at"
            htmlFor="recon-date"
            hint={
              autoDate
                ? `The latest date in either file is ${formatLedgerDate(autoDate)}.`
                : 'Neither file has a readable date, so every line counts as posted.'
            }
            error={tooEarly ? `That is before either file starts (${formatLedgerDate(minDate)}).` : undefined}
            action={
              autoDate && date !== autoDate ? (
                <Button size="sm" onClick={() => onDate(autoDate)}>
                  <CalendarDays className="size-4" aria-hidden />
                  Use the latest
                </Button>
              ) : undefined
            }
          >
            <Input
              id="recon-date"
              type="date"
              value={date}
              min={minDate ?? undefined}
              max={maxDate ?? undefined}
              onChange={(e) => onDate(e.target.value)}
            />
          </Field>
        </div>

        <hr />

        {/* ── The timing window ── */}
        <fieldset>
          <legend className="text-sm font-medium">Timing tolerance</legend>
          <p className="text-subtle mt-1 max-w-2xl text-xs leading-relaxed text-pretty">
            Off by default. Turned on, a line that both books have posted but that cleared more
            than this many days apart is flagged rather than passed as a clean match. It never
            changes a balance, only what gets your attention.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={toleranceDays !== null}
                onChange={(e) => onToleranceDays(e.target.checked ? 7 : null)}
                className="size-4 accent-[var(--color-brand-600)]"
              />
              Flag anything that cleared more than
            </label>

            <Input
              type="number"
              min={1}
              max={365}
              disabled={toleranceDays === null}
              value={toleranceDays ?? ''}
              aria-label="Tolerance in days"
              onChange={(e) => {
                const value = Number(e.target.value);
                onToleranceDays(Number.isFinite(value) && value >= 1 ? Math.floor(value) : null);
              }}
              className="w-20"
            />
            <span
              className={cn('text-sm', toleranceDays === null && 'text-[var(--text-subtle)]')}
            >
              days apart
            </span>
          </div>
        </fieldset>

        {blocked && (
          <p className="text-subtle flex items-start gap-2 text-xs">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            The files have problems that have to be fixed first. They are listed above.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" onClick={onBack} disabled={busy}>
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={onRun}
            loading={busy}
            disabled={blocked || !date || tooEarly}
          >
            {!busy && <Play className="size-4" aria-hidden />}
            Reconcile
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
