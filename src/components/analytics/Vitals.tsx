import type { Vitals as VitalsShape } from '@/lib/analytics/aggregate';
import { cn } from '@/lib/utils';
import { NUM, number } from './Figures';

/**
 * Core Web Vitals, with the thresholds drawn rather than described.
 *
 * A raw millisecond figure means nothing to most people who will look at this
 * screen. What means something is where it sits against the boundary Google
 * uses, so each one is a bar with the good/needs-work/poor bands behind it and
 * a marker on the value.
 *
 * The sample size is stated under all three, because an LCP averaged over four
 * page views is a number rather than a finding, and only the reader can decide
 * which one they are looking at.
 */

type Band = { good: number; poor: number; format: (n: number) => string };

const BANDS: Record<'lcp' | 'cls' | 'inp', Band> = {
  lcp: { good: 2_500, poor: 4_000, format: (n) => `${(n / 1000).toFixed(2)}s` },
  cls: { good: 0.1, poor: 0.25, format: (n) => n.toFixed(3) },
  inp: { good: 200, poor: 500, format: (n) => `${Math.round(n)}ms` },
};

const TITLES: Record<'lcp' | 'cls' | 'inp', { name: string; what: string }> = {
  lcp: { name: 'Largest paint', what: 'How long until the main thing appears.' },
  cls: { name: 'Layout shift', what: 'How much the page moves under you while it loads.' },
  inp: { name: 'Interaction', what: 'How long a tap or click takes to show it worked.' },
};

function verdict(key: 'lcp' | 'cls' | 'inp', value: number) {
  const { good, poor } = BANDS[key];
  if (value <= good) return { label: 'Good', tone: 'var(--status-approved)' };
  if (value <= poor) return { label: 'Needs work', tone: 'var(--status-warn)' };
  return { label: 'Poor', tone: 'var(--status-rejected)' };
}

export function Vitals({ vitals }: { vitals: VitalsShape }) {
  const entries = (['lcp', 'cls', 'inp'] as const).filter((key) => vitals[key] != null);

  if (entries.length === 0) {
    return (
      <p className="text-subtle px-5 py-8 text-center text-sm">
        No page has reported a timing yet. These arrive with the first real visit from a browser
        that supports them.
      </p>
    );
  }

  return (
    <div className="px-5 py-4">
      <ul className="space-y-4">
        {entries.map((key) => {
          const value = vitals[key]!;
          const band = BANDS[key];
          const state = verdict(key, value);
          // The scale runs to twice the poor threshold, so a bad score still
          // has somewhere to sit rather than pinning to the right-hand edge.
          const scale = band.poor * 2;
          const at = Math.min((value / scale) * 100, 100);

          return (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium">{TITLES[key].name}</span>
                <span className="flex items-baseline gap-2">
                  <span className={cn(NUM, 'text-[13px] font-semibold')}>{band.format(value)}</span>
                  <span className="text-[11px] font-semibold" style={{ color: state.tone }}>
                    {state.label}
                  </span>
                </span>
              </div>

              <span className="relative mt-2 flex h-1.5 w-full overflow-hidden rounded-full">
                <span
                  style={{ width: `${(band.good / scale) * 100}%`, background: 'color-mix(in oklab, var(--status-approved) 45%, transparent)' }}
                />
                <span
                  style={{ width: `${((band.poor - band.good) / scale) * 100}%`, background: 'color-mix(in oklab, var(--status-warn) 45%, transparent)' }}
                />
                <span
                  className="flex-1"
                  style={{ background: 'color-mix(in oklab, var(--status-rejected) 40%, transparent)' }}
                />
                <span
                  aria-hidden
                  className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface-raised)]"
                  style={{ left: `${at}%`, background: state.tone }}
                />
              </span>

              <p className="text-subtle mt-1.5 text-[11px]">{TITLES[key].what}</p>
            </li>
          );
        })}
      </ul>

      <p className="text-subtle mt-4 border-t pt-3 text-[11px]">
        Averaged over {number(vitals.sampled)} page{' '}
        {vitals.sampled === 1 ? 'view that' : 'views that'} actually reported a timing. Views that
        did not measure one are left out rather than counted as instant.
      </p>
    </div>
  );
}
