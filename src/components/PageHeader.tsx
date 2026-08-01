import type { ReactNode } from 'react';

/**
 * The title block every screen opens with. Shared so the type scale and the
 * spacing under it stay identical from page to page.
 */
export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Primary control for the page, right-aligned on wider viewports. */
  action?: ReactNode;
  /** Small label above the title — section name, voucher number, and so on. */
  eyebrow?: ReactNode;
}) {
  return (
    <header className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-subtle mb-1 text-xs font-semibold tracking-wide uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-balance">{title}</h1>
        {description && <p className="text-muted mt-1.5 text-sm">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}
