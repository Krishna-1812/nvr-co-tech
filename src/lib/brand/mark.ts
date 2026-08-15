/**
 * The mark, as numbers.
 *
 * There are three places that have to draw this owl and none of them can share
 * a renderer: the logo component draws it as JSX, the social card draws it
 * through Satori, which supports neither CSS variables nor oklch, and the
 * favicons are rasterised by a build script running outside React. The mark
 * that came before this one was hand-copied into all three, in three different
 * colour notations, and they had already drifted apart by a stroke width.
 *
 * So the geometry and the ink live here as plain data, and each of the three
 * renders from it. A change to the mark is a change to this file.
 *
 * The artwork is the supplied brand owl with two corrections. Its ear tufts
 * were drawn inside the head circle in the head's own fill, so they never
 * appeared at any size; they are now drawn behind the head and emerge from it.
 * Its favicon put a #123B57 owl on a flat #0B2942 field, near enough the same
 * colour that a 16px tab icon was two white dots on a navy square; the tile
 * lifts the head two steps instead. Nothing else about it was touched.
 */

/** The brand's own colours, from the supplied artwork. */
export const INK = {
  /** The deep navy. Pupils, and the ground of the app icon. */
  navy: '#0B2942',
  /** One step up. The lit edge of the head on the free standing mark. */
  navyLit: '#123B57',
  gold: '#E8C468',
} as const;

/**
 * The head, as a gradient with enough range to sit on anything.
 *
 * The artwork's #123B57 alone cannot do this. The application is near white and
 * the marketing site is near black, #04080F, and against that the supplied navy
 * reaches 1.3:1: the body disappears and the mark reads as two eyes floating in
 * the dark, which is the same fault the supplied favicon had.
 *
 * Lifting only the top-left stop fixes it without moving the brand off its
 * navy. The lit side carries 3.6:1 on the dark ground so the silhouette is
 * always legible, the shadow side stays the colour the artwork specifies, and
 * on white the whole head still reads as deep navy at better than 5:1.
 */
export const HEAD_INK = { hi: '#2A6E97', lo: '#123B57' } as const;

/**
 * The same idea again, one step further, for the app icon.
 *
 * There the owl sits on its own #0B2942 tile rather than on a page, so the
 * shadow side has to clear the tile too.
 */
export const TILE_INK = { hi: '#2A6E97', lo: '#16466A' } as const;

export const VIEW = 300;
export const HEAD = { cx: 150, cy: 160, r: 116 } as const;

/**
 * Ear tufts, drawn behind the head.
 *
 * Both base corners sit at radius 96 rather than on the head's 116. On the
 * edge, the triangle meets the disc across a 2.6 unit sliver: antialiasing
 * hides that at favicon sizes and it reads as two floating shapes at any size
 * worth looking at. Tucked under, the join is solid and the head, drawn after,
 * cuts each tuft to a clean 27 by 47.
 */
export const TUFTS = [
  '59.4,25.7 114.0,71.0 80.9,93.3',
  '240.6,25.7 186.0,71.0 219.1,93.3',
] as const;

/** The eyes carry the mark: they are the one feature still legible at 16px. */
export const EYE = {
  y: 150,
  x: [107, 193],
  white: 39,
  ring: 27,
  ringWidth: 4,
  pupil: 14.5,
} as const;

export const BEAK = '150,166 135,188 150,210 165,188';

/** The rupee, exactly as drawn in the supplied artwork. */
export const RUPEE =
  'M139.344 231.304L131.503 231.304L134.167 225.401L168.497 225.401L165.894 231.304L156.327 231.304Q157.296 233 157.659 235.240L168.497 235.240L165.894 241.143L157.508 241.143Q156.993 243.474 155.691 245.230Q153.512 248.106 149.152 249.468Q151.544 250.013 153.451 251.951Q155.358 253.888 157.266 257.763L163.593 270.599L151.181 270.599L145.671 259.368Q144.006 255.977 142.295 254.736Q140.585 253.495 137.739 253.495L133.198 253.495L133.198 245.442L139.344 245.442Q143.007 245.442 144.611 243.414Q145.398 242.415 145.792 241.143L131.503 241.143L134.167 235.240L145.701 235.240Q145.308 234.120 144.611 233.242Q143.007 231.304 139.344 231.304';

/** It sits a little high, so the chin is not crowded against the head's edge. */
export const RUPEE_SHIFT = -8;

/** The icon's tile: a 22.7% corner, and the owl inset off it. */
export const TILE = { radius: 68, scale: 0.86 } as const;

/**
 * The mark as a standalone SVG document.
 *
 * Used by the icon build script, which has no React. The components draw the
 * same shapes from the same constants rather than parsing this.
 */
export function markSvg({ tile = false }: { tile?: boolean } = {}): string {
  const id = tile ? 'tfi-tile' : 'tfi-mark';
  const hi = tile ? TILE_INK.hi : HEAD_INK.hi;
  const lo = tile ? TILE_INK.lo : HEAD_INK.lo;
  const open = tile
    ? `<g transform="translate(150,150) scale(${TILE.scale}) translate(-150,-150)">`
    : '';
  const close = tile ? '</g>' : '';

  const eyes = (r: number, fill: string, stroke?: string) =>
    EYE.x
      .map(
        (x) =>
          `<circle cx="${x}" cy="${EYE.y}" r="${r}" fill="${fill}"${
            stroke ? ` stroke="${stroke}" stroke-width="${EYE.ringWidth}"` : ''
          }/>`,
      )
      .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" role="img" aria-label="The Finance Intelligence">
  <title>The Finance Intelligence</title>
  <defs>
    <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${VIEW}" y2="${VIEW}">
      <stop offset="0%" stop-color="${hi}"/>
      <stop offset="100%" stop-color="${lo}"/>
    </linearGradient>
  </defs>${
    tile ? `\n  <rect width="${VIEW}" height="${VIEW}" rx="${TILE.radius}" fill="${INK.navy}"/>` : ''
  }${open}
  ${TUFTS.map((points) => `<polygon points="${points}" fill="url(#${id})"/>`).join('\n  ')}
  <circle cx="${HEAD.cx}" cy="${HEAD.cy}" r="${HEAD.r}" fill="url(#${id})"/>
  ${eyes(EYE.white, '#FFFFFF')}
  ${eyes(EYE.ring, 'none', INK.gold)}
  ${eyes(EYE.pupil, INK.navy)}
  <polygon points="${BEAK}" fill="${INK.gold}"/>
  <path fill="${INK.gold}" transform="translate(0,${RUPEE_SHIFT})" d="${RUPEE}"/>${close}
</svg>
`;
}
