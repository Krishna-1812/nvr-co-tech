'use client';

import type { CSSProperties, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Activity, MessageCircleQuestion, Settings, Sparkles } from 'lucide-react';
import { SOLUTIONS } from '@/lib/solutions';
import { cn } from '@/lib/utils';
import { Letters } from '@/components/marketing/play/Letters';
import { Springy } from '@/components/marketing/play/Springy';

/**
 * The title block every screen opens with.
 *
 * Shared so the type scale and the spacing under it stay identical from page to
 * page — but also so every screen gets the same three-part rhythm: a mono eyebrow,
 * a display-cut title, and one line saying what you are looking at. The hairline
 * under it fades out to the right rather than running the full width, which stops
 * the header reading as a boxed-in section and lets the page breathe below it.
 *
 * It takes the colour of the tool it is in, worked out from the address so no
 * page has to pass it: the eyebrow is a small pill with the tool's mark, a soft
 * glow of that colour sits behind the title, and the hairline starts in it.
 * The same accent as the top bar's line and the breadcrumb's mark, so a screen
 * without a hero still says whose it is. Outside any tool (Settings, Admin) it
 * is the house colour.
 */

/** Where each tool's screens live, beyond its own front door. */
const EXTRA_HOMES: Record<string, string[]> = {
  'voucher-desk': ['/dashboard', '/vouchers', '/approvals', '/admin', '/onboarding'],
};

function toolFor(path: string) {
  return SOLUTIONS.find((s) => {
    const homes = [...(s.open ? [s.open] : []), ...(EXTRA_HOMES[s.slug] ?? [])];
    return homes.some((h) => path === h || path.startsWith(`${h}/`));
  });
}
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
  const path = usePathname() ?? '';
  const tool = toolFor(path);
  const tone = tool?.tone ?? 'var(--color-brand-500)';
  const Mark =
    tool?.icon ??
    (path.startsWith('/analytics') ? Activity : path.startsWith('/settings') ? Settings : path.startsWith('/ask') ? MessageCircleQuestion : Sparkles);

  return (
    <header
      style={{ '--tone': tone } as CSSProperties}
      className={cn(
        'animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] relative isolate pb-6',
        className,
      )}
    >
      {/* Light, not a fill: enough to warm the corner the title sits in. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-16 -z-10 h-56 w-[28rem] max-w-full rounded-full bg-[var(--tone)] opacity-[0.09] blur-3xl"
      />
      {/* The dotted ground the heroes stand on, fading out from the title, so
          a screen without a hero is still made of the same material. */}
      <span
        aria-hidden
        className="a-grid pointer-events-none absolute -inset-x-4 -top-6 bottom-0 -z-10 opacity-35 [mask-image:radial-gradient(50%_110%_at_0%_10%,#000,transparent)]"
      />
      {/* Where nothing stands on the right, a small doorway does: the tool's
          colour in the sky and the sun coming up in it, the same picture the
          tool heroes open on, in miniature. */}
      {!action && (
        <span aria-hidden className="pointer-events-none absolute right-1 bottom-5 hidden h-[6.5rem] w-[5.25rem] lg:block">
          <span
            className="m-arch m-arch-open absolute inset-0 overflow-hidden"
            style={{ background: 'color-mix(in oklab, var(--tone) 12%, var(--surface-sunken))' }}
          >
            <span
              className="m-sun absolute top-4 left-1/2 size-12 -translate-x-1/2"
              style={{ background: 'var(--scene-sun)', ['--sun-from' as string]: '48px' }}
            />
            <span
              className="absolute inset-x-0 bottom-0 h-7 bg-[var(--tone)] opacity-30"
              style={{ borderRadius: '60% 40% 0 0 / 45% 35% 0 0' }}
            />
          </span>
        </span>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="tinted mb-3 inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1.5">
              <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--tone)] text-[var(--surface-raised)]">
                <Mark className="size-3" />
              </span>
              <span className="a-label truncate text-current" data-decode>
                {eyebrow}
              </span>
            </p>
          )}
          {/* A plain-text title is set letter by letter: it rises in, and then
              answers the pointer, the way every hero on the site does. */}
          {typeof title === 'string' ? (
            <Springy as="h1" className="p-letters p-letters-quick m-display text-[clamp(1.85rem,3.6vw,2.6rem)] leading-[1.05] text-balance">
              <Letters text={title} />
            </Springy>
          ) : (
            <h1 className="m-display text-[clamp(1.85rem,3.6vw,2.6rem)] leading-[1.05] text-balance">{title}</h1>
          )}
          {description && (
            <p className="text-muted mt-2.5 max-w-2xl text-[14.5px] leading-relaxed text-pretty">{description}</p>
          )}
        </div>
        {action && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>

      {rule && (
        <span
          aria-hidden
          // Drawn from the left as the header arrives, the way the public
          // site draws every section rule.
          className="p-draw absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,var(--tone),var(--border-strong)_22%,transparent_65%)]"
        />
      )}
    </header>
  );
}
