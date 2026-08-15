/**
 * The mark, as numbers.
 *
 * The geometry below is the supplied artwork, coordinate for coordinate. It is
 * not redrawn, retouched or re-proportioned here, and it should not be: the
 * owl is the firm's, and this file only has to put it on a page.
 *
 * It lives here rather than in the components because three places have to
 * draw it and none of them can share a renderer. The logo draws it as JSX, the
 * social card draws it through Satori, which supports neither CSS variables nor
 * oklch, the printed voucher draws it with react-pdf's own SVG primitives, and
 * the favicons are rasterised by a build script running outside React. The mark
 * this replaced had been hand-copied into three of those in three different
 * colour notations, and they had already drifted apart by a stroke width.
 *
 * The one thing added to the artwork is the halo: a light disc set behind the
 * owl, a little wider than its head, so a navy bird is still legible on a navy
 * tile and on the near-black marketing page. It shows as a thin light ring and
 * nothing else changes.
 */

/** The brand's own colours, from the supplied artwork. */
export const INK = {
  navy: '#0B2942',
  navyLit: '#123B57',
  gold: '#E8C468',
} as const;

/**
 * The light disc behind the owl.
 *
 * A warm off white rather than a flat white: it sits beside the gold without
 * going cold, and on the application's white surfaces it stays quiet enough
 * that the mark still reads as a bird on paper rather than a badge.
 *
 * The owl's head is a filled circle, so this can only ever show as a ring
 * around it, and 16 units of a 300 unit square is the whole intent: about a
 * pixel in a tab, two in a header. Enough to separate the bird from the ground
 * behind it and not enough to read as a badge it has been dropped into.
 */
export const HALO = { cx: 150, cy: 150, r: 128, fill: '#F5F0E6' } as const;

export const VIEW = 300;

/**
 * The supplied owl sits low in its square, centred on 182 of 300. The halo is
 * concentric with the view box, so the owl is lifted onto it. A translation
 * only: nothing is scaled and no coordinate below is touched.
 */
export const RECENTRE = -32;

/** As supplied. Both tufts fall inside the head, and so neither one shows. */
export const TUFTS = ['80,95 118,132 62,128', '220,95 182,132 238,128'] as const;

export const HEAD = { cx: 150, cy: 182, r: 112 } as const;

export const EYE = {
  y: 158,
  x: [112, 188],
  white: 34,
  ring: 24,
  ringWidth: 3.5,
  pupil: 13,
} as const;

export const BEAK = '150,172 138,190 150,206 162,190';

export const RUPEE =
  'M139.344 231.304L131.503 231.304L134.167 225.401L168.497 225.401L165.894 231.304L156.327 231.304Q157.296 233 157.659 235.240L168.497 235.240L165.894 241.143L157.508 241.143Q156.993 243.474 155.691 245.230Q153.512 248.106 149.152 249.468Q151.544 250.013 153.451 251.951Q155.358 253.888 157.266 257.763L163.593 270.599L151.181 270.599L145.671 259.368Q144.006 255.977 142.295 254.736Q140.585 253.495 137.739 253.495L133.198 253.495L133.198 245.442L139.344 245.442Q143.007 245.442 144.611 243.414Q145.398 242.415 145.792 241.143L131.503 241.143L134.167 235.240L145.701 235.240Q145.308 234.120 144.611 233.242Q143.007 231.304 139.344 231.304';

/** How far the owl is inset when it is drawn on its own tile, so the halo breathes. */
export const TILE_SCALE = 0.86;

/**
 * The mark as a standalone SVG document, for the icon build script, which has
 * no React. The components draw the same shapes from the same constants.
 */
export function markSvg({ tile = false }: { tile?: boolean } = {}): string {
  const id = tile ? 'tfi-tile' : 'tfi-mark';
  const open = tile
    ? `<g transform="translate(150,150) scale(${TILE_SCALE}) translate(-150,-150)">`
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
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${INK.navyLit}"/>
      <stop offset="100%" stop-color="${INK.navy}"/>
    </linearGradient>
  </defs>${tile ? `\n  <rect width="${VIEW}" height="${VIEW}" fill="${INK.navy}"/>` : ''}${open}
  <circle cx="${HALO.cx}" cy="${HALO.cy}" r="${HALO.r}" fill="${HALO.fill}"/>
  <g transform="translate(0,${RECENTRE})">
    ${TUFTS.map((points) => `<polygon points="${points}" fill="url(#${id})"/>`).join('\n    ')}
    <circle cx="${HEAD.cx}" cy="${HEAD.cy}" r="${HEAD.r}" fill="url(#${id})"/>
    ${eyes(EYE.white, '#FFFFFF')}
    ${eyes(EYE.ring, 'none', INK.gold)}
    ${eyes(EYE.pupil, INK.navy)}
    <polygon points="${BEAK}" fill="${INK.gold}"/>
    <path fill="${INK.gold}" d="${RUPEE}"/>
  </g>${close}
</svg>
`;
}
