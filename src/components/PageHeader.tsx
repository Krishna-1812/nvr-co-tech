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
    <header className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-subtle mb-1.5 flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
            {/* A short brand rule anchors the eyebrow to the title beneath it. */}
            <span aria-hidden className="gradient-brand h-2.5 w-0.5 rounded-full" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-[1.75rem]/tight">
          {title}
        </h1>
        {description && (
          <p className="text-muted mt-1.5 max-w-2xl text-sm text-pretty">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}
