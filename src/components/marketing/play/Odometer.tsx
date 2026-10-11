'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useInView } from '../scroll';

/**
 * A figure whose digits roll into place like a mechanical counter.
 *
 * Every digit is a window onto a strip of 0–9, twice over, and the strip slides
 * to show the right one. The second copy is what makes the entrance a roll
 * rather than a nudge: the strip starts at the top of the first set and travels
 * a whole turn plus the digit, so even a zero spins on its way in. The leading
 * digits travel longest, so the figure settles from the left the way a counter
 * rolling over does.
 *
 * When the value changes afterwards (the playground's grand total, as the
 * reader moves a slider) the same strips slide between their old and new
 * digits by transition, so a total going from ₹2,13,440 to ₹2,31,840 is seen to
 * turn rather than to be replaced.
 *
 * ── What it never does ────────────────────────────────────────────────────
 *
 * It never shows a number that is not the figure. The final value is in the
 * markup from the first byte, in a visually hidden copy for screen readers and
 * as the resting position of every strip, so with scripting off, with reduced
 * motion, or before the roll has fired, what is on screen is the right number.
 * Commas, the rupee sign, the decimal point and the minus sign do not roll;
 * they stand where they are.
 *
 * Columns are matched from the right, so a total that gains a digit grows a new
 * column on the left and every existing one keeps its place.
 *
 * Each column is sized by an invisible copy of its own final digit, so a "1"
 * is as narrow as a "1" set in plain type — the counter does not space a figure
 * out into a row of equal-width cells.
 */
export function Odometer({
  value,
  roll = 'view',
  delay = 0,
  className,
}: {
  value: string;
  /**
   * When the entrance roll plays. `load` for a figure that is on screen at
   * once, `view` for one the reader scrolls to, `none` for a figure that
   * should only roll when it changes.
   */
  roll?: 'load' | 'view' | 'none';
  /** Milliseconds before an entrance roll starts. */
  delay?: number;
  className?: string;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const seen = useInView(host, { margin: 0.92 });
  const chars = Array.from(value);
  const digits = chars.filter((c) => /\d/.test(c)).length;
  let d = 0;

  return (
    <span
      ref={host}
      className={cn(
        'm-odo',
        roll === 'load' && 'is-rolling',
        roll === 'view' && seen && 'is-rolling',
        className,
      )}
      style={{ '--odo-delay': `${delay}ms` } as React.CSSProperties}
    >
      <span className="sr-only">{value}</span>
      <span aria-hidden className="m-odo-row">
        {chars.map((c, k) => {
          // Keyed from the right, so React keeps a column's strip (and with it
          // the transition) when the figure grows or shrinks on the left.
          const key = chars.length - k;
          if (!/\d/.test(c)) {
            return (
              <span key={`s${key}`} className="m-odo-sep">
                {c}
              </span>
            );
          }
          const lead = digits - d++;
          return (
            <span key={`d${key}`} className="m-odo-col">
              <span className="m-odo-size">{c}</span>
              <span
                className="m-odo-strip"
                style={
                  {
                    '--d': c,
                    '--t': `${900 + lead * 140}ms`,
                  } as React.CSSProperties
                }
              >
                {STRIP}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

const STRIP = Array.from({ length: 20 }, (_, n) => <span key={n}>{n % 10}</span>);
