'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Every way this app offers to go somewhere: the desktop rail, the phone dock and
 * the tabs inside Admin.
 *
 * All three share the same idea of what "active" means and the same pending
 * feedback, which is the reason they are one component rather than three. The
 * three looks are genuinely different shapes, though, so they are separate
 * branches rather than one shape with a modifier.
 */

type Variant = 'rail' | 'dock' | 'tab';

export function NavLink({
  href,
  label,
  shortLabel,
  icon,
  badge,
  exact,
  variant = 'rail',
  children,
}: {
  href: string;
  label?: string;
  /**
   * Shown instead of `label` in a dock cell too narrow for the real one, which
   * is a phone at six destinations and nothing wider — a tablet cell is 125px
   * and holds "Organisations" with room to spare, so the abbreviation stops at
   * `sm`. `label` stays the accessible name at every width.
   */
  shortLabel?: string;
  /*
   * An already-rendered element, not a component.
   *
   * This is a client component, and a Lucide icon is a function — which cannot
   * cross the boundary from the server components that render the rail and the
   * dock. An element can, so the caller does the rendering and picks its own
   * size, which the two variants want to differ on anyway.
   */
  icon?: React.ReactNode;
  badge?: number;
  /** Match this path only, not its subtree. Needed for tabs like /admin. */
  exact?: boolean;
  variant?: Variant;
  /** Tabs carry their own label as children; rail and dock take `label`. */
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  // "/" must match exactly; everything else matches its subtree unless told not to.
  const active = href === '/' || exact ? pathname === href : pathname.startsWith(href);
  const count = badge && badge > 0 ? badge : 0;

  if (variant === 'tab') {
    return (
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative -mb-px inline-flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3.5 py-2.5 text-sm font-medium transition',
          active
            ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
            : 'text-muted border-transparent hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]',
        )}
      >
        {children}
        <Pending className="inset-x-0 bottom-0" />
      </Link>
    );
  }

  if (variant === 'dock') {
    return (
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        aria-label={shortLabel && shortLabel !== label ? label : undefined}
        className="group relative flex flex-col items-center gap-1 rounded-xl px-2 py-1.5"
      >
        <span className="relative">
          <span
            className={cn(
              'grid size-9 place-items-center rounded-xl transition',
              active
                ? 'gradient-brand elev-brand'
                : 'text-subtle group-active:bg-[var(--surface-sunken)]',
            )}
          >
            {icon}
          </span>
          {count > 0 && <Count value={count} className="-top-1 -right-1.5" />}
        </span>
        <span
          className={cn(
            'text-[10px] leading-none font-semibold transition-colors',
            active ? 'text-[var(--text-c)]' : 'text-subtle',
          )}
        >
          {shortLabel && shortLabel !== label ? (
            <>
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </>
          ) : (
            label
          )}
        </span>
        <Pending className="inset-x-2 top-0 rounded-full" />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      title={label}
      className={cn(
        'a-rail-item group relative flex items-center gap-3 overflow-hidden rounded-xl px-2.5 py-2 text-sm transition',
        active
          ? 'font-semibold text-[var(--text-c)]'
          : 'text-muted font-medium hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]',
      )}
    >
      {/*
        The active item is a brand wash that fades out to the right rather than a
        filled pill. A pill in a 15rem rail is a solid block of colour a third of
        the way down the screen, and it competes with the work; a wash says the
        same thing and stays behind the label.
      */}
      {active && (
        <>
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--color-brand-500)_16%,transparent),transparent_78%)]"
          />
          <span
            aria-hidden
            className="gradient-brand absolute top-1/2 left-0 h-6 w-[3px] -translate-y-1/2 rounded-r-full"
          />
        </>
      )}

      {/*
        The icon lives in its own tile, which is the whole item once the rail is
        collapsed. That is why the active treatment is on the tile and not only on
        the text: at 4.75rem wide there is no text to treat.
      */}
      <span
        className={cn(
          'relative grid size-8 shrink-0 place-items-center rounded-lg transition',
          active
            ? 'gradient-brand elev-brand'
            : 'surface-sunken text-subtle group-hover:text-[var(--text-c)]',
        )}
      >
        {icon}
        {/* Collapsed, there is no room for a figure, so the count becomes a dot. */}
        {count > 0 && (
          <span
            aria-hidden
            className="a-rail-narrow absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-red-500 ring-2 ring-[var(--surface)]"
          />
        )}
      </span>

      <span className="a-rail-wide relative min-w-0 flex-1 truncate">{label}</span>
      {count > 0 && <Count value={count} className="a-rail-wide relative" />}
      <Pending className="inset-x-2 bottom-0.5" />
    </Link>
  );
}

/** The queue count. Red because it is work that has stopped moving. */
function Count({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        'grid min-w-4.5 shrink-0 animate-[pop_0.35s_cubic-bezier(0.34,1.56,0.64,1)] place-items-center rounded-full bg-red-500 px-1 text-[10px] leading-none font-bold text-white',
        className,
      )}
      aria-label={`${value} waiting`}
    >
      {value > 99 ? '99+' : value}
    </span>
  );
}

/**
 * A hairline that crawls while this link's destination is still being fetched.
 *
 * `useLinkStatus` only works inside a Link, which is why this is a child
 * component rather than a hook call in NavLink itself. It is honest feedback
 * rather than a fake global progress bar: it reports one navigation, the one you
 * actually started, and it never claims to finish — the new screen arriving is
 * what finishes it.
 */
function Pending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className={cn(
        'gradient-brand absolute h-[2px] origin-left animate-[crawl_2s_cubic-bezier(0.22,1,0.36,1)_forwards]',
        className,
      )}
    />
  );
}
