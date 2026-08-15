import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The small pieces every analytics screen is assembled from.
 *
 * The rule running through all of them: a number is shown with the thing that
 * makes it mean something, or it is not shown. A bounce rate on its own is
 * trivia; a bounce rate with the number of sessions it was computed from is a
 * finding. Every component here has somewhere for that second line to go, and
 * none of them will render without it.
 */

/** Numbers that have to line up in a column and change without shifting. */
export const NUM = 'font-mono tabular-nums';

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'var(--color-brand-500)',
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  /** What the figure rests on. Never optional in practice. */
  hint: string;
  icon?: ReactNode;
  tone?: string;
  /** One tile per screen, at most. It is the answer to the screen's question. */
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        'surface-lit hover-lift group relative overflow-hidden rounded-2xl p-4',
        emphasis && 'sm:row-span-1',
      )}
      style={{ ['--tone' as string]: tone }}
    >
      {/* A wash of the tile's own colour from the top-right, so a grid of tiles
          reads as a set of different things rather than a set of boxes. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 size-32 rounded-full opacity-[0.16] blur-2xl transition-opacity duration-300 group-hover:opacity-30"
        style={{ background: `radial-gradient(circle, ${tone}, transparent 70%)` }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="a-label text-subtle">{label}</p>
        {icon && (
          <span className="grid size-7 shrink-0 place-items-center rounded-lg border" style={{ color: tone, borderColor: `color-mix(in oklab, ${tone} 28%, var(--border-c))`, background: `color-mix(in oklab, ${tone} 10%, var(--surface-sunken))` }}>
            {icon}
          </span>
        )}
      </div>

      <p
        className={cn(
          NUM,
          'relative mt-3 leading-none font-semibold tracking-tight',
          emphasis ? 'text-[2.1rem]' : 'text-[1.65rem]',
        )}
      >
        {value}
      </p>
      <p className="text-subtle relative mt-2 text-[12px] leading-snug text-pretty">{hint}</p>
    </div>
  );
}

/**
 * A proportion, drawn.
 *
 * Used for confidence, for intent and for a share of a total. The track is
 * always the full width so that two meters on the same screen can be compared
 * by eye, which is the only reason to draw a number as a bar at all.
 */
export function Meter({
  value,
  tone = 'var(--color-brand-500)',
  className,
  label,
}: {
  /** 0 to 1. */
  value: number;
  tone?: string;
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;

  return (
    <span
      role="img"
      aria-label={label ?? `${Math.round(pct)} percent`}
      className={cn('block h-1.5 w-full overflow-hidden rounded-full bg-[var(--a-track)]', className)}
    >
      <span
        className="block h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, color-mix(in oklab, ${tone} 55%, transparent), ${tone})` }}
      />
    </span>
  );
}

/** A small tinted chip. `--tone` drives it, like every other status in the app. */
export function Pill({
  tone,
  children,
  className,
  title,
}: {
  tone: string;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{ ['--tone' as string]: tone }}
      className={cn(
        'tinted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-semibold whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A dot in a tool's or a status's colour. Used wherever a legend is needed. */
export function Dot({ tone, className }: { tone: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-1.5 shrink-0 rounded-full', className)}
      style={{ background: tone }}
    />
  );
}

/** Seconds, said the way a person would say them. */
export function duration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** A count, grouped the Indian way, because that is where this is read. */
export const number = (n: number): string => n.toLocaleString('en-IN');

/** How long ago, in the fewest words that are still true. */
export function ago(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;

  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
