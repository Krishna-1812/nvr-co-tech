import type { CSSProperties } from 'react';
import { HeroStat } from '@/components/ui/ToolHero';
import type { ReconStatus } from '@/lib/recon/types';
import { RECON_META, RECON_TONE } from './ReconBadge';

/**
 * The history, in one strip, above the list of it.
 *
 * Four figures and one bar, all counted from the columns the list already
 * fetched: how many reconciliations are kept, how many of them tied out, how
 * many still have something unexplained, and how many entries were matched
 * across all of them. The bar is the same three outcomes as the badges on the
 * rows below, in the same colours, so a glance at it says whether the rows are
 * worth scrolling.
 */

const ORDER: ReconStatus[] = ['RECONCILED', 'PARTIAL', 'NOT_RECONCILED'];

export function HistorySummary({
  runs,
}: {
  runs: { status: ReconStatus; matched: number; differences: number }[];
}) {
  const total = runs.length;
  const byStatus = ORDER.map((status) => ({
    status,
    count: runs.filter((r) => r.status === status).length,
  }));
  const reconciled = byStatus[0].count;
  const open = total - reconciled;
  const matched = runs.reduce((sum, r) => sum + r.matched, 0);
  const differences = runs.reduce((sum, r) => sum + r.differences, 0);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <section
      aria-label="Summary"
      className="surface-lit a-ring relative animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] overflow-hidden rounded-3xl p-5 sm:p-6"
    >
      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        <HeroStat
          strong
          label="Kept"
          value={total.toLocaleString('en-IN')}
          note={total === 1 ? 'reconciliation, newest first' : 'reconciliations, newest first'}
        />
        <HeroStat
          label="Reconciled"
          tone={RECON_TONE.RECONCILED}
          value={reconciled.toLocaleString('en-IN')}
          note={`${pct(reconciled)}% tied out to nil`}
        />
        <HeroStat
          label="Still open"
          tone={RECON_TONE.NOT_RECONCILED}
          value={open.toLocaleString('en-IN')}
          note={open === 0 ? 'Nothing left unexplained' : 'Something left unexplained'}
        />
        <HeroStat
          label="Entries matched"
          value={matched.toLocaleString('en-IN')}
          note={`${differences.toLocaleString('en-IN')} ${differences === 1 ? 'difference' : 'differences'} found across them`}
        />
      </div>

      {total > 0 && (
        <div className="mt-5">
          <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
            {byStatus
              .filter((s) => s.count > 0)
              .map((s, i) => (
                <span
                  key={s.status}
                  title={`${RECON_META[s.status].label}: ${s.count}`}
                  className="a-fill h-full"
                  style={{
                    flexGrow: s.count,
                    flexBasis: 0,
                    background: RECON_TONE[s.status],
                    animationDelay: `${150 + i * 120}ms`,
                  }}
                />
              ))}
          </div>
          <dl className="text-muted mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[12.5px]">
            {byStatus.map((s) => (
              <div
                key={s.status}
                style={{ '--tone': RECON_TONE[s.status] } as CSSProperties}
                className="inline-flex items-center gap-2"
              >
                <dt className="inline-flex items-center gap-2">
                  <span aria-hidden className="size-2.5 rounded-[3px] bg-[var(--tone)]" />
                  {RECON_META[s.status].label}
                </dt>
                <dd className="font-semibold text-[var(--text-c)] tabular-nums">{s.count}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
