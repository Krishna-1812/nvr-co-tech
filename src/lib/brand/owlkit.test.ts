import { describe, expect, it } from 'vitest';
import { draws, owlTraits, type OwlTraits } from './owlkit';

/**
 * The owls are decoration, so almost nothing here is about how they look. It is
 * about the two properties that are not cosmetic:
 *
 *   - the same seed must give the same bird, forever, because the pages are
 *     rendered on the server and hydrated in the browser and a bird that
 *     disagrees with itself between the two is a React error on every page; and
 *   - two owls in the same section must not be the same bird, because the whole
 *     premise is that each one is different and a page cannot argue with what a
 *     reader can plainly see.
 */

describe('draws', () => {
  it('is a pure function of the seed', () => {
    const a = draws('journey-hollow');
    const b = draws('journey-hollow');
    const seq = () => [a.float(0, 1), a.int(0, 99), a.chance(0.5), a.pick([1, 2, 3])];
    const seq2 = () => [b.float(0, 1), b.int(0, 99), b.chance(0.5), b.pick([1, 2, 3])];
    expect(seq()).toEqual(seq2());
  });

  it('separates seeds that differ by one character', () => {
    // The real seeds are near-identical strings, which is exactly the case a
    // weak hash smears together.
    const first = (s: string) => draws(s).float(0, 1);
    const near = ['journey-01', 'journey-02', 'journey-03', 'journey-04'].map(first);
    expect(new Set(near.map((n) => n.toFixed(4))).size).toBe(4);
  });

  it('stays inside the range it is given', () => {
    const d = draws('bounds');
    for (let i = 0; i < 2000; i += 1) {
      const f = d.float(3, 9);
      expect(f).toBeGreaterThanOrEqual(3);
      expect(f).toBeLessThan(9);
      const n = d.int(2, 5);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('honours weights', () => {
    const d = draws('weights');
    let heavy = 0;
    const N = 20_000;
    for (let i = 0; i < N; i += 1) if (d.weighted([['a', 9], ['b', 1]] as const) === 'a') heavy += 1;
    expect(heavy / N).toBeGreaterThan(0.87);
    expect(heavy / N).toBeLessThan(0.93);
  });

  it('never returns undefined from an exhausted weighted draw', () => {
    // Floating point can leave `roll` a hair above the running total on the last
    // item, which would fall out of the loop. The fallback covers it.
    const d = draws('edge');
    for (let i = 0; i < 5000; i += 1) {
      expect(d.weighted([['only', 1]] as const)).toBe('only');
    }
  });
});

describe('owlTraits', () => {
  it('gives the same bird for the same seed', () => {
    expect(owlTraits('hero-rafter')).toEqual(owlTraits('hero-rafter'));
  });

  it('gives different birds for different seeds', () => {
    expect(owlTraits('hero-rafter')).not.toEqual(owlTraits('hero-truss'));
  });

  it('respects the size bounds it is given', () => {
    for (let i = 0; i < 500; i += 1) {
      const { size } = owlTraits(`s${i}`, { min: 18, max: 24 });
      expect(size).toBeGreaterThanOrEqual(18);
      expect(size).toBeLessThanOrEqual(24);
    }
  });

  it('places every owl inside its band', () => {
    for (let i = 0; i < 500; i += 1) {
      const { ax, ay } = owlTraits(`s${i}`);
      expect(ax).toBeGreaterThanOrEqual(0);
      expect(ax).toBeLessThanOrEqual(1);
      expect(ay).toBeGreaterThanOrEqual(0);
      expect(ay).toBeLessThanOrEqual(1);
    }
  });

  it('never animates a part the owl was not drawn with', () => {
    // A wing shuffle on a wingless owl renders nothing at all and reports no
    // error, which is why this is asserted rather than trusted.
    for (let i = 0; i < 3000; i += 1) {
      const o = owlTraits(`s${i}`);
      if (o.idle === 'shuffle') expect(o.wing).toBe(true);
      if (o.idle === 'perk') expect(o.tufts).toBe(true);
    }
  });

  it('gives every owl a clock of its own', () => {
    // Shared periods would put a page of owls on one blink, which reads as a
    // fault in the page rather than as a flock.
    const periods = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const o = owlTraits(`s${i}`);
      periods.add(`${o.blinkPeriod}:${o.blinkDelay}`);
      expect(o.blinkPeriod).toBeGreaterThan(0);
      expect(o.idlePeriod).toBeGreaterThan(0);
    }
    expect(periods.size).toBe(200);
  });

  it('uses the whole of every axis it deals from', () => {
    const seen = {
      palette: new Set<string>(),
      idle: new Set<string>(),
      blink: new Set<string>(),
      posture: new Set<string>(),
      special: new Set<string>(),
    };
    for (let i = 0; i < 4000; i += 1) {
      const o = owlTraits(`s${i}`);
      for (const k of Object.keys(seen) as (keyof typeof seen)[]) seen[k].add(String(o[k]));
    }
    expect(seen.palette).toEqual(new Set(['ghost', 'ink', 'bone', 'gold']));
    expect(seen.idle.size).toBe(8);
    expect(seen.blink).toEqual(new Set(['single', 'double', 'wink']));
    expect(seen.posture).toEqual(new Set(['upright', 'hunched', 'tall']));
    expect(seen.special).toEqual(new Set(['none', 'sleeper', 'scholar']));
  });
});

/**
 * The seeds actually perched on the site, grouped by the section each group
 * shares. Two owls a reader can see at once have to be visibly different birds.
 *
 * This is the test that makes the seed strings load-bearing rather than
 * decorative. Renaming one re-rolls it — see the note on `draws` — and without
 * this the re-roll could quietly hand a section two identical owls, which is the
 * one outcome the whole feature is trying to avoid. Adding a Roost means adding
 * its seed here.
 */
const ROOSTS: Record<string, readonly string[]> = {
  hero: ['hero-rafter', 'hero-truss'],
  calendar: ['calendar-belfry', 'calendar-ledge'],
  journey: ['journey-hollow', 'journey-branch'],
  finalCta: ['cta-spire', 'cta-nook'],
  notFound: ['lost-hollow', 'lost-bough'],
  parliament: ['footer-parliament-0', 'footer-parliament-1', 'footer-parliament-2'],
  onePerPage: [
    'rules-gable',
    'showcase-loft',
    'platform-beam',
    'agents-roost',
    'agent-alcove',
    'about-attic',
    'contact-sill',
    'legal-margin',
  ],
};

describe('the birds actually on the site', () => {
  it('has no two owls sharing a section that look alike', () => {
    const same = (a: OwlTraits, b: OwlTraits) => a.palette === b.palette && a.idle === b.idle;

    for (const [section, seeds] of Object.entries(ROOSTS)) {
      if (section === 'onePerPage') continue; // never seen together
      const traits = seeds.map((s) => owlTraits(s));
      for (let i = 0; i < traits.length; i += 1) {
        for (let j = i + 1; j < traits.length; j += 1) {
          expect(
            same(traits[i]!, traits[j]!),
            `${section}: ${seeds[i]} and ${seeds[j]} are both a ${traits[i]!.palette} owl that ${traits[i]!.idle}s`,
          ).toBe(false);
        }
      }
    }
  });

  it('uses each seed once', () => {
    const all = Object.values(ROOSTS).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
