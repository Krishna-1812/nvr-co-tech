'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The KPI card, in its two variants — the single most reused component in the
 * analytics section, and the thing every one of these pages opens with.
 *
 * Two rules run through both variants and are worth stating because they are
 * departures from what dashboards usually do:
 *
 * 1. **No deltas.** Not one card carries a "vs last period" arrow. A comparison
 *    needs a like-for-like previous window, and for most of these figures there
 *    isn't one — a tenant that joined last week has no last month, and an arrow
 *    computed against a partial window is a confident lie. Every number here is
 *    a plain statement of current state.
 * 2. **Clickable is a property of the metric, not the page.** A count of people
 *    has something to drill into; a derived average does not. Cards decide this
 *    individually, and a card with nothing behind it is rendered as a plain
 *    `div` so it never invites a click that would do nothing.
 */

export type KpiVariant = 'flat' | 'rich';

/**
 * The row.
 *
 * `auto-fit` rather than a fixed column count, so the same component serves a
 * page with four cards and a page with ten without either being told about the
 * other. `flow: 'flex'` exists for one specific case: an odd card count. A grid
 * strands the remainder on a last row of empty space — seven cards become four
 * plus three orphans — whereas flex-wrap lets a short final row stretch to fill
 * the width. Reach for it whenever the count is not a comfortable multiple.
 */
export function KpiRow({
  children,
  flow = 'grid',
  className,
}: {
  children: ReactNode;
  flow?: 'grid' | 'flex';
  className?: string;
}) {
  return (
    <section
      className={cn(
        flow === 'grid'
          ? 'grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3'
          : 'flex flex-wrap gap-3 [&>*]:flex-[1_1_240px]',
        className,
      )}
    >
      {children}
    </section>
  );
}

/**
 * A number that counts up to itself on arrival.
 *
 * Eased rather than linear, and driven by rAF against elapsed time rather than
 * a fixed per-frame step, so the duration is the same on a 60Hz and a 144Hz
 * display. Anybody who has asked for less motion gets the final value
 * immediately — the animation is decoration, and the figure is the content.
 */
function useCountUp(target: number | null, ms = 900): number {
  // Seeded with the final value, not zero. Two things fall out of that: the
  // server-rendered HTML carries the real figure rather than a placeholder, so
  // there is nothing for hydration to disagree about; and anybody who has asked
  // for reduced motion needs no special case at all, because doing nothing
  // already leaves the correct number on screen.
  const [shown, setShown] = useState(target ?? 0);
  const frame = useRef(0);

  useEffect(() => {
    if (target === null || target === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / ms);
      // Cubic ease-out: fast enough to feel responsive, settles without a bounce.
      setShown(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, ms]);

  return shown;
}

export function KpiCard({
  label,
  /** Pass a number to have it count up. Pass a string for anything already formatted. */
  value,
  caption,
  accent,
  icon,
  variant = 'flat',
  onClick,
  href,
  format = (n) => n.toLocaleString('en-IN'),
  className,
}: {
  label: string;
  value: number | string;
  /** The line that makes the number mean something. Optional, but usually the point. */
  caption?: string;
  accent: string;
  /** Only rendered by the rich variant. */
  icon?: ReactNode;
  variant?: KpiVariant;
  onClick?: () => void;
  /**
   * A whole screen as the drill-down, rather than a panel.
   *
   * Where a card's breakdown already exists as a page, sending somebody there
   * beats rebuilding a lesser version of it in a drawer — and it keeps one
   * implementation of those numbers rather than two that can disagree. Mutually
   * exclusive with onClick: a card has one behaviour.
   */
  href?: string;
  format?: (n: number) => string;
  className?: string;
}) {
  const numeric = typeof value === 'number' ? value : null;
  const counted = useCountUp(numeric);
  const shown = numeric === null ? (value as string) : format(counted);

  const rich = variant === 'rich';
  const clickable = Boolean(onClick) || Boolean(href);

  const card = (
    <div
      // A card that drills down is a button; a card that doesn't is not. Rendering
      // the inert ones as buttons would put them in the tab order and promise an
      // interaction that never happens.
      {...(onClick
        ? { role: 'button' as const, tabIndex: 0, onClick, onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); }
          } }
        : {})}
      aria-label={onClick ? `${label}: ${shown}. Open breakdown` : undefined}
      style={{ ['--tone' as string]: accent }}
      className={cn(
        'group relative isolate overflow-hidden rounded-2xl border bg-[var(--surface-raised)] p-4',
        // hover-lift carries the house transition, the lift and the elevation, and
        // is already reduced-motion aware. Reusing it rather than hand-rolling the
        // spec's -3px keeps every card in the product lifting by the same amount.
        clickable && 'hover-lift a-ring cursor-pointer',
        clickable && 'hover:border-[color-mix(in_oklab,var(--tone)_38%,var(--border-c))]',
        className,
      )}
    >
      {/* The accent bar. Two pixels, the full width, and the only part of the
          card that is pure colour — it is what makes a row of cards read as a
          set of different measures rather than a set of boxes. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 z-10 h-[2px]"
        style={{
          background: `linear-gradient(90deg, color-mix(in oklab, var(--tone) 40%, transparent), var(--tone))`,
        }}
      />

      {/* The corner glow. On the rich variant it breathes continuously; on the
          flat one it only lifts on hover, because a page of ten flat cards all
          pulsing at once is noise rather than life. */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute -top-14 -right-10 -z-10 size-32 rounded-full blur-2xl',
          rich
            ? 'motion-safe:animate-[breathe_6.5s_ease-in-out_infinite] opacity-50'
            : 'opacity-[0.14] transition-opacity duration-500 group-hover:opacity-[0.28]',
        )}
        style={{
          // The rich variant's glow is animated by `breathe`, which drives opacity
          // between .35 and .75 — far too strong for a full-strength accent. So the
          // colour itself is diluted here and the animation supplies the movement,
          // rather than fighting the animation with a competing opacity class it
          // would override anyway.
          background: rich
            ? 'radial-gradient(circle, color-mix(in oklab, var(--tone) 42%, transparent), transparent 70%)'
            : 'radial-gradient(circle, var(--tone), transparent 70%)',
        }}
      />

      {/* The sheen, rich variant only: a diagonal highlight parked off the left
          edge that travels across once on hover. A transform rather than a
          keyframe, so it cannot reflow anything and it reverses cleanly if the
          pointer leaves halfway. */}
      {rich && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 -translate-x-full bg-[linear-gradient(105deg,transparent_35%,color-mix(in_oklab,var(--tone)_22%,transparent)_50%,transparent_65%)] transition-transform duration-700 ease-out group-hover:translate-x-full motion-reduce:hidden"
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <p className="a-label">{label}</p>
        {rich && icon && (
          <span
            className="grid size-8 shrink-0 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[8deg] motion-reduce:transform-none"
            style={{
              color: 'var(--tone)',
              background: 'color-mix(in oklab, var(--tone) 16%, transparent)',
            }}
          >
            {icon}
          </span>
        )}
      </div>

      <p
        className={cn('a-figure mt-3 text-[2.2rem]', rich && 'w-fit')}
        // The spec's gradient-clipped number runs white-into-accent, which only
        // works on a dark ground. Running it from the theme's own text colour
        // keeps the effect in light mode instead of fading the figure to
        // near-invisible against white.
        style={
          rich
            ? {
                background:
                  'linear-gradient(135deg, var(--text-c) 10%, color-mix(in oklab, var(--tone) 85%, var(--text-c)) 95%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }
            : undefined
        }
      >
        {shown}
      </p>

      {caption && (
        <p className="text-subtle mt-2 text-[12px] leading-snug text-pretty">{caption}</p>
      )}
    </div>
  );

  // Wrapped rather than rendered as an anchor, so the card keeps one shape and
  // the link keeps real link behaviour: middle-click, open in a new tab, and a
  // status bar that shows where it goes.
  return href ? (
    <Link href={href} className="a-ring block rounded-2xl" aria-label={`${label}: ${shown}`}>
      {card}
    </Link>
  ) : (
    card
  );
}
