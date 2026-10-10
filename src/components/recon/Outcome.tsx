'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, CalendarDays, Check, ListChecks, Timer, TriangleAlert } from 'lucide-react';
import { HeroChip, HeroStat, ToolHero } from '@/components/ui/ToolHero';
import { ArchScene, SealFigure } from '@/components/ui/Scene';
import { formatINR } from '@/lib/recon/amount';
import { formatLedgerDate } from '@/lib/recon/dates';
import type { DifferenceType, ReconResult, ReconStatus } from '@/lib/recon/types';
import { RECON_META, RECON_TONE } from './ReconBadge';
import { CATEGORY_LABEL, CATEGORY_TONE } from './tone';

/**
 * The answer.
 *
 * Set the way True Property Cost sets its own: the one thing somebody would say
 * if they were told the outcome over the phone, as the largest thing on the
 * screen, with the working underneath it and the scales standing beside it.
 *
 * What that one thing is depends on the outcome, and the asymmetry is the point.
 * When something is left unexplained, the hero is that amount, in figures,
 * immediately, before anything else on the page. When the books agree it is a
 * sentence saying so, because a reconciliation that worked needs one line and
 * not a large zero.
 *
 * Underneath: where the statement started, how far the reconciling items moved
 * it, where it arrived and what is left (the four figures the old panel had),
 * then what became of every entry the two books were compared on, as one bar.
 */

const CATEGORIES: DifferenceType[] = ['MATCHED', 'TIMING', 'ONE_SIDED', 'AMOUNT_DIFF'];

const STATUS_ICON: Record<ReconStatus, typeof Check> = {
  RECONCILED: Check,
  PARTIAL: TriangleAlert,
  NOT_RECONCILED: AlertTriangle,
};

/** A share to the nearest whole per cent, never rounding a real one to 0 or 100. */
function share(part: number, whole: number): number {
  if (whole <= 0) return 0;
  const exact = (part / whole) * 100;
  if (part > 0 && exact < 1) return 1;
  if (part < whole && exact > 99) return 99;
  return Math.round(exact);
}

export function Outcome({
  result,
  label,
  actions,
  footer,
}: {
  result: ReconResult;
  /** What sits above the answer: "Statement" for a live run, when it was run for a kept one. */
  label?: ReactNode;
  /** The exports and the save state, which belong with the answer they act on. */
  actions?: ReactNode;
  /** The step rail, on a live run. */
  footer?: ReactNode;
}) {
  const { statement, counts } = result;
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
  const unexplained = formatINR(Math.abs(statement.variance));

  // Every entry the two books were compared on, by what became of it. The same
  // counts the filter chips on the table below carry, so the two always agree.
  const total = CATEGORIES.reduce((sum, c) => sum + counts[c], 0);
  const matchedShare = share(counts.MATCHED, total);
  const parts = CATEGORIES.map((c) => ({ key: c, value: counts[c] }));

  const items = statement.lines.length;
  const contradicting = [result.summaryA, result.summaryB].filter(
    (s) => s.closingMatchesProvided === false,
  );

  const pair = (
    <>
      <span className="text-[var(--text-c)]">{statement.startingLedgerName}</span> against{' '}
      <span className="text-[var(--text-c)]">{statement.otherLedgerName}</span>
    </>
  );

  return (
    <ToolHero
      id="recon-outcome"
      label={label ?? `Statement · as at ${formatLedgerDate(statement.reconciliationDate)}`}
      pill={{ icon: STATUS_ICON[statement.status], text: meta.label, tone }}
      glow={tone}
      variant={settled ? 'headline' : 'figure'}
      title={
        !settled
          ? unexplained
          : statement.status === 'RECONCILED'
            ? 'The two books agree.'
            : 'The balances meet, but a file contradicts itself.'
      }
      sub={
        // A file whose printed closing does not follow from its own lines makes
        // the run PARTIAL even when nothing is left over, and that is the thing
        // to say first: the arithmetic agreeing is no comfort if a source is wrong.
        settled && statement.status !== 'RECONCILED' ? (
          <>
            {pair} tie out to nil. {meta.description}
          </>
        ) : settled ? (
          <>
            {pair}{' '}
            {items === 0
              ? 'tie out with nothing to adjust.'
              : `tie out once the ${items} reconciling ${items === 1 ? 'item is' : 'items are'} allowed for, and every one of them is listed below.`}
          </>
        ) : (
          <>
            Left unexplained between {pair}. {meta.description}
          </>
        )
      }
      scene={
        <ArchScene
          motif="scales"
          className="h-full max-h-[34rem] min-h-[18rem]"
          seal={
            total > 0 ? (
              <SealFigure value={`${matchedShare}%`} note="of entries matched" />
            ) : undefined
          }
        />
      }
    >
      {actions && <div className="mt-7">{actions}</div>}

      {/* The walk from one balance to the other, in four figures. */}
      <div className="mt-8 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        <HeroStat
          label="Started at"
          value={
            <>
              {formatINR(statement.startingBalance)}
              <Side>{statement.startingBalanceType}</Side>
            </>
          }
          note={statement.startingLedgerName}
        />
        <HeroStat
          label="Net adjustment"
          value={`${net > 0 ? '+' : net < 0 ? '−' : ''}${formatINR(Math.abs(net))}`}
          note={`${items} ${items === 1 ? 'item' : 'items'} on the statement`}
        />
        <HeroStat
          label="Arrived at"
          value={
            <>
              {formatINR(statement.calculatedClosing)}
              <Side>{statement.targetClosingType}</Side>
            </>
          }
          note={statement.otherLedgerName}
        />
        <HeroStat
          strong
          label="Left unexplained"
          value={settled ? 'Nil' : unexplained}
          note={settled ? 'Nothing left between them' : 'After everything on the statement'}
        />
      </div>

      {/* What became of every entry: one bar, a 2px gap between the parts. */}
      {total > 0 && (
        <div className="surface-sunken a-inner mt-4 rounded-2xl border p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="a-label">Entries compared</p>
            <p className="text-subtle text-[12px]">
              <span className="font-semibold text-[var(--text-c)] tabular-nums">
                {counts.MATCHED}
              </span>{' '}
              of <span className="tabular-nums">{total}</span> matched outright ·{' '}
              <span className="tabular-nums">{matchedShare}%</span>
            </p>
          </div>

          <div className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded-full">
            {parts
              .filter((p) => p.value > 0)
              .map((p, i) => (
                <span
                  key={p.key}
                  title={`${CATEGORY_LABEL[p.key]}: ${p.value}`}
                  className="a-fill h-full"
                  style={{
                    flexGrow: p.value,
                    flexBasis: 0,
                    background: CATEGORY_TONE[p.key],
                    animationDelay: `${150 + i * 120}ms`,
                  }}
                />
              ))}
          </div>

          {/* All four, zeros included: "no amount differences" is a finding. */}
          <dl className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-4">
            {parts.map((p) => (
              <div key={p.key} className={p.value === 0 ? 'opacity-60' : undefined}>
                <dt className="text-muted inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ background: CATEGORY_TONE[p.key] }}
                  />
                  {CATEGORY_LABEL[p.key]}
                </dt>
                <dd className="mt-0.5 pl-[1.125rem] font-semibold tabular-nums">
                  {p.value}{' '}
                  <span className="text-subtle font-normal">· {share(p.value, total)}%</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <HeroChip icon={CalendarDays}>
          As at {formatLedgerDate(statement.reconciliationDate)}
        </HeroChip>
        <HeroChip icon={Timer}>
          {statement.toleranceDays === null
            ? 'No timing tolerance'
            : `${statement.toleranceDays}-day timing tolerance`}
        </HeroChip>
        <HeroChip icon={ListChecks}>
          {items === 0
            ? 'Nothing to reconcile on the statement'
            : `${items} reconciling ${items === 1 ? 'item' : 'items'}, itemised below`}
        </HeroChip>
        {contradicting.map((s) => (
          <HeroChip
            key={s.key}
            icon={TriangleAlert}
            className="text-[color-mix(in_oklab,var(--status-warn)_82%,var(--text-c))]"
          >
            {s.name}&rsquo;s printed closing does not follow from its own lines
          </HeroChip>
        ))}
      </div>

      {footer && <div className="mt-8">{footer}</div>}
    </ToolHero>
  );
}

/** Dr or Cr, set smaller beside the balance it qualifies. */
function Side({ children }: { children: ReactNode }) {
  return <span className="ml-1 text-[0.75em] font-medium opacity-70">{children}</span>;
}
