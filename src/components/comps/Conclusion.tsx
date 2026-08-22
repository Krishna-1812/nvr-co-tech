import { AlertTriangle, Check } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/primitives';
import { crore, gapPercent, money, percent, shortDate } from '@/lib/comps/format';
import { formatMultiple, isKnown } from '@/lib/comps/multiples';
import { METHOD_LABEL } from '@/lib/comps/view';
import type { Conclusion as ConclusionType, Figure, MethodKey } from '@/lib/comps/types';

/**
 * What the methods concluded, and how far apart they were.
 *
 * ── Dispersion is printed before the answer, on purpose ───────────────────
 *
 * The instinct on a screen like this is to lead with one confident number. But
 * three methods applied to the same company rarely agree, and how far apart they
 * are is the single most useful thing on the screen: a reader who sees the range
 * is 1.3× knows the weighted figure means something, and one who sees 8× knows it
 * does not, however carefully it was weighted.
 *
 * So the range comes first and the weighted figure sits inside it, rather than
 * the other way round with the range as a footnote.
 *
 * ── A refused method is shown, not hidden ─────────────────────────────────
 *
 * "EV/EBITDA was not applied because the subject is loss-making at EBITDA" is a
 * sentence a reader can act on. A screen that quietly showed two methods where a
 * colleague's showed three would be the more confusing of the two.
 */

function Money({ value, className }: { value: Figure; className?: string }) {
  return <span className={className}>{money(value)}</span>;
}

export function Conclusion({
  conclusion,
  subjectName,
  marketCap,
  quoteAsOf,
}: {
  conclusion: ConclusionType;
  subjectName: string;
  /** The market's own answer, when the subject is listed. */
  marketCap: Figure;
  quoteAsOf: string | null;
}) {
  const { low, high, weighted, dispersion, applied, refused, weights, weightsNormalised } = conclusion;

  return (
    <Card>
      <CardHeader>
        <CardTitle
          title="What the peers imply"
          description={`Applied to ${subjectName}. Every figure is the peer statistic times this company's own, bridged once.`}
        />
      </CardHeader>

      <CardBody className="space-y-6">
        {/* ── The range, then the figure inside it ─────────────────────── */}
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-subtle text-[11px] tracking-[0.08em] uppercase">Range</span>
            <span className="font-semibold tabular-nums">
              <Money value={low} /> – <Money value={high} />
            </span>
            {isKnown(dispersion) && (
              <span
                className={cnDispersion(dispersion)}
                title="How far apart the methods are. Above about 2x, the weighted figure is not doing much work."
              >
                {dispersion.toFixed(1)}× apart
              </span>
            )}
          </div>

          <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
            <span className="text-subtle text-[11px] tracking-[0.08em] uppercase">Weighted</span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              <Money value={weighted} />
            </span>
          </p>

          {weightsNormalised && (
            /*
             * Said out loud. A reviewer being asked to accept a weighting is
             * entitled to know it was not the weighting that was handed in —
             * either because it did not sum to one, or because a method that was
             * meant to carry weight could not be applied.
             */
            <p className="text-muted mt-2 text-xs">
              The weights did not sum to one, or a weighted method could not be applied, so they were
              rescaled across the methods that ran.
            </p>
          )}
        </div>

        {/* ── The check that only a listed subject can give ────────────── */}
        {isKnown(marketCap) && (
          <div className="surface-sunken rounded-lg border p-4">
            <p className="text-[11px] tracking-[0.08em] uppercase">Against the market</p>
            <p className="mt-2 text-sm">
              The market says <span className="font-semibold tabular-nums">{crore(marketCap)}</span>
              {quoteAsOf && <span className="text-muted"> as at {shortDate(quoteAsOf)}</span>}.
              {isKnown(weighted) && (
                <>
                  {' '}
                  These peers imply{' '}
                  <span className="font-semibold tabular-nums">{money(weighted)}</span>, a difference
                  of{' '}
                  <span className="font-semibold tabular-nums">
                    {percent(gapPercent(marketCap, weighted))}
                  </span>
                  .
                </>
              )}
            </p>
            <p className="text-muted mt-2 text-xs leading-relaxed">
              {/*
                The most valuable line on the screen, and the reason the subject
                is a listed company in this first version. A peer set that lands
                within a few per cent of a price the market has already set is
                working. One that implies half is telling you the peer set is
                wrong — before a client does.
              */}
              This company is listed, so the method can be checked against a price somebody actually
              paid. A few per cent is a working peer set; a large gap is the peer set telling you
              something, not the market.
            </p>
          </div>
        )}

        {/* ── Method by method ─────────────────────────────────────────── */}
        <div className="space-y-2">
          {applied.map((output) => (
            <div
              key={output.method}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-2 text-sm last:border-0"
            >
              <span className="flex items-baseline gap-2">
                <Check className="size-3.5 shrink-0 text-[var(--status-approved)]" aria-hidden />
                <span className="font-medium">{METHOD_LABEL[output.method]}</span>
                <span className="text-subtle text-xs tabular-nums">
                  {formatMultiple(output.multiple)} × {money(output.subjectMetric)}
                </span>
              </span>
              <span className="flex items-baseline gap-3 tabular-nums">
                <span className="text-subtle text-xs">
                  {Math.round((weights[output.method] ?? 0) * 100)}%
                </span>
                <span className="font-semibold">
                  <Money value={output.impliedEquityValue} />
                </span>
              </span>
            </div>
          ))}

          {refused.map((refusal) => (
            <div
              key={refusal.method}
              className="text-muted flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b pb-2 text-sm last:border-0"
            >
              <AlertTriangle className="size-3.5 shrink-0 text-[var(--status-warn)]" aria-hidden />
              <span className="font-medium">{METHOD_LABEL[refusal.method as MethodKey]}</span>
              <span className="text-xs">not applied — {refusal.reason}</span>
            </div>
          ))}
        </div>

        <p className="text-subtle text-xs leading-relaxed">
          Enterprise multiples imply what the whole business is worth, so this company&rsquo;s own debt
          and cash are taken off once to reach the equity. P/E already implies the equity and is not
          bridged again. No marketability or control discount has been applied.
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * Dispersion, tinted by how much it should worry the reader.
 *
 * Thresholds rather than a gradient, because the question is categorical: is the
 * weighted average worth quoting, or is the spread the finding? Under 1.5× the
 * methods broadly agree; over 3× they are not describing the same company.
 */
function cnDispersion(dispersion: number): string {
  const base = 'rounded-full px-2 py-0.5 text-[11px] font-semibold';
  if (dispersion <= 1.5) return `${base} bg-[var(--status-approved)]/12 text-[var(--status-approved)]`;
  if (dispersion <= 3) return `${base} bg-[var(--status-warn)]/12 text-[var(--status-warn)]`;
  return `${base} bg-[var(--status-reject)]/12 text-[var(--status-reject)]`;
}
