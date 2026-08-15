import { ChevronDown } from 'lucide-react';
import { STAGE_COPY } from '@/lib/analytics/intent';
import type { IntentScore } from '@/lib/analytics/types';
import { cn } from '@/lib/utils';
import { Meter, NUM, Pill } from './Figures';

/**
 * How close an account looks, and why.
 *
 * The "why" is not an extra. A score with no working shown gets treated as an
 * oracle by half its readers and as noise by the other half, and both are ways
 * of not using it. Every score on these screens can be opened to show exactly
 * which behaviours contributed and how many points each was worth, so somebody
 * can disagree with it — which is the only way they will ever act on it.
 */

export const STAGE_TONE: Record<string, string> = {
  decision: 'var(--status-approved)',
  consideration: 'var(--h-cyan)',
  interest: 'var(--status-warn)',
  awareness: 'var(--status-draft)',
};

export function IntentBadge({ intent, className }: { intent: IntentScore; className?: string }) {
  const copy = STAGE_COPY[intent.stage];

  return (
    <Pill tone={STAGE_TONE[intent.stage]} className={className} title={copy.meaning}>
      <span>{copy.label}</span>
      <span className={cn(NUM, 'opacity-70')}>{intent.score}</span>
    </Pill>
  );
}

export function IntentBreakdown({ intent }: { intent: IntentScore }) {
  const tone = STAGE_TONE[intent.stage];

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium">{STAGE_COPY[intent.stage].label}</span>
            <span className={cn(NUM, 'text-[13px] font-semibold')} style={{ color: tone }}>
              {intent.score}
              <span className="text-subtle font-normal"> / 100</span>
            </span>
          </span>
          <Meter value={intent.score / 100} tone={tone} className="mt-2" label={`Intent ${intent.score} out of 100`} />
        </span>
        <ChevronDown
          className="text-subtle size-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <p className="text-subtle mt-3 text-[12px] leading-relaxed">
        {STAGE_COPY[intent.stage].meaning}
      </p>

      <ul className="mt-3 space-y-1.5 border-t pt-3">
        {intent.factors.map((factor) => (
          <li key={factor.label} className="flex items-baseline justify-between gap-3 text-[12px]">
            <span className="text-muted min-w-0 flex-1">{factor.label}</span>
            <span className={cn(NUM, 'shrink-0 font-semibold')}>+{factor.points}</span>
          </li>
        ))}
        {intent.factors.length === 0 && (
          <li className="text-subtle text-[12px]">Nothing has counted towards this yet.</li>
        )}
      </ul>
    </details>
  );
}
