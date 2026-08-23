import { AlertTriangle } from 'lucide-react';
import { CardTitle } from '@/components/ui/primitives';
import { money } from '@/lib/comps/format';
import { formatMultiple, isKnown } from '@/lib/comps/multiples';
import { METHOD_LABEL } from '@/lib/comps/view';
import type { Conclusion, MethodKey } from '@/lib/comps/types';
import { cn } from '@/lib/utils';

/**
 * How each method got to its number, and how much it counted.
 *
 * The old Conclusion card said this in a column of small text. This keeps every
 * word of the working — a reviewer needs "6.1× × ₹420 Cr" spelled out — but
 * plots each method's answer on the same low→high scale the headline range uses,
 * so which method is pulling the weighted figure up or down is visible rather
 * than inferred from three numbers in a list. A refused method keeps its row and
 * its reason, because "we could not apply P/E because the subject loses money"
 * is a stronger statement than a silently shorter list.
 */
export function MethodBreakdown({ conclusion }: { conclusion: Conclusion }) {
  const { applied, refused, weights, weightsNormalised, low, high } = conclusion;
  const haveScale = isKnown(low) && isKnown(high) && (high as number) > (low as number);
  const span = haveScale ? (high as number) - (low as number) : 1;
  const posOf = (v: number) => Math.min(100, Math.max(0, ((v - (low as number)) / span) * 100));

  if (applied.length === 0 && refused.length === 0) return null;

  return (
    <div className="surface-lit a-ring rounded-2xl">
      <CardTitle
        title="How the peers imply it"
        description="Each method is the peer statistic times this company's own figure, bridged once to equity."
      />

      <div className="divide-y">
        {applied.map((m) => {
          const weight = Math.round((weights[m.method] ?? 0) * 100);
          const pct = isKnown(m.impliedEquityValue) && haveScale ? posOf(m.impliedEquityValue) : null;
          return (
            <div key={m.method} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-semibold">{METHOD_LABEL[m.method]}</span>
                  <span className="text-subtle text-xs tabular-nums">
                    {formatMultiple(m.multiple)} × {money(m.subjectMetric)}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <WeightPill weight={weight} />
                  <span className="font-semibold tabular-nums">{money(m.impliedEquityValue)}</span>
                </div>
              </div>

              {pct !== null && (
                <div className="relative mt-3 h-1.5 w-full">
                  <div className="a-track absolute inset-0 rounded-full" />
                  <div
                    className="gradient-brand a-fill absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                  <span
                    aria-hidden
                    className="border-brand-500 absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-[var(--surface-raised)] shadow-[var(--elev-1)]"
                    style={{ left: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {refused.map((r) => (
          <div key={r.method} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-5 py-4">
            <AlertTriangle
              className="size-3.5 shrink-0 translate-y-0.5 text-[var(--status-warn)]"
              aria-hidden
            />
            <span className="text-muted font-medium">{METHOD_LABEL[r.method as MethodKey]}</span>
            <span className="text-subtle text-xs">not applied — {r.reason}</span>
          </div>
        ))}
      </div>

      {weightsNormalised && (
        <p className="text-subtle border-t px-5 py-3 text-xs leading-relaxed">
          The weights did not sum to one, or a weighted method could not be applied, so they were
          rescaled across the methods that ran.
        </p>
      )}
    </div>
  );
}

function WeightPill({ weight }: { weight: number }) {
  return (
    <span
      className={cn(
        'surface-sunken text-subtle rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
      )}
      title="How much this method counts toward the weighted figure."
    >
      {weight}%
    </span>
  );
}
