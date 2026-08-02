import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/marketing/content';

/**
 * The mark is two chevrons stacked inside a tile: the double approval that the
 * whole platform is organised around. It reads as a check at small sizes, which
 * is the size it is almost always used at.
 *
 * `id` has to be unique per instance — two gradients sharing an id on one page
 * makes the second one silently inherit the first.
 */
export function LogoMark({ className, id = 'nvr-mark' }: { className?: string; id?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.64 0.18 274)" />
          <stop offset="55%" stopColor="oklch(0.68 0.19 300)" />
          <stop offset="100%" stopColor="oklch(0.79 0.14 205)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}-g)`} />
      <path
        d="M9 15.4 13.2 19.6 23 9.8"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <path
        d="M9 21.6 13.2 25.8 23 16"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  showFirm = true,
  id,
}: {
  className?: string;
  markClassName?: string;
  /** Show "by N V R & Co" underneath. Off in tight places like the mobile nav. */
  showFirm?: boolean;
  id?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark id={id} className={cn('size-8 shrink-0', markClassName)} />
      <span className="leading-none">
        <span className="m-display block text-[15px] tracking-[-0.02em]">{BRAND.name}</span>
        {showFirm && (
          <span className="m-dim-2 mt-1 block text-[10px] tracking-[0.06em]">by {BRAND.firm}</span>
        )}
      </span>
    </span>
  );
}
