import { ArrowDownRight, ArrowUpRight, Minus, ShieldCheck } from 'lucide-react';
import { crore, gapPercent, money, percent, shortDate } from '@/lib/comps/format';
import { isKnown } from '@/lib/comps/multiples';
import type { Conclusion, Figure } from '@/lib/comps/types';
import { cn } from '@/lib/utils';

/**
 * The answer, first.
 *
 * The old desk led with the eleven-column table and buried what the peers imply
 * at the bottom of the page. This inverts that: the first thing on screen is the
 * number somebody came here for, the range around it, and — when the subject is
 * listed — whether the market agrees. The table is still there; it is now the
 * working behind the headline rather than the headline itself.
 *
 * ── The range bar is the whole idea ────────────────────────────────────────
 *
 * A single weighted figure hides how much the methods disagreed. Plotting the
 * low–high band, the weighted point inside it, and the market's own price on the
 * same scale answers three questions at a glance a paragraph cannot: what it is
 * worth, how sure that is, and whether the market has already said otherwise.
 */

type VerdictTone = 'agree' | 'watch' | 'diverge';

function verdictOf(gap: number): { label: string; tone: VerdictTone; blurb: string } {
  const mag = Math.abs(gap);
  const dir = gap > 0 ? 'above' : 'below';
  if (mag <= 0.1) {
    return {
      label: 'In line with the market',
      tone: 'agree',
      blurb: 'The peers land within a few per cent of the price the market has set — a working peer set.',
    };
  }
  if (mag <= 0.3) {
    return {
      label: gap > 0 ? 'Looks undervalued' : 'Looks rich',
      tone: 'watch',
      blurb: `The peers imply a value ${dir} the market price. Worth a second look at the peer set before quoting it.`,
    };
  }
  return {
    label: gap > 0 ? 'Far above the market' : 'Far below the market',
    tone: 'diverge',
    blurb: `The peers imply a value well ${dir} the market's — a gap this size is usually the peer set telling you something, not the market.`,
  };
}

const TONE_TOKEN: Record<VerdictTone, string> = {
  agree: 'var(--status-approved)',
  watch: 'var(--status-warn)',
  diverge: 'var(--status-reject)',
};

/** Position of a value on a [domainMin, domainMax] track, as a clamped percent. */
function posOf(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

export function Verdict({
  conclusion,
  subjectName,
  industry,
  basis,
  periodEnd,
  asOf,
  peerCount,
  consideredCount,
  listingStatus,
  marketCap,
  quoteAsOf,
}: {
  conclusion: Conclusion;
  subjectName: string;
  industry: string | null;
  basis: string;
  periodEnd: string | null;
  asOf: string;
  peerCount: number;
  /** How many companies the screen looked at and ruled out. */
  consideredCount: number;
  /** The subject's own `listing_status`, so "no quote" is not misread as "unlisted". */
  listingStatus: string | null;
  marketCap: Figure;
  quoteAsOf: string | null;
}) {
  const { low, high, weighted, dispersion } = conclusion;
  const haveRange = isKnown(low) && isKnown(high) && isKnown(weighted);

  // Two different facts, kept apart. A company can be listed and still have no
  // quote in the registry yet — "no market price on file" is not "not listed",
  // and the picker only ever offers listed subjects, so the second reading is
  // almost always the wrong one.
  const hasQuote = isKnown(marketCap);
  const isListed = listingStatus === 'listed';
  const gap = hasQuote && isKnown(weighted) ? gapPercent(marketCap, weighted) : null;
  const verdict = isKnown(gap) ? verdictOf(gap) : null;

  // The track spans the peer range and, when there is one, the market price too —
  // so a market cap that falls outside the implied range is still on screen where
  // a reader can see how far outside it is.
  const points = [low, high, weighted, hasQuote ? marketCap : null].filter(isKnown) as number[];
  const rawMin = points.length ? Math.min(...points) : 0;
  const rawMax = points.length ? Math.max(...points) : 1;
  const pad = (rawMax - rawMin) * 0.08 || Math.abs(rawMax) * 0.08 || 1;
  const domainMin = rawMin - pad;
  const domainMax = rawMax + pad;

  return (
    <section className="surface-lit a-ring animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] overflow-hidden rounded-3xl">
      <span aria-hidden className="gradient-brand block h-1 w-full" />

      <div className="grid gap-px lg:grid-cols-[1.55fr_1fr]">
        {/* ── The figure and the range ─────────────────────────────────── */}
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="a-label">Implied value · comparable companies</span>
            {isKnown(dispersion) && <DispersionChip dispersion={dispersion} />}
          </div>

          <h2 className="m-display mt-3 text-[clamp(1.4rem,3.4vw,2rem)] text-balance">
            {subjectName}
          </h2>

          <div className="text-subtle mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {industry && <Meta>{industry}</Meta>}
            <Meta className="capitalize">{basis}</Meta>
            {periodEnd && <Meta>FY to {shortDate(periodEnd)}</Meta>}
            <Meta>
              {peerCount} {peerCount === 1 ? 'peer' : 'peers'} · as at {shortDate(asOf)}
            </Meta>
          </div>

          {haveRange ? (
            <>
              <p className="mt-6 flex items-end gap-3">
                <span className="gradient-text a-figure text-[clamp(2.6rem,7vw,4rem)]">
                  {money(weighted)}
                </span>
                <span className="text-subtle mb-1.5 text-xs leading-tight">
                  weighted
                  <br />
                  equity value
                </span>
              </p>

              <RangeBar
                low={low as number}
                high={high as number}
                weighted={weighted as number}
                marketCap={hasQuote ? (marketCap as number) : null}
                domainMin={domainMin}
                domainMax={domainMax}
                verdictTone={verdict?.tone ?? 'agree'}
              />
            </>
          ) : peerCount === 0 ? (
            <p className="text-muted mt-6 max-w-md text-sm leading-relaxed">
              No comparable companies survived the screen, so there is nothing to value {subjectName}{' '}
              against yet.{' '}
              {consideredCount > 0 ? (
                <>
                  The screen looked at {consideredCount}{' '}
                  {consideredCount === 1 ? 'company' : 'companies'} and ruled every one out — open{' '}
                  <span className="font-medium">Considered &amp; excluded</span> below to see why.
                </>
              ) : (
                <>Nothing in the registry shares this company&rsquo;s industry and country yet.</>
              )}{' '}
              Seed more of this industry and country, and the valuation fills itself in.
            </p>
          ) : (
            <p className="text-muted mt-6 max-w-md text-sm leading-relaxed">
              A peer set formed, but no multiple could be applied to it — see the reason against each
              method below. The peer table still stands; the conclusion needs at least one peer with a
              usable multiple.
            </p>
          )}
        </div>

        {/* ── The market check — the reason a listed subject leads here ──── */}
        <div className="surface-sunken flex flex-col justify-center gap-4 p-6 sm:p-8">
          {verdict && hasQuote ? (
            <>
              <div className="flex items-center gap-2">
                <span
                  className="grid size-8 place-items-center rounded-lg text-white"
                  style={{ background: TONE_TOKEN[verdict.tone] }}
                >
                  <VerdictIcon tone={verdict.tone} gap={gap as number} />
                </span>
                <span
                  className="text-sm font-semibold tracking-tight"
                  style={{ color: TONE_TOKEN[verdict.tone] }}
                >
                  {verdict.label}
                </span>
              </div>

              <div>
                <p className="a-label">Peers vs the market</p>
                <p className="a-figure mt-1 text-4xl" style={{ color: TONE_TOKEN[verdict.tone] }}>
                  {percent(gap)}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="Market says" value={crore(marketCap)} sub={quoteAsOf ? shortDate(quoteAsOf) : undefined} />
                <Stat label="Peers imply" value={money(weighted)} sub={`FY to ${shortDate(periodEnd)}`} />
              </dl>

              <p className="text-muted text-xs leading-relaxed">{verdict.blurb}</p>
            </>
          ) : hasQuote ? (
            <p className="text-muted text-sm leading-relaxed">
              A market price exists to check against — but no method could be applied, so there is
              nothing to compare it with yet.
            </p>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <span className="surface-raised text-subtle grid size-9 place-items-center rounded-lg border">
                <ShieldCheck className="size-4" aria-hidden />
              </span>
              <p className="a-label">No market check yet</p>
              <p className="text-muted text-sm leading-relaxed">
                {isListed ? (
                  <>
                    {subjectName} is listed, but no market price has been ingested for it yet, so there
                    is nothing to test the peer estimate against. Seed a quote for it and the check
                    appears here.
                  </>
                ) : (
                  <>
                    {subjectName} is not listed, so there is no market capitalisation to test the peer
                    estimate against. The range on the left is the answer; a listed subject would also
                    get a live check on it.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** The low–high band, the weighted point, and the market price, on one scale. */
function RangeBar({
  low,
  high,
  weighted,
  marketCap,
  domainMin,
  domainMax,
  verdictTone,
}: {
  low: number;
  high: number;
  weighted: number;
  marketCap: number | null;
  domainMin: number;
  domainMax: number;
  verdictTone: VerdictTone;
}) {
  const lowPct = posOf(low, domainMin, domainMax);
  const highPct = posOf(high, domainMin, domainMax);
  const wPct = posOf(weighted, domainMin, domainMax);
  const mPct = marketCap !== null ? posOf(marketCap, domainMin, domainMax) : null;

  return (
    <div className="mt-8">
      <div className="relative h-2.5 w-full">
        {/* The full track */}
        <div className="a-track absolute inset-0 rounded-full" />
        {/* The peer-implied band */}
        <div
          className="gradient-brand a-fill absolute inset-y-0 rounded-full"
          style={{ left: `${lowPct}%`, width: `${Math.max(1.5, highPct - lowPct)}%` }}
        />
        {/* The weighted point */}
        <Marker pct={wPct} className="bg-[var(--surface-raised)] border-brand-500 border-2" />
        {/* The market price, when there is one */}
        {mPct !== null && (
          <Marker
            pct={mPct}
            className="border-2"
            style={{ background: TONE_TOKEN[verdictTone], borderColor: 'var(--surface-raised)' }}
          />
        )}
      </div>

      <div className="text-subtle mt-3 flex items-center justify-between text-xs tabular-nums">
        <span>Low · {money(low)}</span>
        <span className="text-muted flex items-center gap-1.5 font-medium">
          <span className="border-brand-500 inline-block size-2 rounded-full border-2 bg-[var(--surface-raised)]" />
          weighted {money(weighted)}
        </span>
        <span>High · {money(high)}</span>
      </div>

      {marketCap !== null && (
        <p className="text-subtle mt-1.5 flex items-center gap-1.5 text-xs">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: TONE_TOKEN[verdictTone] }}
          />
          market price {money(marketCap)}
        </p>
      )}
    </div>
  );
}

function Marker({
  pct,
  className,
  style,
}: {
  pct: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[var(--elev-2)]',
        className,
      )}
      style={{ left: `${pct}%`, ...style }}
    />
  );
}

function VerdictIcon({ tone, gap }: { tone: VerdictTone; gap: number }) {
  if (tone === 'agree') return <Minus className="size-4" aria-hidden />;
  return gap > 0 ? (
    <ArrowUpRight className="size-4" aria-hidden />
  ) : (
    <ArrowDownRight className="size-4" aria-hidden />
  );
}

function DispersionChip({ dispersion }: { dispersion: number }) {
  const base = 'rounded-full px-2 py-0.5 text-[11px] font-semibold';
  const tone =
    dispersion <= 1.5
      ? 'var(--status-approved)'
      : dispersion <= 3
        ? 'var(--status-warn)'
        : 'var(--status-reject)';
  const word = dispersion <= 1.5 ? 'methods agree' : dispersion <= 3 ? 'some spread' : 'methods disagree';
  return (
    <span
      className={base}
      style={{
        background: `color-mix(in oklab, ${tone} 14%, transparent)`,
        color: tone,
      }}
      title="How far apart the methods are. Above about 2×, the weighted figure is not doing much work."
    >
      {dispersion.toFixed(1)}× · {word}
    </span>
  );
}

function Meta({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'surface-sunken rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="a-label">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
      {sub && <dd className="text-subtle text-[11px]">{sub}</dd>}
    </div>
  );
}
