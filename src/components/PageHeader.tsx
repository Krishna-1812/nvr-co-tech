import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The title block every screen opens with.
 *
 * Shared so the type scale and the spacing under it stay identical from page to
 * page — but also so every screen gets the same three-part rhythm: a mono eyebrow,
 * a display-cut title, and one line saying what you are looking at. The hairline
 * under it fades out to the right rather than running the full width, which stops
 * the header reading as a boxed-in section and lets the page breathe below it.
 */
export function PageHeader({
  title,
  description,
  action,
  eyebrow,
  rule = true,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Primary control for the page, right-aligned on wider viewports. */
  action?: ReactNode;
  /** Small label above the title — section name, voucher number, and so on. */
  eyebrow?: ReactNode;
  /**
   * Off where a tab bar follows the header. Two horizontal rules forty pixels
   * apart with tabs between them reads as a mistake, and the tab bar's own border
   * is already doing this one's job.
   */
  rule?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] relative pb-5',
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2.5 flex items-center gap-2">
              {/* A short brand rule anchors the eyebrow to the title beneath it. */}
              <span aria-hidden className="gradient-brand h-3 w-[3px] rounded-full" />
              <span className="a-label">{eyebrow}</span>
            </p>
          )}
          <h1 className="m-display text-[clamp(1.6rem,3.2vw,2.15rem)] text-balance">{title}</h1>
          {description && (
            <p className="text-muted mt-2 max-w-2xl text-sm text-pretty">{description}</p>
          )}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>

      {rule && (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,var(--border-strong),transparent_65%)]"
        />
      )}
    </header>
  );
}
