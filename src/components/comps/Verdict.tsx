import type { CSSProperties, ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  FileText,
  Minus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ToolHero, HeroChip, HeroStat } from '@/components/ui/ToolHero';
import { ArchScene, SealFigure } from '@/components/ui/Scene';
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
 * ── Set as the shared tool hero ─────────────────────────────────────────────
 *
 * It opens the way True Property Cost opens: the weighted value as the figure,
 * the company it values on the line under it, the working in tiles beneath, and
 * the arch beside it with the columns scene — the peers standing as columns, the
 * subject marked on their median line, which is literally what this method does.
 * The seal on the arch carries the gap to the market and only that; it is shown
 * only when there is a quote to measure the gap against, and the same figure is
 * stated in the market check below the range, so the picture says nothing a
 * screen reader misses.
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

/*
 * `--status-rejected`, not `--status-reject`. The second never existed, so a
 * "far from the market" verdict used to paint its icon and figure in nothing at
 * all — the one verdict that most needed to be seen.
 */
const TONE_TOKEN: Record<VerdictTone, string> = {
  agree: 'var(--status-approved)',
  watch: 'var(--status-warn)',
  diverge: 'var(--status-rejected)',
};

/** Position of a value on a [domainMin, domainMax] track, as a clamped percent. */
function posOf(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function dispersionOf(dispersion: number): { word: string; tone: string } {
  if (dispersion <= 1.5) return { word: 'methods agree', tone: 'var(--status-approved)' };
  if (dispersion <= 3) return { word: 'some spread', tone: 'var(--status-warn)' };
  return { word: 'methods disagree', tone: 'var(--status-rejected)' };
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

  const spread = isKnown(dispersion) ? dispersionOf(dispersion) : null;

  const chips = (
    <div className="mt-7 flex flex-wrap gap-2">
      {industry && <HeroChip icon={Building2}>{industry}</HeroChip>}
      <HeroChip icon={FileText}>
        <span className="capitalize">{basis}</span>
        {periodEnd && <> · FY to {shortDate(periodEnd)}</>}
      </HeroChip>
      <HeroChip icon={Users}>
        {peerCount} {peerCount === 1 ? 'peer' : 'peers'} in the set
        {consideredCount > 0 && <>, {consideredCount} considered and excluded</>}
      </HeroChip>
      <HeroChip icon={CalendarDays}>Prices as at {shortDate(asOf)}</HeroChip>
    </div>
  );

  // Nothing to value against: the hero turns into a sentence about why, in the
  // display face, rather than a figure-shaped hole with a dash in it.
  if (!haveRange) {
    return (
      <ToolHero
        id="comps-verdict"
        as="h2"
        label="Implied value · comparable companies"
        title={peerCount === 0 ? `No peers to value ${subjectName} against yet` : `The peers formed, but no method could run`}
        sub={
          peerCount === 0 ? (
            <>
              No comparable company survived the screen.{' '}
              {consideredCount > 0 ? (
                <>
                  It looked at {consideredCount} {consideredCount === 1 ? 'company' : 'companies'} and
                  ruled every one out — open <span className="font-medium">Considered &amp; excluded</span>{' '}
                  below to see why.
                </>
              ) : (
                <>Nothing in the registry shares this company&rsquo;s industry and country yet.</>
              )}{' '}
              Seed more of this industry and country, and the valuation fills itself in.
            </>
          ) : (
            <>
              {subjectName} has a peer set, but no multiple could be applied to it — the reason is
              against each method below. The conclusion needs at least one peer with a usable multiple.
            </>
          )
        }
        glow="var(--status-warn)"
        scene={<ArchScene motif="columns" className="h-full min-h-[18rem]" />}
      >
        {chips}
      </ToolHero>
    );
  }

  return (
    <ToolHero
      id="comps-verdict"
      as="h2"
      variant="figure"
      label="Implied equity value · comparable companies"
      pill={
        spread
          ? { text: `${(dispersion as number).toFixed(1)}× high to low · ${spread.word}`, tone: spread.tone }
          : undefined
      }
      title={money(weighted)}
      sub={
        <>
          <span className="font-semibold text-[var(--text-c)]">{subjectName}</span>, weighted across{' '}
          {conclusion.applied.length} {conclusion.applied.length === 1 ? 'method' : 'methods'} applied to{' '}
          {peerCount} listed {peerCount === 1 ? 'peer' : 'peers'}.
        </>
      }
      scene={
        <ArchScene
          motif="columns"
          className="h-full min-h-[19rem]"
          seal={isKnown(gap) ? <SealFigure value={percent(gap)} note="peers against the market" /> : undefined}
        />
      }
    >
      {/* The working: the band the methods span, and where the market sits. */}
      <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <HeroStat label="Lowest method" value={money(low)} note="bottom of the band" tone={BAND_EDGE} />
        <HeroStat label="Highest method" value={money(high)} note="top of the band" tone={BAND_EDGE} />
        {hasQuote ? (
          <HeroStat
            label="Market says"
            value={crore(marketCap)}
            note={quoteAsOf ? `market cap, ${shortDate(quoteAsOf)}` : 'market cap'}
            tone={verdict ? TONE_TOKEN[verdict.tone] : undefined}
          />
        ) : (
          <HeroStat label="Market says" value={<span className="text-subtle">—</span>} note="no quote on file" />
        )}
        <HeroStat label="Peers imply" value={money(weighted)} note="weighted equity value" strong />
      </div>

      <RangeBar
        low={low as number}
        high={high as number}
        weighted={weighted as number}
        marketCap={hasQuote ? (marketCap as number) : null}
        domainMin={domainMin}
        domainMax={domainMax}
        verdictTone={verdict?.tone ?? 'agree'}
      />

      <MarketCheck
        subjectName={subjectName}
        isListed={isListed}
        hasQuote={hasQuote}
        gap={gap}
        verdict={verdict}
      />

      {chips}
    </ToolHero>
  );
}

/** The colour of the peer band: the accent, eased back so the markers on it read. */
const BAND = 'color-mix(in oklab, var(--accent) 38%, var(--a-track))';
const BAND_EDGE = 'color-mix(in oklab, var(--accent) 60%, var(--a-track))';

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
    <div className="surface-sunken a-inner mt-6 rounded-2xl border px-4 pt-5 pb-4 sm:px-5">
      <p className="a-label">Where the answer sits</p>
      <div className="relative mt-5 h-3 w-full">
        <div className="a-track absolute inset-0 rounded-full" />
        <div
          className="a-fill absolute inset-y-0 rounded-full"
          style={{ left: `${lowPct}%`, width: `${Math.max(1.5, highPct - lowPct)}%`, background: BAND }}
        />
        <Marker
          pct={wPct}
          className="size-[18px] border-[3px]"
          style={{ background: 'var(--action)', borderColor: 'var(--surface-raised)' }}
        />
        {mPct !== null && (
          <Marker
            pct={mPct}
            className="size-[18px] rotate-45 rounded-[4px] border-[3px]"
            style={{ background: TONE_TOKEN[verdictTone], borderColor: 'var(--surface-raised)' }}
          />
        )}
      </div>

      <div className="mt-3 flex justify-between gap-3 text-[12px] tabular-nums">
        <span className="text-subtle">{money(low)}</span>
        <span className="text-subtle">{money(high)}</span>
      </div>

      {/* The legend: every mark on the bar named in words beside its swatch. */}
      <div className="text-muted mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-3 text-[12px]">
        <Legend swatch={<span className="h-2 w-4 rounded-full" style={{ background: BAND }} />}>
          Peer band, lowest to highest method
        </Legend>
        <Legend swatch={<span className="size-2.5 rounded-full" style={{ background: 'var(--action)' }} />}>
          Weighted <span className="font-semibold text-[var(--text-c)] tabular-nums">{money(weighted)}</span>
        </Legend>
        {marketCap !== null && (
          <Legend
            swatch={
              <span className="size-2 rotate-45 rounded-[2px]" style={{ background: TONE_TOKEN[verdictTone] }} />
            }
          >
            Market price <span className="font-semibold text-[var(--text-c)] tabular-nums">{money(marketCap)}</span>
          </Legend>
        )}
      </div>
    </div>
  );
}

function Legend({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="inline-grid w-4 place-items-center">
        {swatch}
      </span>
      <span>{children}</span>
    </span>
  );
}

/**
 * The market check — the reason a listed subject leads here.
 *
 * Inside the hero rather than in a column of its own: the gap is part of the
 * answer, and beside the figure it reads as a second opinion rather than as a
 * separate card someone has to go and find.
 */
function MarketCheck({
  subjectName,
  isListed,
  hasQuote,
  gap,
  verdict,
}: {
  subjectName: string;
  isListed: boolean;
  hasQuote: boolean;
  gap: Figure;
  verdict: ReturnType<typeof verdictOf> | null;
}) {
  if (verdict && isKnown(gap)) {
    const tone = TONE_TOKEN[verdict.tone];
    return (
      <div
        style={{ '--tone': tone } as CSSProperties}
        className="mt-3 flex flex-col gap-4 rounded-2xl border border-[color-mix(in_oklab,var(--tone)_28%,var(--border-c))] bg-[color-mix(in_oklab,var(--tone)_6%,var(--surface-raised))] p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
      >
        <div className="flex shrink-0 items-center gap-3">
          <span className="on-tone grid size-10 place-items-center rounded-xl" style={{ background: tone }}>
            <VerdictIcon tone={verdict.tone} gap={gap} />
          </span>
          <div>
            <p className="a-label">Peers vs the market</p>
            <p className="mt-0.5 text-[1.6rem] leading-none font-semibold tracking-tight tabular-nums" style={{ color: tone }}>
              {percent(gap)}
            </p>
          </div>
        </div>
        <div className="min-w-0 sm:border-l sm:pl-5">
          <p className="text-sm font-semibold tracking-tight" style={{ color: tone }}>
            {verdict.label}
          </p>
          <p className="text-muted mt-0.5 text-[13px] leading-relaxed text-pretty">{verdict.blurb}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-sunken mt-3 flex items-start gap-3 rounded-2xl border p-4 sm:p-5">
      <span className="bg-[var(--surface-raised)] text-subtle grid size-9 shrink-0 place-items-center rounded-xl border">
        <ShieldCheck className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-tight">No market check yet</p>
        <p className="text-muted mt-0.5 text-[13px] leading-relaxed text-pretty">
          {hasQuote ? (
            <>A market price exists to check against, but no method could be applied, so there is nothing to compare it with yet.</>
          ) : isListed ? (
            <>
              {subjectName} is listed, but no market price has been ingested for it yet, so there is
              nothing to test the peer estimate against. Seed a quote for it and the check appears here.
            </>
          ) : (
            <>
              {subjectName} is not listed, so there is no market capitalisation to test the peer estimate
              against. The range above is the answer; a listed subject would also get a live check on it.
            </>
          )}
        </p>
      </div>
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
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[var(--elev-2)]',
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
