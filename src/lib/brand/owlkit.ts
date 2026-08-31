/**
 * The owls, as numbers.
 *
 * The firm's mark is an owl, so a small owl tucked into the margin of a page is
 * not an ornament borrowed from somewhere else — it is the mark again, at the
 * size where only three things about it survive: a round head, two gold eyes,
 * and the diamond beak. A book does this with a printer's device, repeated at
 * the foot of a chapter in a slightly different cut each time. That is the idea
 * being copied here, and the reason none of these birds is drawn by hand.
 *
 * ── Why this file exists at all ─────────────────────────────────────────────
 *
 * Because the owls have to be random and the pages are server-rendered, and
 * those two things are in direct conflict. `Math.random()` in a component runs
 * once on the server and again in the browser and returns two different numbers,
 * so React reconciles a bird the server drew asleep against a bird the client
 * drew mid-blink and logs a hydration error for every owl on the page.
 *
 * So none of this is random. Every owl is a pure function of one short string —
 * `owlTraits('journey-02')` returns the same bird on the server, in the browser,
 * at build time, and in a test, forever. It is only random in the sense that
 * matters: nobody chose that this particular owl would be a hunched ghost that
 * ruffles every nine seconds, and nobody could predict it from the seed.
 *
 * The other half of "random placement" is in the Roost component: the caller
 * names a band of a section that is known to be empty, and the seed picks the
 * exact point inside it. Genuinely random coordinates would put a bird on top of
 * a sentence about TDS, which is the one thing these must never do.
 */

/* ── Deterministic randomness ────────────────────────────────────────────── */

/**
 * FNV-1a, 32-bit.
 *
 * Any hash would do — this one is four lines, has no dependencies and spreads
 * short similar strings well, which is exactly the input here: `journey-01`
 * and `journey-02` differ in one character and have to produce unrelated birds.
 * `Math.imul` rather than `*` because the multiply overflows 32 bits on every
 * round and JavaScript's own multiplication would quietly go through a double
 * and lose the low bits that carry the mixing.
 */
function hash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * mulberry32: a small, fast, well-distributed PRNG.
 *
 * Deliberately not a linear congruential generator, whose low bits cycle with a
 * short period — and the low bits are what a `pick()` off a four-item list reads.
 * An LCG here would visibly favour two of the four postures.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A stream of draws off one seed.
 *
 * Every method advances the stream, so the *order* of the calls in `owlTraits`
 * is part of the contract: inserting a new draw in the middle re-rolls every
 * owl after it. That is fine — they are decoration — but it is worth knowing
 * before wondering why an owl moved.
 */
export type Draw = {
  /** A float in [min, max). */
  float(min: number, max: number): number;
  /** An integer in [min, max], both ends included. */
  int(min: number, max: number): number;
  /** One item, uniformly. */
  pick<T>(items: readonly T[]): T;
  /** One item, by weight. Heavier items come up more often. */
  weighted<T>(items: readonly (readonly [T, number])[]): T;
  /** True with probability `p`. */
  chance(p: number): boolean;
};

export function draws(key: string): Draw {
  const next = mulberry32(hash(key));

  const float = (min: number, max: number) => min + next() * (max - min);

  return {
    float,
    int: (min, max) => Math.floor(float(min, max + 1)),
    pick: (items) => items[Math.floor(next() * items.length)]!,
    weighted: (items) => {
      const total = items.reduce((sum, [, w]) => sum + w, 0);
      let roll = next() * total;
      for (const [item, weight] of items) {
        roll -= weight;
        if (roll < 0) return item;
      }
      return items[items.length - 1]![0];
    },
    chance: (p) => next() < p,
  };
}

/* ── What varies between one owl and the next ────────────────────────────── */

/**
 * How the bird is sitting.
 *
 * `hunched` squashes it slightly and drops the head, `tall` stretches it — the
 * two things a real owl does with its whole body, and enough at this size.
 * Anything more elaborate is invisible at twenty pixels.
 */
export type OwlPosture = 'upright' | 'hunched' | 'tall';

/**
 * The four ways an owl is coloured, all of them made of tokens the page already
 * has. There is no new colour anywhere in this feature.
 *
 * `ink` is the logo's own colouring and the most common. `ghost` is a faint
 * silhouette with lit eyes, `bone` a pale bird, and `gold` is rare and held to a
 * lower opacity — these are meant to be found rather than presented, and a page
 * of gold birds would be a page about owls rather than a page about finance
 * software that owls happen to live in.
 */
export type OwlPalette = 'ghost' | 'ink' | 'bone' | 'gold';

/** Every owl blinks. This is how. */
export type OwlBlink = 'single' | 'double' | 'wink';

/**
 * The one idle habit each owl has, besides blinking.
 *
 * Split across three elements in the SVG so two of them can never fight over
 * the same `transform`: `peer`, `tilt`, `swivel`, `ruffle` and `perk` act on the
 * head, `bob` and `breathe` on the body, `shuffle` on the wing.
 */
export type OwlIdle =
  | 'tilt'
  | 'swivel'
  | 'bob'
  | 'breathe'
  | 'peer'
  | 'ruffle'
  | 'shuffle'
  | 'perk';

/**
 * The rare ones, worth finding.
 *
 * `sleeper` has its eyes shut and cracks one open now and then. `scholar` wears
 * a monocle, which is the one piece of costume that belongs on a bird employed
 * by a firm of accountants, and which happens to be a circle and a line and so
 * survives being drawn a quarter of an inch tall.
 */
export type OwlSpecial = 'none' | 'sleeper' | 'scholar';

export type OwlTraits = {
  /** Rendered width and height in CSS pixels. */
  size: number;
  /** 1 faces right, -1 faces left. Applied as a scaleX on the whole bird. */
  facing: 1 | -1;
  /** A fixed tilt in degrees, so a row of them is not a row of soldiers. */
  lean: number;
  palette: OwlPalette;
  opacity: number;
  posture: OwlPosture;
  /** Ear tufts, pulled up out of the head so they show. */
  tufts: boolean;
  /** A folded wing down one side. */
  wing: boolean;
  /** Claws, for an owl that has something to perch on. */
  feet: boolean;
  blink: OwlBlink;
  /** Seconds between blinks. */
  blinkPeriod: number;
  /** Seconds before the first one, so a page of owls never blinks in unison. */
  blinkDelay: number;
  idle: OwlIdle;
  idlePeriod: number;
  idleDelay: number;
  /** Whether this one turns its head to follow the reader as it scrolls past. */
  watches: boolean;
  special: OwlSpecial;
  /** Where in its permitted band it sits, 0 → 1 on each axis. */
  ax: number;
  ay: number;
};

/**
 * Which idle habits need a part the bird may not have.
 *
 * Drawing an owl with no wing and then animating its wing is the kind of bug
 * that produces nothing at all on screen and no error anywhere, so the pool is
 * filtered by what was actually drawn rather than left to chance.
 */
const IDLE_REQUIRES: Partial<Record<OwlIdle, 'wing' | 'tufts'>> = {
  shuffle: 'wing',
  perk: 'tufts',
};

/*
 * Near-flat, for the same reason the palettes are. Weighting tilt and peer at
 * twice the rest put five peerers and four rufflers on a page of fourteen, and
 * the whole point of this is that no two birds do the same thing. Habits that
 * need a part the owl may not have carry slightly more weight, because they are
 * only in the running for about half the owls to begin with.
 */
const IDLE_POOL: readonly (readonly [OwlIdle, number])[] = [
  ['tilt', 3],
  ['peer', 3],
  ['breathe', 3],
  ['bob', 3],
  ['swivel', 3],
  ['ruffle', 2.5],
  ['shuffle', 4],
  ['perk', 4],
];

/**
 * One owl, derived from one string.
 *
 * `min`/`max` bound the size in pixels. The defaults are the whole point of the
 * feature: 18 to 34 is small enough that a bird sitting beside a paragraph is
 * texture rather than an illustration, and large enough that a 13-unit pupil in
 * a 300-unit drawing is still a pixel across and the eye still reads as an eye.
 *
 * The floor started at 15 and came up twice. A 17-pixel bird in the ink palette
 * is a dark shape on a dark ground carrying two three-pixel eyes, and on a real
 * page it read as a smudge rather than as anything — subtle is the brief, but
 * invisible is not the same thing as subtle.
 */
export function owlTraits(
  seed: string,
  { min = 18, max = 34 }: { min?: number; max?: number } = {},
): OwlTraits {
  const d = draws(seed);

  const size = Math.round(d.float(min, max));
  const posture = d.weighted<OwlPosture>([
    ['upright', 5],
    ['hunched', 3],
    ['tall', 2],
  ]);

  /*
   * Flatter than it started. The first weighting made the ghost five parts in
   * eleven, and on a page that only holds eleven owls that meant nine of the
   * fourteen came out ghost — a run that is unremarkable at that sample size and
   * looks like one owl repeated. Ghost is also the least legible of the four, so
   * the clustering landed on the weakest cut. Ink leads now: it has the strongest
   * eye of the set, and it is the logo.
   */
  const palette = d.weighted<OwlPalette>([
    ['ink', 4],
    ['ghost', 3],
    ['bone', 3],
    ['gold', 1.5],
  ]);

  const tufts = d.chance(0.45);
  const wing = d.chance(0.5);

  const idle = d.weighted(
    IDLE_POOL.filter(([habit]) => {
      const needs = IDLE_REQUIRES[habit];
      return needs === undefined || (needs === 'wing' ? wing : tufts);
    }),
  );

  const special = d.weighted<OwlSpecial>([
    ['none', 14],
    ['sleeper', 2],
    ['scholar', 2],
  ]);

  return {
    size,
    facing: d.chance(0.5) ? 1 : -1,
    lean: +d.float(-7, 7).toFixed(1),
    palette,
    /*
     * A gold bird is the loudest thing this feature can put on a page, so it is
     * held to the bottom of the range and a ghost is allowed the top of it.
     * Without this the one-in-eleven gold owl reads as a warning icon.
     */
    opacity: +(palette === 'gold'
      ? d.float(0.46, 0.66)
      : palette === 'ghost'
        ? d.float(0.62, 0.95)
        : d.float(0.58, 0.86)
    ).toFixed(2),
    posture,
    tufts,
    wing,
    feet: d.chance(0.55),
    blink: d.weighted<OwlBlink>([
      ['single', 6],
      ['double', 3],
      ['wink', 2],
    ]),
    blinkPeriod: +d.float(3.4, 9).toFixed(2),
    blinkDelay: +d.float(0, 7).toFixed(2),
    idle,
    idlePeriod: +d.float(5.5, 14).toFixed(2),
    idleDelay: +d.float(0, 6).toFixed(2),
    watches: d.chance(0.4),
    special,
    ax: +d.float(0, 1).toFixed(4),
    ay: +d.float(0, 1).toFixed(4),
  };
}
