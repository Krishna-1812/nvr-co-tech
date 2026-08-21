import type { Stage } from '@/lib/analytics/funnel';
import { NUM, number } from './Figures';
import { cn } from '@/lib/utils';

/**
 * The activation funnel.
 *
 * Built rather than reusing `Funnel` from Charts.tsx, which looks similar and is
 * answering a different question. That one draws three steps of one session's
 * progress through a form, where every step has the same subject and the same
 * unit. This has neither: the first step counts people and the rest count
 * organisations, and each step carries a count of occurrences alongside the
 * count of subjects because they diverge and the divergence is informative —
 * eleven submissions from two organisations is a different picture from eleven
 * organisations submitting once.
 *
 * Three things it does that a bar chart would not:
 *
 *   * It says what the subject of each bar is. A funnel whose unit changes
 *     halfway down and does not mention it is the most misleading chart in
 *     analytics, and this one's unit genuinely does change at step two.
 *
 *   * It states the drop rather than leaving the reader to subtract. The
 *     subtraction is the finding.
 *
 *   * It scales every bar against the first step, not against the largest
 *     value. Occurrences can exceed the first step — resubmissions count — and
 *     a bar chart that renormalises to its own maximum would quietly redraw
 *     itself into looking healthy on the day somebody resubmitted twice.
 */

const TONES = [
  'var(--h-indigo)',
  'var(--h-violet)',
  'var(--h-cyan)',
  'var(--h-emerald)',
  'var(--h-lime)',
] as const;

export function ActivationFunnel({ stages }: { stages: Stage[] }) {
  const top = stages[0]?.reached ?? 0;

  if (top === 0 && stages.every((s) => s.occurrences === 0)) {
    return (
      <p className="text-subtle px-5 py-10 text-center text-sm text-pretty">
        Nothing has been recorded yet. These figures are written by triggers inside the database
        rather than by the application, so the first row appears the moment somebody signs up —
        there is nothing to switch on.
      </p>
    );
  }

  return (
    <ol className="stagger divide-y">
      {stages.map((stage, index) => {
        const tone = TONES[index % TONES.length];
        const share = top === 0 ? 0 : stage.reached / top;
        const previous = index === 0 ? null : stages[index - 1];
        const lost = previous ? previous.reached - stage.reached : 0;
        // A change of unit between two steps makes "did not carry on" a claim
        // about two different populations, so it is only stated within a unit.
        const comparable = previous?.subject === stage.subject;

        return (
          <li key={stage.event} className="px-5 py-4" style={{ ['--tone' as string]: tone }}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="text-[13px] font-semibold">{stage.label}</span>
                <span className="text-subtle text-[11px]">
                  {stage.subject === 'person' ? 'people' : 'organisations'}
                </span>
              </div>

              <div className="flex items-baseline gap-2.5">
                <span className={cn(NUM, 'text-[1.35rem] leading-none font-semibold')}>
                  {number(stage.reached)}
                </span>
                {stage.fromPrevious !== null && comparable && (
                  <span
                    className={cn(NUM, 'rounded px-1.5 py-0.5 text-[11px] font-semibold')}
                    style={{
                      color: 'var(--tone)',
                      background: 'color-mix(in oklab, var(--tone) 14%, transparent)',
                    }}
                  >
                    {stage.fromPrevious}%
                  </span>
                )}
              </div>
            </div>

            <span
              aria-hidden
              className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-[var(--a-track)]"
            >
              <span
                className="block h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  width: `${Math.max(share * 100, stage.reached > 0 ? 1.5 : 0)}%`,
                  background:
                    'linear-gradient(90deg, color-mix(in oklab, var(--tone) 55%, transparent), var(--tone))',
                }}
              />
            </span>

            <p className="text-subtle mt-2 text-[11.5px] leading-snug text-pretty">
              {stage.says}
            </p>

            <p className="text-subtle mt-1 text-[11.5px]">
              {number(stage.occurrences)}{' '}
              {stage.occurrences === 1 ? 'occurrence' : 'occurrences'} in total
              {lost > 0 && comparable && (
                <>
                  {' · '}
                  <span style={{ color: 'var(--status-warn)' }}>
                    {number(lost)} did not carry on from the step above
                  </span>
                </>
              )}
              {previous && !comparable && (
                <>
                  {' · '}
                  measured against {previous.reached === 0 ? 'nobody' : `${number(previous.reached)} people`}, so the
                  percentage is a signup-to-workspace rate rather than a drop-off
                </>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A labelled figure with a sentence under it, for facts that are not KPIs.
 *
 * The KPI card is a heavy component — accent bar, glow, count-up — and a page
 * that opens with five of them and then wants twelve more small numbers should
 * not use it for the other twelve. This is the quiet version.
 */
export function Fact({
  label,
  value,
  says,
  tone,
}: {
  label: string;
  value: string;
  says?: string;
  tone?: string;
}) {
  return (
    <div className="border-t pt-3 first:border-t-0 first:pt-0 sm:border-t sm:pt-3">
      <p className="a-label">{label}</p>
      <p
        className={cn(NUM, 'mt-1 text-[1.25rem] leading-none font-semibold')}
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </p>
      {says && (
        <p className="text-subtle mt-1.5 text-[11.5px] leading-snug text-pretty">{says}</p>
      )}
    </div>
  );
}
