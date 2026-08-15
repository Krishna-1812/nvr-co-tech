'use client';

import { useId, useMemo, useState } from 'react';
import type { Counted } from '@/lib/analytics/aggregate';
import { cn } from '@/lib/utils';
import { NUM, number } from './Figures';

/**
 * The charts.
 *
 * Hand-drawn SVG rather than a charting library, for the same reason the
 * markdown renderer in the assistant is hand-written: there are four shapes on
 * these screens, every one of them is thirty lines, and a library would bring a
 * second design system with its own opinions about type, colour and spacing
 * that would then have to be fought back into agreement with this one.
 *
 * They are client components only because of hover. Everything they draw is
 * decided on the server.
 */

// ─── Trend ───────────────────────────────────────────────────────────────────

export type Point = { day: string; views: number; visitors: number };

/**
 * Daily traffic, as an area with a line on top.
 *
 * The area is what makes a quiet week look quiet at a glance; the line is what
 * lets two adjacent days be compared. The horizontal rules are drawn behind
 * both, faintly, because a chart with no gridlines is a shape rather than a
 * measurement.
 */
export function Trend({ points, height = 168 }: { points: Point[]; height?: number }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const width = 720;
  const pad = { top: 12, right: 4, bottom: 22, left: 4 };
  const inner = { w: width - pad.left - pad.right, h: height - pad.top - pad.bottom };

  const peak = Math.max(1, ...points.map((p) => p.views));

  const geometry = useMemo(() => {
    const x = (i: number) => pad.left + (points.length <= 1 ? inner.w / 2 : (i / (points.length - 1)) * inner.w);
    const y = (v: number) => pad.top + inner.h - (v / peak) * inner.h;

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.views).toFixed(1)}`).join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)},${pad.top + inner.h} L${x(0).toFixed(1)},${pad.top + inner.h} Z`;

    return { x, y, line, area };
  }, [points, peak, inner.h, inner.w, pad.left, pad.top]);

  if (points.length === 0) return null;

  const active = hover != null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-[168px] w-full overflow-visible"
        role="img"
        aria-label={`Page views over the last ${points.length} days`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - box.left) / box.width;
          setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1={pad.left}
            x2={width - pad.right}
            y1={pad.top + inner.h * fraction}
            y2={pad.top + inner.h * fraction}
            stroke="var(--border-c)"
            strokeWidth={1}
            strokeDasharray={fraction === 1 ? undefined : '3 5'}
          />
        ))}

        <path d={geometry.area} fill={`url(#${gradientId})`} />
        <path
          d={geometry.line}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {hover != null && (
          <>
            <line
              x1={geometry.x(hover)}
              x2={geometry.x(hover)}
              y1={pad.top}
              y2={pad.top + inner.h}
              stroke="var(--border-strong)"
              strokeWidth={1}
            />
            <circle
              cx={geometry.x(hover)}
              cy={geometry.y(points[hover].views)}
              r={4}
              fill="var(--surface-raised)"
              stroke="var(--color-brand-500)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      {/* The readout sits outside the SVG so it can use the page's own type. */}
      <div className="text-subtle mt-1 flex items-center justify-between text-[11px]">
        <span>{label(points[0].day)}</span>
        <span
          className={cn('transition-opacity', active ? 'opacity-100' : 'opacity-0')}
          aria-live="polite"
        >
          {active && (
            <span className="text-[var(--text-c)]">
              <span className="font-semibold">{label(active.day)}</span>
              <span className={cn(NUM, 'ml-2')}>{number(active.views)} views</span>
              <span className={cn(NUM, 'text-subtle ml-2')}>{number(active.visitors)} people</span>
            </span>
          )}
        </span>
        <span>{label(points[points.length - 1].day)}</span>
      </div>
    </div>
  );
}

const label = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// ─── Bar list ────────────────────────────────────────────────────────────────

/**
 * A ranked list where the bar is the row's own background rather than a
 * separate column. Reading the label and reading the magnitude become one
 * movement instead of two, and nothing has to be aligned across a gutter.
 */
export function BarList({
  items,
  tone = 'var(--color-brand-500)',
  empty = 'Nothing yet.',
  format = number,
  href,
}: {
  items: Counted[];
  tone?: string;
  empty?: string;
  format?: (n: number) => string;
  href?: (label: string) => string | null;
}) {
  if (items.length === 0) {
    return <p className="text-subtle px-5 py-8 text-center text-sm">{empty}</p>;
  }

  const peak = Math.max(...items.map((i) => i.count));

  return (
    <ol className="stagger divide-y">
      {items.map((item) => {
        const link = href?.(item.label);
        const inner = (
          <>
            <span
              aria-hidden
              className="absolute inset-y-[3px] left-0 rounded-[6px] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                width: `${Math.max((item.count / peak) * 100, 2)}%`,
                background: `color-mix(in oklab, ${tone} 14%, transparent)`,
              }}
            />
            <span className="relative min-w-0 flex-1 truncate pr-3 text-[13px]" title={item.label}>
              {item.label}
            </span>
            <span className={cn(NUM, 'relative shrink-0 text-[13px] font-semibold')}>
              {format(item.count)}
            </span>
          </>
        );

        return (
          <li key={item.label} className="relative">
            {link ? (
              <a
                href={link}
                className="relative flex items-center px-4 py-2 transition-colors hover:bg-[var(--surface-sunken)]"
              >
                {inner}
              </a>
            ) : (
              <div className="relative flex items-center px-4 py-2">{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Split ───────────────────────────────────────────────────────────────────

const PALETTE = [
  'var(--h-indigo)',
  'var(--h-cyan)',
  'var(--h-violet)',
  'var(--h-emerald)',
  'var(--h-amber)',
  'var(--h-rose)',
];

/**
 * A breakdown as one bar rather than several.
 *
 * Device, browser and system are all "these add up to everything", and a stack
 * says that where a row of separate bars does not. The tail is folded into
 * "Other" past five slices, because a bar made of fifteen two-pixel segments is
 * decoration.
 */
export function Split({ items, empty = 'Nothing yet.' }: { items: Counted[]; empty?: string }) {
  if (items.length === 0) {
    return <p className="text-subtle px-5 py-8 text-center text-sm">{empty}</p>;
  }

  const total = items.reduce((sum, i) => sum + i.count, 0) || 1;
  const head = items.slice(0, 5);
  const tail = items.slice(5).reduce((sum, i) => sum + i.count, 0);
  const slices = tail > 0 ? [...head, { label: 'Other', count: tail }] : head;

  return (
    <div className="px-5 py-4">
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {slices.map((slice, index) => (
          <span
            key={slice.label}
            title={`${slice.label} — ${Math.round((slice.count / total) * 100)}%`}
            style={{
              width: `${(slice.count / total) * 100}%`,
              background: PALETTE[index % PALETTE.length],
            }}
            className="first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>

      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {slices.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-2 text-[12.5px]">
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: PALETTE[index % PALETTE.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{slice.label}</span>
            <span className={cn(NUM, 'text-subtle shrink-0')}>
              {Math.round((slice.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Funnel ──────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<string, string> = {
  open: 'Opened the form',
  started: 'Started filling it in',
  submitted: 'Sent it',
};

/**
 * The lead funnel, with the drop between steps stated rather than implied.
 *
 * A funnel drawn as three bars leaves the reader to do the subtraction, and the
 * subtraction is the entire finding. So each step past the first says how many
 * did not carry on.
 */
export function Funnel({ steps }: { steps: { stage: string; sessions: number }[] }) {
  const top = steps[0]?.sessions ?? 0;

  if (top === 0) {
    return (
      <p className="text-subtle px-5 py-8 text-center text-sm">
        Nobody has opened the lead form in this window.
      </p>
    );
  }

  return (
    <ol className="stagger space-y-3 px-5 py-4">
      {steps.map((step, index) => {
        const share = step.sessions / top;
        const lost = index === 0 ? 0 : steps[index - 1].sessions - step.sessions;

        return (
          <li key={step.stage}>
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="font-medium">{STAGE_LABEL[step.stage] ?? step.stage}</span>
              <span className={NUM}>
                {number(step.sessions)}
                <span className="text-subtle ml-1.5 font-normal">{Math.round(share * 100)}%</span>
              </span>
            </div>

            <span className="mt-1.5 block h-2 w-full overflow-hidden rounded-full bg-[var(--a-track)]">
              <span
                className="block h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  width: `${Math.max(share * 100, 1.5)}%`,
                  background: 'linear-gradient(90deg, var(--h-indigo), var(--h-violet))',
                }}
              />
            </span>

            {lost > 0 && (
              <p className="text-subtle mt-1 text-[11px]">
                {number(lost)} did not carry on from here.
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
