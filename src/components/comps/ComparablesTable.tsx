'use client';

import { useState, type CSSProperties } from 'react';
import { DataTable, Td, Th, Thead, Tr } from '@/components/ui/primitives';
import { CompanyBriefDrawer } from '@/components/comps/CompanyBriefDrawer';
import { crore, coverage, percent, shortDate } from '@/lib/comps/format';
import { formatMultiple, isKnown, revenueGrowth } from '@/lib/comps/multiples';
import { METHOD_LABEL, PICK } from '@/lib/comps/view';
import type { Comparable, MethodKey, Spread, Statistic } from '@/lib/comps/types';
import { cn } from '@/lib/utils';

/**
 * The comparables schedule.
 *
 * ── It scrolls sideways on a phone, deliberately ──────────────────────────
 *
 * Eleven columns of figures do not fold into a phone, and the recipe that works
 * for a table with an action column — turning the row into a two-column grid —
 * would be wrong here even if it fitted. This is a comparison matrix: its whole
 * purpose is that Meridian's EV/EBITDA sits directly under Sahyadri's so a reader
 * can run an eye down the column. Stacking each company into a card destroys the
 * comparison the table exists to make.
 *
 * So it joins the ledger difference table and the operator metrics tables in the
 * short list of things in this app that are allowed to scroll horizontally.
 *
 * There is no wrapper div here, and there was one until a rendered page showed
 * two: `DataTable` already wraps itself in `scroll-x-hint overflow-x-auto`. Which
 * matters for more than tidiness — `scroll-x-hint` is the shading at the edges
 * that tells a reader there is more to the right, and it appears only on the side
 * there is actually more to see. A second plain `overflow-x-auto` around it took
 * the scroll away from the element wearing the affordance, so a phone reader got
 * a table that scrolled and no sign that it did.
 *
 * ── Two things a reader will look for and must find ───────────────────────
 *
 * An empty cell is an em dash, never a zero, and an outlier is marked rather than
 * removed. Both are load-bearing: the first is the difference between "we do not
 * know" and "the company earned nothing", and the second means the peer trading
 * at forty times is visible to whoever has to decide whether it belongs.
 */

const MULTIPLES: MethodKey[] = ['ev_revenue', 'ev_ebitda', 'pe'];

/*
 * Crore, without the unit on every cell. The unit is said once, under each money
 * column's header: "Cr" repeated sixty times was the widest thing in the
 * table, and it is what pushed the multiples — the columns this table exists
 * for — off the right edge on a laptop. The figure itself is the same string
 * `crore()` returns; only the suffix moves.
 */
const cr = (v: number | null) => crore(v, { symbol: false }).replace(/ Cr$/, '');

function MoneyTh({ children }: { children: string }) {
  return (
    <Th align="right" className="px-3">
      {children}
      <span className="block text-[10px] font-normal tracking-normal normal-case opacity-80">₹ Cr</span>
    </Th>
  );
}

/** A figure cell. Absent renders as a dash and is dimmed, so gaps read as gaps. */
function Figure({ value, render }: { value: number | null; render: (v: number | null) => string }) {
  const known = isKnown(value);
  return (
    // nowrap: "1,200 Cr" broken over two lines reads as two figures.
    <Td align="right" className={cn('px-3 tabular-nums whitespace-nowrap', !known && 'text-subtle')}>
      {render(value)}
    </Td>
  );
}

export function ComparablesTable({
  comparables,
  spreads,
  statistic,
}: {
  comparables: Comparable[];
  spreads: Record<MethodKey, Spread>;
  statistic: Statistic;
}) {
  const outliers = new Map<MethodKey, Set<number>>(
    MULTIPLES.map((m) => [m, new Set(spreads[m].outliers)]),
  );

  const [opened, setOpened] = useState<Comparable | null>(null);

  return (
    <>
    <DataTable>
      <Thead>
        <tr>
          <Th className="px-3">Company</Th>
          <Th className="px-3">Period</Th>
          <MoneyTh>Revenue</MoneyTh>
          <Th align="right" className="px-3">Growth</Th>
          <MoneyTh>EBITDA</MoneyTh>
          <MoneyTh>Market cap</MoneyTh>
          <MoneyTh>Net debt</MoneyTh>
          <MoneyTh>EV</MoneyTh>
          {MULTIPLES.map((m) => (
            <Th key={m} align="right" className="px-3">
              {METHOD_LABEL[m]}
            </Th>
          ))}
        </tr>
      </Thead>

      <tbody>
        {comparables.map((c) => {
          const netDebt =
            isKnown(c.totalDebt) || isKnown(c.cash)
              ? (isKnown(c.totalDebt) ? c.totalDebt : 0) - (isKnown(c.cash) ? c.cash : 0)
              : null;

          return (
            <Tr key={c.companyId}>
              <Td className="min-w-[13rem] px-3">
                <button
                  type="button"
                  onClick={() => setOpened(c)}
                  className="group inline-flex cursor-pointer items-center gap-2.5 text-left font-medium"
                >
                  {/* A monogram, so the column reads as a list of companies at a
                      glance and the click target is bigger than the name. */}
                  <span
                    aria-hidden
                    className="surface-sunken text-muted grid size-7 shrink-0 place-items-center rounded-lg border text-[11px] font-semibold transition group-hover:border-[var(--border-strong)] group-hover:text-[var(--text-c)]"
                  >
                    {c.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="underline decoration-[var(--border-c)] underline-offset-[3px] transition group-hover:decoration-current">
                    {c.name}
                  </span>
                </button>
                {c.listingStatus !== 'listed' && (
                  /*
                   * Said on the row rather than only in a legend. An unlisted
                   * peer has figures and no multiples, and a reader scanning
                   * three dashes at the end of a row deserves to know why
                   * without having to work it out.
                   */
                  <span
                    style={{ '--tone': 'var(--status-draft)' } as CSSProperties}
                    className="tinted mt-1 ml-[2.375rem] block w-fit rounded-full border px-1.5 py-px text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase"
                  >
                    {c.listingStatus}
                  </span>
                )}
              </Td>
              <Td className="text-muted px-3 text-xs whitespace-nowrap">{shortDate(c.periodEnd)}</Td>
              <Figure value={c.revenue} render={cr} />
              <Figure value={revenueGrowth(c)} render={percent} />
              <Figure value={c.ebitda} render={cr} />
              <Figure value={c.marketCap} render={cr} />
              <Figure value={netDebt} render={cr} />
              <Figure value={c.multiples.enterpriseValue} render={cr} />

              {MULTIPLES.map((m) => {
                const value = PICK[m](c);
                const isOutlier = isKnown(value) && outliers.get(m)?.has(value);
                return (
                  <Td
                    key={m}
                    align="right"
                    className={cn('px-3 tabular-nums whitespace-nowrap', !isKnown(value) && 'text-subtle')}
                    title={isOutlier ? 'Outside the 1.5 × IQR fence. Kept in the set.' : undefined}
                  >
                    {isOutlier ? (
                      <span
                        style={{ '--tone': 'var(--status-warn)' } as CSSProperties}
                        className="tinted inline-flex rounded-md border px-1.5 py-px font-semibold"
                      >
                        {formatMultiple(value)}
                        <span aria-label=" outlier"> *</span>
                      </span>
                    ) : (
                      formatMultiple(value)
                    )}
                  </Td>
                );
              })}
            </Tr>
          );
        })}
      </tbody>

      {/*
        The statistics, in the same columns as the figures they summarise. A
        median printed in a card beside the table makes a reader check that it
        is the median OF the table; in the footer of the column it cannot be
        anything else.
      */}
      <tfoot className="surface-sunken border-t-2">
        <tr className="text-xs">
          <Td colSpan={8} className="a-label">
            {statistic === 'median' ? 'Median' : statistic === 'mean' ? 'Mean' : statistic === 'q1' ? 'Lower quartile' : 'Upper quartile'}
          </Td>
          {MULTIPLES.map((m) => (
            <Td key={m} align="right" className="px-3 text-[13px] font-semibold whitespace-nowrap tabular-nums">
              {formatMultiple(
                statistic === 'median'
                  ? spreads[m].median
                  : statistic === 'mean'
                    ? spreads[m].mean
                    : statistic === 'q1'
                      ? spreads[m].q1
                      : spreads[m].q3,
              )}
            </Td>
          ))}
        </tr>

        <tr className="text-xs">
          <Td colSpan={8} className="text-subtle">
            Quartiles
          </Td>
          {MULTIPLES.map((m) => (
            <Td key={m} align="right" className="text-subtle px-3 whitespace-nowrap tabular-nums">
              {formatMultiple(spreads[m].q1)} – {formatMultiple(spreads[m].q3)}
            </Td>
          ))}
        </tr>

        <tr className="text-xs">
          {/*
            The count is not a footnote. A median over four peers out of eleven
            is a different claim from a median over eleven, and only one of them
            should be put in front of an investor without a caveat.
          */}
          <Td colSpan={8} className="text-subtle">
            Computed from
          </Td>
          {MULTIPLES.map((m) => (
            <Td key={m} align="right" className="text-subtle px-3 whitespace-nowrap">
              {coverage(spreads[m].n, spreads[m].missing)}
            </Td>
          ))}
        </tr>
      </tfoot>
    </DataTable>

    <CompanyBriefDrawer comparable={opened} onClose={() => setOpened(null)} />
    </>
  );
}
