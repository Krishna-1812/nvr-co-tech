import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { BEAK, EYE, HEAD, RECENTRE, TUFTS, VIEW } from '@/lib/brand/mark';
import { draws, owlTraits, type OwlTraits } from '@/lib/brand/owlkit';

/**
 * A miniature of the firm's own owl, for living in the margins of a page.
 *
 * The geometry is the supplied artwork from lib/brand/mark, recentred the same
 * way the logo recentres it, so this is the same bird as the one in the header
 * rather than a second owl drawn to look like it. Everything added here — tufts,
 * a wing, claws — either exists in the artwork already or is a shape the artwork
 * implies, and every one of them is optional.
 *
 * ── The one place this departs from the mark, and why ───────────────────────
 *
 * The logo draws the gold iris as a stroked ring: `r` 24, stroke 3.5, inside a
 * white disc of 34. Those are numbers for a 300-unit drawing shown at 40 pixels
 * or printed. At the sizes here a 3.5-unit stroke is 0.28 of a pixel, so the
 * gold — the most recognisable thing about this bird — renders as a grey smear
 * or disappears into the antialiasing entirely.
 *
 * So the miniature fills the iris instead of stroking it. Same three radii, same
 * two colours, and at 24 pixels it reads as a pale eye with a gold iris and a
 * dark pupil, which is what the ring is trying to say in the first place. The
 * mark is not changed; this is a second cut of it for a size the first was not
 * drawn for, which is what an optical size is.
 *
 * ── Why the groups are nested rather than flat ──────────────────────────────
 *
 * `o-posture`, `o-body`, `o-head`, and the wing, tufts and eyes below them. Each
 * is the sole owner of its own `transform`, because CSS has no way to combine
 * two animations that both write `transform` on one element: the later one wins
 * outright and the other silently does nothing. An owl that breathed *and*
 * tilted would simply stop breathing, with no error anywhere to find.
 *
 * Split like this, an owl can hold a fixed posture, breathe on one clock, tilt
 * its head on another, blink on a third and still turn to follow the reader as
 * it scrolls past, and none of the five can cancel any of the others. The last
 * of those arrives as `rotate` rather than `transform` — see the note in
 * globals.css — which is what lets it sit on the same element as the tilt.
 */

/* The mark's numbers, already recentred, so nothing below has to keep adding -32. */
const CY = HEAD.cy + RECENTRE;
const EYE_Y = EYE.y + RECENTRE;
const BEAK_POINTS = BEAK.split(' ')
  .map((pair) => {
    const [x, y] = pair.split(',').map(Number) as [number, number];
    return `${x},${y + RECENTRE}`;
  })
  .join(' ');

/**
 * How far the tufts are lifted so they show.
 *
 * As supplied both tufts fall entirely inside the head circle and neither one
 * ever renders — mark.ts says so, and the logo draws them anyway because they
 * are in the artwork. Raising them by 42 units puts the apex 17 above the crown
 * and leaves both base corners buried, which is the silhouette the artwork is
 * plainly describing. Nothing is rescaled and neither polygon is redrawn.
 */
const TUFT_LIFT = 42;

/**
 * A folded wing down one flank: a crescent from the shoulder to a tip below the
 * body, whose outer edge falls outside the head circle and whose inner edge
 * falls inside it.
 *
 * That crossing is the whole design. The first attempt was a lozenge sitting
 * almost entirely inside the silhouette, and at any size it read as a chip out
 * of the bird rather than a wing, because a shape wholly inside another shape
 * is only visible by its fill and there is no contrast to spare here. A shape
 * that changes the outline is read as an edge instead, and an edge survives
 * being drawn twenty pixels tall.
 */
const WING = 'M 45 112 C 14 180, 48 254, 96 286 C 86 214, 74 152, 45 112 Z';

/**
 * One claw: a leg from inside the body down to a splayed toe.
 *
 * It bottoms out at 288 of the 300-unit box, and with a 9-unit stroke and round
 * caps the ink reaches 292.5. That is deliberate and tight — a path that left
 * the viewBox would be clipped flat by the SVG's own edge, which reads as an owl
 * standing on an invisible shelf rather than an owl with feet.
 */
const FOOT = 'M 0 256 v 22 m -10 10 l 10 -10 l 10 10';

export function Owl({
  seed,
  className,
  min,
  max,
  style,
}: {
  /**
   * The bird. Every visible property is derived from this string and nothing
   * else, so the same seed is the same owl on the server and in the browser —
   * see the note at the top of lib/brand/owlkit.
   */
  seed: string;
  className?: string;
  min?: number;
  max?: number;
  style?: CSSProperties;
}) {
  const o = owlTraits(seed, { min, max });
  return <OwlBody traits={o} className={className} style={style} />;
}

function OwlBody({
  traits: o,
  className,
  style,
}: {
  traits: OwlTraits;
  className?: string;
  style?: CSSProperties;
}) {
  const eye = (side: 'l' | 'r', cx: number) => (
    <g key={side} className={`o-eye o-eye-${side}`}>
      <circle cx={cx} cy={EYE_Y} r={EYE.white} fill="var(--o-sclera)" />
      <circle cx={cx} cy={EYE_Y} r={EYE.ring} fill="var(--o-iris)" />
      {/* Its own group so `peer` can slide the pupils without moving the eye
          it is looking out of. */}
      <g className="o-pupil">
        <circle cx={cx} cy={EYE_Y} r={EYE.pupil} fill="var(--o-pupil)" />
      </g>
    </g>
  );

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className={cn('owl', className)}
      /* Decoration, and nothing else. Announced to nobody, and it can never take
         a pointer event away from a link it happens to be sitting near. */
      aria-hidden
      focusable="false"
      data-palette={o.palette}
      data-posture={o.posture}
      data-idle={o.idle}
      data-blink={o.blink}
      data-special={o.special}
      data-watch={o.watches ? '1' : undefined}
      style={
        {
          width: o.size,
          height: o.size,
          opacity: o.opacity,
          '--o-lean': `${o.lean}deg`,
          '--o-facing': o.facing,
          '--o-blink': `${o.blinkPeriod}s`,
          '--o-blink-in': `${-o.blinkDelay}s`,
          '--o-idle': `${o.idlePeriod}s`,
          '--o-idle-in': `${-o.idleDelay}s`,
          ...style,
        } as CSSProperties
      }
    >
      <g className="o-posture">
        {/* Outside o-body, so an owl that bobs bobs on its feet rather than
            carrying them up and down with it. */}
        {o.feet && (
          <g
            className="o-feet"
            fill="none"
            stroke="var(--o-beak)"
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={FOOT} transform="translate(124,0)" />
            <path d={FOOT} transform="translate(176,0)" />
          </g>
        )}

        <g className="o-body">
          {o.wing && <path className="o-wing" d={WING} fill="var(--o-wing)" />}

          <g className="o-head">
            {/*
              Two groups, not one. The lift has to be an attribute on an outer
              group because `perk` animates `transform` on the inner one, and a
              CSS transform replaces the presentation attribute outright rather
              than adding to it — one group would mean the tufts silently
              dropped back inside the head the moment they twitched.
            */}
            {o.tufts && (
              <g transform={`translate(0,${RECENTRE - TUFT_LIFT})`}>
                <g className="o-tufts">
                  {TUFTS.map((points) => (
                    <polygon key={points} points={points} fill="var(--o-body-c)" />
                  ))}
                </g>
              </g>
            )}

            <circle cx={HEAD.cx} cy={CY} r={HEAD.r} fill="var(--o-body-c)" />

            {eye('l', EYE.x[0]!)}
            {eye('r', EYE.x[1]!)}

            <polygon points={BEAK_POINTS} fill="var(--o-beak)" />

            {/* A circle and a line, which is the whole reason a monocle is the
                one piece of costume that survives being drawn this small. */}
            {o.special === 'scholar' && (
              <g className="o-monocle" fill="none" stroke="var(--o-beak)" strokeLinecap="round">
                <circle cx={EYE.x[1]} cy={EYE_Y} r={46} strokeWidth={7} />
                <path d="M 232 156 q 16 40 -8 66" strokeWidth={4.5} />
              </g>
            )}
          </g>
        </g>
      </g>
    </svg>
  );
}

/* ── Where they sit ──────────────────────────────────────────────────────── */

/**
 * The bands an owl may be placed in, measured against the section it is given to.
 *
 * This is the honest half of "put them in random places". Truly random
 * coordinates would sooner or later drop a bird across a sentence about TDS, and
 * a decoration that has landed on the content is not a decoration. So the caller
 * names a band it knows to be empty and the seed picks the exact point inside
 * it: unplanned to look at, and impossible to place badly.
 *
 * ── Why one axis is in pixels and the other in percent ──────────────────────
 *
 * The first cut of this expressed both axes as a fraction of the section, and it
 * was wrong in a way that only showed up on the long sections. "Eight percent
 * down" is inside the top padding of a 600px section and four hundred pixels
 * into the body copy of one three times that height. The sections vary in
 * height by a factor of five; what they have in common is `py-20 sm:py-28`, so the empty
 * strip at the top and bottom is 80 to 112 pixels on every one of them.
 *
 * So a `pad` band is anchored to the near edge in pixels, which is the thing
 * that is actually constant, and spread along the other axis in percent, which
 * is the thing that actually scales.
 *
 * A `flank` band is the opposite: pinned to the left or right edge and free down
 * the middle of the section. That space is the gutter outside the container, and
 * below about 1536px there is no gutter — `max-w-[1400px]` and `px-8` means the
 * text runs to within 32 pixels of the glass. So flanking owls appear at `2xl`
 * and nowhere else, which is the whole reason the two kinds are distinguished.
 */
type Band =
  | { kind: 'pad'; edge: 'top' | 'bottom'; px: readonly [number, number]; x: readonly [number, number] }
  | { kind: 'flank'; edge: 'left' | 'right'; pct: readonly [number, number]; y: readonly [number, number] };

const BANDS = {
  // The near end of each range is 24 rather than the 14 it started at, because
  // the owl is positioned by its centre and the largest is 34 across: at 14 a
  // big bird's crown crossed the section boundary, and four of these sections
  // are `overflow-hidden`, which would have sliced the top off it.
  'top-left': { kind: 'pad', edge: 'top', px: [24, 54], x: [2, 15] },
  'top-right': { kind: 'pad', edge: 'top', px: [24, 54], x: [85, 98] },
  'bottom-left': { kind: 'pad', edge: 'bottom', px: [24, 54], x: [2, 15] },
  'bottom-right': { kind: 'pad', edge: 'bottom', px: [24, 54], x: [85, 98] },
  top: { kind: 'pad', edge: 'top', px: [22, 50], x: [22, 78] },
  bottom: { kind: 'pad', edge: 'bottom', px: [22, 50], x: [22, 78] },
  left: { kind: 'flank', edge: 'left', pct: [0.6, 3.4], y: [28, 72] },
  right: { kind: 'flank', edge: 'right', pct: [0.6, 3.4], y: [28, 72] },
} as const satisfies Record<string, Band>;

export type OwlBand = keyof typeof BANDS;

const between = ([from, to]: readonly [number, number], t: number) => from + t * (to - from);

const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

/**
 * A corner, for a caller with no opinion about which — the empty states, where
 * one component stands in for twenty-six different screens and none of them
 * should get the same bird in the same place.
 *
 * Drawn off its own stream (`seed:corner`) rather than from `owlTraits`. Adding
 * a draw to that function would shift every draw after it and silently re-roll
 * all twenty-one owls already perched on the public site — see the note on
 * `draws` about call order being part of the contract.
 */
export function cornerFor(seed: string): OwlBand {
  return draws(`${seed}:corner`).pick(CORNERS);
}

/**
 * One owl, somewhere in a band of the section it is given to.
 *
 * The parent must be positioned. Every marketing section already is, because
 * they all carry a divider, an aurora or a dot field.
 *
 * `z-0` and first in the DOM, so the bird is behind everything the section
 * paints. That is the safety net under the bands: if a band is ever misjudged,
 * the failure is an owl hidden behind a card rather than an owl over a sentence.
 *
 * Hidden below `sm` — a 24-pixel bird in the 20-pixel gutter of a phone is
 * either off the screen or on top of the paragraph, and there is no third
 * option — and flanking owls not shown until `2xl`, where the gutter they sit
 * in starts to exist.
 */
export function Roost({
  seed,
  band = 'top-right',
  className,
  min,
  max,
}: {
  seed: string;
  band?: OwlBand;
  className?: string;
  min?: number;
  max?: number;
}) {
  const { ax, ay } = owlTraits(seed, { min, max });
  const b: Band = BANDS[band];

  const place: CSSProperties =
    b.kind === 'pad'
      ? { [b.edge]: `${between(b.px, ay).toFixed(1)}px`, left: `${between(b.x, ax).toFixed(2)}%` }
      : { [b.edge]: `${between(b.pct, ax).toFixed(2)}%`, top: `${between(b.y, ay).toFixed(2)}%` };

  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute z-0 hidden',
        b.kind === 'flank' ? '2xl:block' : 'sm:block',
        className,
      )}
      style={place}
    >
      <Owl seed={seed} min={min} max={max} />
    </span>
  );
}

/**
 * A parliament: several owls along one line, each a different bird.
 *
 * The collective noun is the reason this exists as its own component rather than
 * three Roosts — a row of owls sitting along a rule is a parliament, and the
 * footer of a firm's website is the one place on it where that joke can be made
 * without being in anybody's way.
 *
 * They sit *on* the line rather than near it, which is the point: this site is
 * built out of hairlines, and an owl perched on one belongs to the design rather
 * than being placed over it.
 */
export function Parliament({
  seed,
  count = 3,
  className,
  min = 16,
  max = 27,
}: {
  seed: string;
  count?: number;
  className?: string;
  min?: number;
  max?: number;
}) {
  return (
    <span
      aria-hidden
      className={cn('pointer-events-none absolute inset-x-0 hidden justify-center sm:flex', className)}
    >
      {Array.from({ length: count }, (_, i) => {
        const key = `${seed}-${i}`;
        const { size, ax, ay } = owlTraits(key, { min, max });
        return (
          <span
            key={key}
            className="block"
            style={{
              /*
               * Lifted by its own height so it stands on the line rather than
               * hanging from it. Each bird is a different height, so this is the
               * only way the row shares a footing.
               */
              marginTop: -size,
              /*
               * Uneven gaps, and a pixel or two of slop in the footing.
               *
               * Three owls at a fixed `gap-10` sat like tick marks on a ruler —
               * the one arrangement of birds on a wire that never happens. The
               * spacing is drawn from each bird's own seed for the same reason
               * everything else about it is, so the row is irregular without
               * anybody having chosen where the irregularity goes.
               */
              marginLeft: i === 0 ? 0 : `${(24 + ax * 34).toFixed(1)}px`,
              transform: `translateY(${(ay * 4 - 2).toFixed(1)}px)`,
            }}
          >
            <Owl seed={key} min={min} max={max} />
          </span>
        );
      })}
    </span>
  );
}
