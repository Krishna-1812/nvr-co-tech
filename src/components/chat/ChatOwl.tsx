import { useId, type CSSProperties } from 'react';
import { BEAK, EYE, HALO, HEAD, INK, RECENTRE, RUPEE, TUFTS, VIEW } from '@/lib/brand/mark';
import { cn } from '@/lib/utils';

/**
 * The chat's face: the owl from the logo, drawn so it can move.
 *
 * Same shapes and colours as LogoMark (lib/brand/mark), split into groups that
 * each own one transform, for the same reason the margin owls are split (see
 * components/brand/Owl): CSS cannot add two animations on one element's
 * transform, it lets the later one win. So the head tilts, each eye blinks and
 * each pupil looks, and none of them can cancel another.
 *
 * What it is doing is a `data-mood` on the svg, and globals.css (the Chat
 * block) turns each mood into motion:
 *
 *   idle      blinks now and then
 *   listening looks down at the box being typed in
 *   thinking  looks up and tilts its head, waiting for the first word
 *   speaking  bobs gently while the answer arrives
 *   happy     squints, once, when an answer lands
 *
 * Where it looks is `--look-x` / `--look-y` on the svg, in the drawing's own
 * units (the eye is 34 across), so a caller can point the pupils at the
 * reader's pointer without knowing anything about the drawing. Decoration:
 * hidden from assistive technology, which is told what is happening in words.
 */

export type OwlMood = 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy';

export function ChatOwl({
  mood = 'idle',
  className,
  style,
  halo = true,
}: {
  mood?: OwlMood;
  className?: string;
  style?: CSSProperties;
  /** The bone disc behind the bird, as in the logo. Off where the ground is already bone. */
  halo?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, '');

  const eye = (side: 'l' | 'r', cx: number) => (
    <g key={side} className={`co-eye co-eye-${side}`}>
      <circle cx={cx} cy={EYE.y} r={EYE.white} fill="#FFFFFF" />
      <g className="co-pupil">
        {/* Filled rather than stroked, as the margin owls do it: the logo's
            3.5-unit ring is under a pixel at this size and the gold is lost. */}
        <circle cx={cx} cy={EYE.y} r={EYE.ring} fill={INK.gold} />
        <circle cx={cx} cy={EYE.y} r={EYE.pupil} fill={INK.pupil} />
        {/* A catch-light, which is most of what makes a drawn eye look alive. */}
        <circle cx={cx + 5} cy={EYE.y - 6} r={4} fill="#FFFFFF" opacity={0.9} />
      </g>
    </g>
  );

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className={cn('chat-owl', className)}
      data-mood={mood}
      style={style}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={INK.bodyLit} />
          <stop offset="100%" stopColor={INK.body} />
        </linearGradient>
      </defs>

      {halo && <circle cx={HALO.cx} cy={HALO.cy} r={HALO.r} fill={HALO.fill} />}

      <g transform={`translate(0,${RECENTRE})`}>
        <g className="co-head">
          <g className="co-tufts">
            {TUFTS.map((points) => (
              <polygon key={points} points={points} fill={`url(#${id}-g)`} />
            ))}
          </g>
          <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill={`url(#${id}-g)`} />
          {eye('l', EYE.x[0])}
          {eye('r', EYE.x[1])}
          <polygon points={BEAK} fill={INK.gold} />
          <path fill={INK.gold} d={RUPEE} />
        </g>
      </g>
    </svg>
  );
}
