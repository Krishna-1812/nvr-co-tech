import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Screen state that belongs in the URL, rendered as links.
 *
 * Links rather than client-side controls, so both the window and the segment are
 * in the address bar. That matters more here than on most screens: an analytics
 * finding is something people send each other, and a figure you cannot link
 * somebody to is a figure you have to describe over a call.
 *
 * The two controls have to know about each other, because a screen carrying both
 * would otherwise drop one every time you touched the other — pick 7 days and
 * lose the segment, pick the segment and snap back to 30 days. `query` below is
 * the whole fix, and it also keeps the default out of the URL so the tidy link
 * is the one you get by default rather than one you have to construct.
 */

const query = (base: string, params: Record<string, string | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const rest = search.toString();
  return rest ? `${base}?${rest}` : base;
};

const TAB_GROUP =
  'surface-sunken inline-flex items-center gap-0.5 rounded-xl border p-0.5';

const tab = (active: boolean): string =>
  cn(
    'rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold transition',
    active
      ? 'bg-[var(--surface-raised)] text-[var(--text-c)] shadow-[var(--elev-1)]'
      : 'text-subtle hover:text-[var(--text-c)]',
  );

// ─── How far back ────────────────────────────────────────────────────────────

export const WINDOWS = [7, 30, 90] as const;
export type Window = (typeof WINDOWS)[number];

/** Reads ?days= safely, falling back to a month. */
export function windowFrom(value: string | undefined): Window {
  const n = Number(value);
  return (WINDOWS as readonly number[]).includes(n) ? (n as Window) : 30;
}

export function WindowTabs({
  current,
  base,
  who,
}: {
  current: Window;
  base: string;
  /** Carried through so changing the window does not reset the segment. */
  who?: Who;
}) {
  return (
    <div role="group" aria-label="Time window" className={TAB_GROUP}>
      {WINDOWS.map((days) => (
        <Link
          key={days}
          href={query(base, {
            days: days === 30 ? undefined : String(days),
            who: who === 'us' ? 'us' : undefined,
          })}
          aria-current={days === current ? 'true' : undefined}
          className={tab(days === current)}
        >
          {days}d
        </Link>
      ))}
    </div>
  );
}

// ─── Whose activity ──────────────────────────────────────────────────────────

/**
 * Them or us.
 *
 * One screen rather than two, and the distinction is the point of having it: a
 * customer-success figure that quietly folds our own demonstrating and fixing
 * into "adoption" reads as adoption when it is not. So the split is by the
 * analytics allowlist — people on it are us, everybody else signed in is them —
 * and it is never a sum. There is deliberately no "everyone" tab, because the
 * combined number is the misleading one.
 */
export const WHO = ['them', 'us'] as const;
export type Who = (typeof WHO)[number];

export const WHO_LABEL: Record<Who, string> = { them: 'Customers', us: 'Our team' };

/** Reads ?who= safely, falling back to the customers, who are the point. */
export function whoFrom(value: string | undefined): Who {
  return value === 'us' ? 'us' : 'them';
}

export function WhoTabs({
  current,
  base,
  days,
}: {
  current: Who;
  base: string;
  /** Carried through so changing the segment does not reset the window. */
  days?: Window;
}) {
  return (
    <div role="group" aria-label="Whose activity" className={TAB_GROUP}>
      {WHO.map((who) => (
        <Link
          key={who}
          href={query(base, {
            who: who === 'them' ? undefined : who,
            days: days && days !== 30 ? String(days) : undefined,
          })}
          aria-current={who === current ? 'true' : undefined}
          className={tab(who === current)}
        >
          {WHO_LABEL[who]}
        </Link>
      ))}
    </div>
  );
}
