'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function NavLink({
  href,
  badge,
  exact,
  variant = 'pill',
  children,
}: {
  href: string;
  badge?: number;
  /** Match this path only, not its subtree. Needed for tabs like /admin. */
  exact?: boolean;
  variant?: 'pill' | 'tab';
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // "/" must match exactly; everything else matches its subtree unless told not to.
  const active = href === '/' || exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative inline-flex shrink-0 items-center gap-1.5 text-sm font-medium transition',
        variant === 'pill' && 'rounded-lg px-3 py-1.5',
        variant === 'pill' &&
          (active
            ? 'elev-1 bg-[var(--surface-raised)] text-brand-700 dark:text-brand-200'
            : 'text-muted hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]'),
        // A tab sits on the section's bottom border and marks itself with it.
        variant === 'tab' && 'rounded-t-lg -mb-px border-b-2 px-3.5 py-2.5',
        variant === 'tab' &&
          (active
            ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
            : 'text-muted border-transparent hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]'),
      )}
    >
      {/* Gradient underline on the active pill — the same accent as the logo. */}
      {active && variant === 'pill' && (
        <span
          aria-hidden
          className="gradient-brand absolute inset-x-3 -bottom-px h-0.5 rounded-full"
        />
      )}
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          className="ml-0.5 grid min-w-4.5 animate-[pop_0.35s_cubic-bezier(0.34,1.56,0.64,1)] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
          aria-label={`${badge} waiting`}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}
