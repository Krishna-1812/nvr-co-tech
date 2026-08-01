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
        'inline-flex shrink-0 items-center gap-1.5 text-sm font-medium transition',
        variant === 'pill' && 'rounded-lg px-3 py-1.5',
        variant === 'pill' &&
          (active
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
            : 'text-muted hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]'),
        // A tab sits on the section's bottom border and marks itself with it.
        variant === 'tab' && '-mb-px border-b-2 px-3 py-2.5',
        variant === 'tab' &&
          (active
            ? 'border-brand-600 text-brand-700 dark:text-brand-300'
            : 'text-muted border-transparent hover:text-[var(--text-c)]'),
      )}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          className="ml-0.5 grid min-w-4.5 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white"
          aria-label={`${badge} waiting`}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}
