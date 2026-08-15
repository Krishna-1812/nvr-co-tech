import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/marketing/content';
import {
  BEAK,
  EYE,
  HEAD,
  HEAD_INK,
  INK,
  RUPEE,
  RUPEE_SHIFT,
  TILE,
  TILE_INK,
  TUFTS,
  VIEW,
} from '@/lib/brand/mark';

/**
 * The owl, drawn from the geometry in lib/brand/mark.
 *
 * A wise bird holding a rupee: the reading the firm wanted, and it earns its
 * place at 16px because the eyes carry it when nothing else survives. The
 * numbers are not repeated here. They are shared with the social card and the
 * favicon build script, because the mark this replaced had been hand-copied
 * into all three and they had already drifted apart.
 *
 * `id` has to be unique per instance. Two gradients sharing an id on one page
 * makes the second one silently inherit the first.
 */
export function LogoMark({
  className,
  id = 'fi-mark',
  tile = false,
}: {
  className?: string;
  id?: string;
  /**
   * Draw it on its own navy tile, for places that want a filled square rather
   * than a free standing bird. The head lifts to stay legible against it.
   */
  tile?: boolean;
}) {
  const hi = tile ? TILE_INK.hi : HEAD_INK.hi;
  const lo = tile ? TILE_INK.lo : HEAD_INK.lo;

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
        {/*
          userSpaceOnUse, not the default. Measured per object, the tufts get
          their own ramp and leave a seam where they meet the head.
        */}
        <linearGradient
          id={`${id}-g`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={VIEW}
          y2={VIEW}
        >
          <stop offset="0%" stopColor={hi} />
          <stop offset="100%" stopColor={lo} />
        </linearGradient>
      </defs>

      {tile && <rect width={VIEW} height={VIEW} rx={TILE.radius} fill={INK.navy} />}

      <g
        transform={
          tile ? `translate(150,150) scale(${TILE.scale}) translate(-150,-150)` : undefined
        }
      >
        {/* Behind the head, so the head cuts them to shape. */}
        {TUFTS.map((points) => (
          <polygon key={points} points={points} fill={`url(#${id}-g)`} />
        ))}
        <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill={`url(#${id}-g)`} />

        {eyes(EYE.white, '#FFFFFF')}
        {eyes(EYE.ring, 'none', INK.gold)}
        {eyes(EYE.pupil, INK.navy)}

        <polygon points={BEAK} fill={INK.gold} />
        <path fill={INK.gold} transform={`translate(0,${RUPEE_SHIFT})`} d={RUPEE} />
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
      <span className="leading-none">
        <span className="m-display block text-[15px] tracking-[-0.02em]">{BRAND.name}</span>
        {showTagline && (
          <span className="m-dim-2 mt-1 block text-[10px] tracking-[0.06em]">{BRAND.tagline}</span>
        )}
      </span>
    </span>
  );
}
