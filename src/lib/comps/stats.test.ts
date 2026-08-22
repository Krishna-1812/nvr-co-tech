import { describe, expect, it } from 'vitest';
import { asComparables } from './multiples';
import { candidate, evenSpread } from './fixtures';
import {
  dispersionOf,
  median,
  outliersOf,
  percentile,
  spreadOf,
  statisticOf,
} from './stats';

describe('percentile', () => {
  it('agrees with Excel QUARTILE.INC on the documented example', () => {
    // 1,2,4,7,8: Excel gives Q1 = 2, Q2 = 4, Q3 = 7. Ranks land exactly on
    // members here, so no interpolation is involved and any method agrees —
    // which is what makes it a good first check.
    const v = [1, 2, 4, 7, 8];
    expect(percentile(v, 0.25)).toBe(2);
    expect(percentile(v, 0.5)).toBe(4);
    expect(percentile(v, 0.75)).toBe(7);
  });

  it('interpolates when the rank falls between two members', () => {
    // Four values, so Q1 sits at rank (4−1)×0.25 = 0.75 — three quarters of the
    // way from 1 to 2, which is 1.75. Excel's QUARTILE.INC says 1.75 too. A
    // nearest-rank method would have said 1 or 2, which is the disagreement
    // this test exists to pin down.
    const v = [1, 2, 3, 4];
    expect(percentile(v, 0.25)).toBe(1.75);
    expect(percentile(v, 0.5)).toBe(2.5);
    expect(percentile(v, 0.75)).toBe(3.25);
  });

  it('returns the only member of a one-element set for every percentile', () => {
    expect(percentile([7], 0.25)).toBe(7);
    expect(percentile([7], 0.5)).toBe(7);
    expect(percentile([7], 0.75)).toBe(7);
  });

  it('is null for an empty set', () => {
    expect(percentile([], 0.5)).toBeNull();
  });

  it('does not mutate its input', () => {
    const v = [3, 1, 2];
    percentile(v, 0.5);
    expect(v).toEqual([3, 1, 2]);
  });

  it('sorts numerically, not lexically', () => {
    // The bug JavaScript hands you for free: [2,10].sort() is [10,2].
    expect(median([2, 10, 100])).toBe(10);
  });
});

describe('median', () => {
  it('is the middle of an odd set and the mean of the middle two of an even one', () => {
    expect(median([2, 3, 4, 5, 6])).toBe(4);
    expect(median([2, 3, 5, 6])).toBe(4);
  });
});

describe('spreadOf', () => {
  it('describes the even fixture exactly', () => {
    // Peers at 2,3,4,5,6 ×. Median 4, quartiles 3 and 5, mean 4.
    const s = spreadOf(asComparables(evenSpread()), (c) => c.multiples.evToRevenue);
    expect(s).toEqual({
      n: 5,
      missing: 0,
      min: 2,
      q1: 3,
      median: 4,
      q3: 5,
      max: 6,
      mean: 4,
      outliers: [],
    });
  });

  it('counts what it could not use rather than skipping it silently', () => {
    // Four peers, two of which are unlisted and so have no multiple at all. A
    // median of two peers presented as a median of four is the misleading
    // number this count exists to prevent.
    const peers = asComparables([
      candidate('Listed A', { revenue: 1_000, marketCap: 3_000, totalDebt: 0, cash: 0 }),
      candidate('Listed B', { revenue: 1_000, marketCap: 5_000, totalDebt: 0, cash: 0 }),
      candidate('Unlisted A', { marketCap: null }),
      candidate('Unlisted B', { marketCap: null }),
    ]);
    const s = spreadOf(peers, (c) => c.multiples.evToRevenue);
    expect(s.n).toBe(2);
    expect(s.missing).toBe(2);
    expect(s.median).toBe(4);
  });

  it('is empty but honest when nobody had the figure', () => {
    const peers = asComparables([candidate('A', { marketCap: null }), candidate('B', { marketCap: null })]);
    const s = spreadOf(peers, (c) => c.multiples.evToEbitda);
    expect(s.n).toBe(0);
    expect(s.missing).toBe(2);
    expect(s.median).toBeNull();
    expect(s.outliers).toEqual([]);
  });

  it('keeps an outlier in n, in the median and in the quartiles', () => {
    /*
     * 2,3,4,5,40. IQR is 5 − 3 = 2, so the upper fence is 5 + 3 = 8 and 40 is
     * outside it. The point of this test is everything that does NOT change:
     * n is still 5 and the median is still 4, because the engine reports the
     * outlier and refuses to remove it. The peer at 40× may be the one that
     * just transacted.
     */
    const peers = asComparables(
      [2, 3, 4, 5, 40].map((m) =>
        candidate(`P${m}`, { revenue: 1_000, marketCap: m * 1_000, totalDebt: 0, cash: 0 }),
      ),
    );
    const s = spreadOf(peers, (c) => c.multiples.evToRevenue);
    expect(s.n).toBe(5);
    expect(s.median).toBe(4);
    expect(s.q1).toBe(3);
    expect(s.q3).toBe(5);
    expect(s.outliers).toEqual([40]);
    expect(s.max).toBe(40);
    // And the mean is dragged, which is exactly why the median leads: 10.8 vs 4.
    expect(s.mean).toBeCloseTo(10.8, 10);
  });
});

describe('outliersOf', () => {
  it('flags both tails', () => {
    // 1,10,11,12,13,50 → q1 = 10.25, q3 = 12.75, IQR 2.5, fences 6.5 and 16.5.
    const sorted = [1, 10, 11, 12, 13, 50];
    expect(outliersOf(sorted, 10.25, 12.75)).toEqual([1, 50]);
  });

  it('flags nothing when the quartiles have collapsed to a point', () => {
    // Most of the set at one multiple. The fence is no longer measuring
    // anything, so flagging every value that differs at all would be noise.
    expect(outliersOf([4, 4, 4, 4, 9], 4, 4)).toEqual([]);
  });

  it('flags nothing when a quartile is unknown', () => {
    expect(outliersOf([1, 2], null, 2)).toEqual([]);
  });
});

describe('dispersionOf', () => {
  it('is high over low', () => {
    expect(dispersionOf(2, 8)).toBe(4);
  });

  it('is null when the low is not positive, because the ratio would say nothing', () => {
    expect(dispersionOf(0, 8)).toBeNull();
    expect(dispersionOf(-2, 8)).toBeNull();
    expect(dispersionOf(null, 8)).toBeNull();
  });
});

describe('statisticOf', () => {
  const s = spreadOf(asComparables(evenSpread()), (c) => c.multiples.evToRevenue);

  it('reads the named statistic off a spread', () => {
    expect(statisticOf(s, 'median')).toBe(4);
    expect(statisticOf(s, 'mean')).toBe(4);
    expect(statisticOf(s, 'q1')).toBe(3);
    expect(statisticOf(s, 'q3')).toBe(5);
  });
});
