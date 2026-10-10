import type { CSSProperties } from 'react';
import { AlertTriangle, Sigma } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/primitives';
import { money } from '@/lib/comps/format';
import { formatMultiple, isKnown } from '@/lib/comps/multiples';
import { STATISTICS } from '@/lib/comps/statistics';
import { METHOD_LABEL, PICK } from '@/lib/comps/view';
import type { Comparable, Conclusion, MethodKey, Spread } from '@/lib/comps/types';
import { cn } from '@/lib/utils';

/**
 * How each method got to its number, and how much it counted.
 *
 * The old Conclusion card said this in a column of small text. This keeps every
 * word of the working — a reviewer needs "6.1× × ₹420 Cr" spelled out — but
 * plots each method's answer on the same scale the headline range uses, so
 * which method is pulling the weighted figure up or down is visible rather than
 * inferred from three numbers in a list. A refused method keeps its row and its
 * reason, because "we could not apply P/E because the subject loses money" is a
 * stronger statement than a silently shorter list.
 *
 * ── The peers, as columns ──────────────────────────────────────────────────
 *
 * Each row also draws where its multiple came from: every peer that has one as a
 * column, and the statistic actually applied as a line across them, with this
 * company's marker on that line. It is the step a reader otherwise has to take
 * on trust — "the median is 21.3×" — shown as the set it is the median of, so a
 * single peer standing twice as tall as the rest is seen before it is quoted.
 * The columns read the same `PICK` and the same `spreads.outliers` the table
 * below uses, so the two can never disagree about which peer is the odd one.
 */

/** What each multiple is applied to, in the words of the working. */
const METRIC_WORD: Record<MethodKey, string> = {
  ev_revenue: 'revenue',
  ev_ebitda: 'EBITDA',
  pe: 'earnings',
};

export function MethodBreakdown({
  conclusion,
  comparables,
  spreads,
}: {
  conclusion: Conclusion;
  comparables: Comparable[];
  spreads: Record<MethodKey, Spread>;
}) {
  const { applied, refused, weights, weightsNormalised, low, high, weighted } = conclusion;

  if (applied.length === 0 && refused.length === 0) return null;

  // The scale is the headline's, padded a little at each end so the lowest and
  // highest methods sit on the track rather than on its rounded caps.
  const haveScale = isKnown(low) && isKnown(high) && (high as number) > (low as number);
  const pad = haveScale ? ((high as number) - (low as number)) * 0.08 : 0;
  const min = haveScale ? (low as number) - pad : 0;
  const max = haveScale ? (high as number) + pad : 1;
  const posOf = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  const wPct = haveScale && isKnown(weighted) ? posOf(weighted) : null;

  return (
    <Card className="animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_0.08s_backwards] overflow-hidden">
      <CardTitle
        icon={<Sigma className="size-4" />}
        title="How the peers imply it"
        description="Each method is the peer statistic times this company's own figure, bridged once to equity."
      />

      <div className="divide-y divide-[color-mix(in_oklab,var(--border-c)_70%,transparent)]">
        {applied.map((m, i) => {
          const weight = Math.round((weights[m.method] ?? 0) * 100);
          const pct = isKnown(m.impliedEquityValue) && haveScale ? posOf(m.impliedEquityValue) : null;
          const statLabel = STATISTICS.find((s) => s.value === m.statistic)?.label ?? m.statistic;

          return (
            <div
              key={m.method}
              className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:gap-8"
            >
              <div className="min-w-0 lg:self-center">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="text-[15px] font-semibold tracking-tight">{METHOD_LABEL[m.method]}</span>
                    <WeightMeter weight={weight} delay={i * 120} />
                  </div>
                  <span className="text-[1.35rem] leading-none font-semibold tracking-tight tabular-nums">
                    {money(m.impliedEquityValue)}
                  </span>
                </div>

                <p className="text-muted mt-2 text-[13px] tabular-nums">
                  {statLabel} {formatMultiple(m.multiple)} × {METRIC_WORD[m.method]} {money(m.subjectMetric)}
                  <span className="text-subtle"> · from {m.peers} {m.peers === 1 ? 'peer' : 'peers'}</span>
                </p>

                {pct !== null && (
                  <div className="mt-4">
                    <div className="relative h-2 w-full">
                      <div className="a-track absolute inset-0 rounded-full" />
                      {/* The pull: from the weighted figure to this method's answer. */}
                      {wPct !== null && (
                        <div
                          className={cn('absolute inset-y-0 rounded-full', pct >= wPct ? 'a-fill' : 'a-fill-end')}
                          style={{
                            left: `${Math.min(pct, wPct)}%`,
                            width: `${Math.abs(pct - wPct)}%`,
                            background: 'color-mix(in oklab, var(--accent) 45%, var(--a-track))',
                            animationDelay: `${120 + i * 120}ms`,
                          }}
                        />
                      )}
                      {wPct !== null && (
                        <span
                          aria-hidden
                          className="absolute -top-1.5 -bottom-1.5 w-[2px] -translate-x-1/2 rounded-full bg-[var(--action)] opacity-70"
                          style={{ left: `${wPct}%` }}
                        />
                      )}
                      <span
                        aria-hidden
                        className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--surface-raised)] bg-[var(--accent)] shadow-[var(--elev-1)]"
                        style={{ left: `${pct}%` }}
                      />
                    </div>
                    <p className="text-subtle mt-2 text-[12px]">
                      {wPct === null || Math.abs(pct - wPct) < 0.5
                        ? 'At the weighted figure'
                        : pct > wPct
                          ? 'Pulls the weighted figure up'
                          : 'Pulls the weighted figure down'}
                      {i === 0 && <span aria-hidden> · the dark tick is the weighted figure</span>}
                    </p>
                  </div>
                )}
              </div>

              <PeerColumns
                method={m.method}
                comparables={comparables}
                spread={spreads[m.method]}
                applied={m.multiple}
                statLabel={statLabel}
              />
            </div>
          );
        })}

        {refused.map((r) => (
          <div key={r.method} className="flex items-start gap-3 px-5 py-4 sm:px-6">
            <span
              style={{ '--tone': 'var(--status-warn)' } as CSSProperties}
              className="tinted grid size-7 shrink-0 place-items-center rounded-lg border"
            >
              <AlertTriangle className="size-3.5" aria-hidden />
            </span>
            <p className="min-w-0 pt-0.5 text-sm">
              <span className="font-semibold">{METHOD_LABEL[r.method as MethodKey]}</span>{' '}
              <span className="text-muted">not applied — {r.reason}</span>
            </p>
          </div>
        ))}
      </div>

      {weightsNormalised && (
        <p className="text-subtle surface-sunken border-t px-5 py-3 text-[12px] leading-relaxed sm:px-6">
          The weights did not sum to one, or a weighted method could not be applied, so they were
          rescaled across the methods that ran.
        </p>
      )}
    </Card>
  );
}

function WeightMeter({ weight, delay }: { weight: number; delay: number }) {
  return (
    <span
      className="surface-sunken inline-flex items-center gap-2 rounded-full border px-2 py-0.5"
      title="How much this method counts toward the weighted figure."
    >
      <span className="a-track relative h-1.5 w-10 overflow-hidden rounded-full">
        <span
          className="a-fill absolute inset-y-0 left-0 rounded-full bg-[var(--action)]"
          style={{ width: `${weight}%`, animationDelay: `${delay}ms` }}
        />
      </span>
      <span className="text-muted text-[11px] font-semibold tabular-nums">{weight}% weight</span>
    </span>
  );
}

/**
 * One multiple across the peer set: a column per peer, the applied statistic as
 * a dashed line, this company marked on it.
 *
 * Names under the columns only while there is room for them; past eight peers
 * they would be letters, so the chart keeps its columns and each still carries
 * its name and value for a pointer and for a screen reader.
 */
function PeerColumns({
  method,
  comparables,
  spread,
  applied,
  statLabel,
}: {
  method: MethodKey;
  comparables: Comparable[];
  spread: Spread;
  applied: number;
  statLabel: string;
}) {
  const outliers = new Set(spread.outliers);
  const peers = comparables
    .map((c) => ({ id: c.companyId, name: c.name, value: PICK[method](c) }))
    .filter((p): p is { id: string; name: string; value: number } => isKnown(p.value));

  if (peers.length === 0) return null;

  // Columns grow from zero; a negative multiple (rare, and already refused by
  // the engine for P/E) is drawn as a stub rather than below the axis.
  const top = Math.max(applied, ...peers.map((p) => p.value)) * 1.08 || 1;
  const h = (v: number) => Math.max(3, (Math.max(0, v) / top) * 100);
  const linePct = h(applied);
  const named = peers.length <= 8;

  return (
    <figure className="surface-sunken a-inner min-w-0 rounded-2xl border p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="a-label">The peers</span>
        <span className="text-subtle text-[11.5px]">
          {statLabel} <span className="font-semibold text-[var(--text-c)] tabular-nums">{formatMultiple(applied)}</span>
        </span>
      </figcaption>

      <div className="relative mt-3 h-24">
        <ul className="absolute inset-0 flex items-end gap-1.5" aria-label={`${METHOD_LABEL[method]} for each peer`}>
          {peers.map((p, i) => {
            const odd = outliers.has(p.value);
            return (
              <li
                key={p.id}
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
                title={`${p.name}: ${formatMultiple(p.value)}${odd ? ' — outside the 1.5 × IQR fence, kept in the set' : ''}`}
              >
                <span className="sr-only">
                  {p.name}: {formatMultiple(p.value)}
                  {odd && ', outlier'}
                </span>
                <span
                  aria-hidden
                  className="a-fill-y w-full max-w-9 rounded-t-md transition-opacity group-hover:opacity-80"
                  style={{
                    height: `${h(p.value)}%`,
                    background: odd ? 'var(--status-warn)' : 'color-mix(in oklab, var(--text-c) 62%, transparent)',
                    animationDelay: `${i * 60}ms`,
                  }}
                />
              </li>
            );
          })}
        </ul>

        {/* The statistic applied, and this company standing on it. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0" style={{ bottom: `${linePct}%` }}>
          <span className="absolute inset-x-0 border-t-2 border-dashed border-[var(--accent)]" />
          <span className="absolute -top-[7px] -left-1 size-3.5 rotate-45 rounded-[3px] border-2 border-[var(--surface-raised)] bg-[var(--accent)]" />
        </div>
      </div>

      {named && (
        <div aria-hidden className="mt-1.5 flex gap-1.5">
          {peers.map((p) => (
            <span key={p.id} className="text-subtle min-w-0 flex-1 truncate text-center text-[10.5px]">
              {p.name.split(' ')[0]}
            </span>
          ))}
        </div>
      )}

      <p className="text-subtle mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11.5px]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rotate-45 rounded-[2px] bg-[var(--accent)]" />
          This company, at the {statLabel.toLowerCase()}
        </span>
        {spread.outliers.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-[2px] bg-[var(--status-warn)]" />
            Outlier, kept
          </span>
        )}
      </p>
    </figure>
  );
}
