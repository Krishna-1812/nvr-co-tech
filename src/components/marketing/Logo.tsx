import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/marketing/content';
import { BEAK, EYE, HALO, HEAD, INK, RECENTRE, RUPEE, TUFTS, VIEW } from '@/lib/brand/mark';

/**
 * The owl, drawn from the geometry in lib/brand/mark.
 *
 * The numbers are not repeated here. They are shared with the social card, the
 * printed voucher and the favicon build script, because the mark this replaced
 * had been hand-copied into all of those and had already drifted apart.
 *
 * `id` has to be unique per instance. Two gradients sharing an id on one page
 * makes the second one silently inherit the first.
 */
export function LogoMark({ className, id = 'fi-mark' }: { className?: string; id?: string }) {
  const eyes = (r: number, fill: string, stroke?: string) =>
    EYE.x.map((x) => (
      <circle
        key={`${x}-${r}`}
        cx={x}
        cy={EYE.y}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke ? EYE.ringWidth : undefined}
      />
    ));

  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={INK.navyLit} />
          <stop offset="100%" stopColor={INK.navy} />
        </linearGradient>
      </defs>

      {/* The light disc, so a navy bird still reads on a dark ground. */}
      <circle cx={HALO.cx} cy={HALO.cy} r={HALO.r} fill={HALO.fill} />

      <g transform={`translate(0,${RECENTRE})`}>
        {TUFTS.map((points) => (
          <polygon key={points} points={points} fill={`url(#${id}-g)`} />
        ))}
        <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill={`url(#${id}-g)`} />

        {eyes(EYE.white, '#FFFFFF')}
        {eyes(EYE.ring, 'none', INK.gold)}
        {eyes(EYE.pupil, INK.navy)}

        <polygon points={BEAK} fill={INK.gold} />
        <path fill={INK.gold} d={RUPEE} />
      </g>
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  showTagline = true,
  id,
}: {
  className?: string;
  markClassName?: string;
  /** Show the tagline underneath. Off in tight places like the mobile nav. */
  showTagline?: boolean;
  id?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark id={id} className={cn('size-9 shrink-0', markClassName)} />
      {/*
        The tagline is set in the mono face, uppercase and widely tracked,
        rather than as small sans body text. Two reasons: it stops the lock-up
        reading as a heading with a subheading under it, and it is the same
        treatment every section label on the site now carries — so the mark and
        the page are speaking with one voice at the smallest size on screen.
      */}
      <span className="leading-none">
        <span className="m-display block text-[15.5px] tracking-[-0.015em]">{BRAND.name}</span>
        {showTagline && (
          <span className="m-mono m-dim-2 mt-1.5 block text-[9px] tracking-[0.15em] uppercase">
            {BRAND.tagline}
          </span>
        )}
      </span>
    </span>
  );
}
