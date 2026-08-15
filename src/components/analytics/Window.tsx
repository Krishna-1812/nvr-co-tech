import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * How far back the screen is looking.
 *
 * Links rather than a client-side control, so the window is in the URL. That
 * matters more here than on most screens: an analytics finding is something
 * people send each other, and a figure you cannot link somebody to is a figure
 * you have to describe over a call.
 */

export const WINDOWS = [7, 30, 90] as const;
export type Window = (typeof WINDOWS)[number];

/** Reads ?days= safely, falling back to a month. */
export function windowFrom(value: string | undefined): Window {
  const n = Number(value);
  return (WINDOWS as readonly number[]).includes(n) ? (n as Window) : 30;
}

export function WindowTabs({ current, base }: { current: Window; base: string }) {
  return (
    <div
      role="group"
      aria-label="Time window"
      className="surface-sunken inline-flex items-center gap-0.5 rounded-xl border p-0.5"
    >
      {WINDOWS.map((days) => (
        <Link
          key={days}
          href={days === 30 ? base : `${base}?days=${days}`}
          aria-current={days === current ? 'true' : undefined}
          className={cn(
            'rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold transition',
            days === current
              ? 'bg-[var(--surface-raised)] text-[var(--text-c)] shadow-[var(--elev-1)]'
              : 'text-subtle hover:text-[var(--text-c)]',
          )}
        >
          {days}d
        </Link>
      ))}
    </div>
  );
}
