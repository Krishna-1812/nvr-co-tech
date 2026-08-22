import { describe, expect, it } from 'vitest';
import { candidate } from './fixtures';
import {
  asComparables,
  ebitdaMargin,
  enterpriseValue,
  evToEbitda,
  evToRevenue,
  formatMultiple,
  formatPercent,
  multiplesOf,
  priceToEarnings,
  revenueGrowth,
} from './multiples';

describe('enterpriseValue', () => {
  it('is market cap plus debt less cash', () => {
    // 4,000 + 500 − 100 = 4,400
    expect(enterpriseValue(candidate('A'))).toBe(4_400);
  });

  it('treats a missing debt or cash as zero, matching the coalesce in 0028', () => {
    expect(enterpriseValue(candidate('A', { totalDebt: null }))).toBe(3_900);
    expect(enterpriseValue(candidate('A', { cash: null }))).toBe(4_500);
    expect(enterpriseValue(candidate('A', { totalDebt: null, cash: null }))).toBe(4_000);
  });

  it('is null without a market cap, so an unlisted peer contributes no multiple', () => {
    expect(enterpriseValue(candidate('A', { marketCap: null }))).toBeNull();
  });

  it('is not fooled by a zero market cap being falsy', () => {
    // A real 0 is a known figure, not an absent one. `if (!marketCap)` would
    // have returned null here and quietly turned a fact into a gap.
    expect(enterpriseValue(candidate('A', { marketCap: 0 }))).toBe(400);
  });
});

describe('the three ratios', () => {
  it('compute from the defaults', () => {
    const c = candidate('A');
    expect(evToRevenue(c)).toBe(4.4); // 4,400 / 1,000
    expect(evToEbitda(c)).toBe(22); //   4,400 / 200
    expect(priceToEarnings(c)).toBe(40); // 4,000 / 100
  });

  it('put market cap over the P/E, not enterprise value', () => {
    // The distinction conclude.ts depends on. If P/E used EV it would read 44.
    expect(priceToEarnings(candidate('A'))).toBe(40);
  });

  it('are null when the figure is unknown', () => {
    expect(evToRevenue(candidate('A', { revenue: null }))).toBeNull();
    expect(evToEbitda(candidate('A', { ebitda: null }))).toBeNull();
    expect(priceToEarnings(candidate('A', { pat: null }))).toBeNull();
  });

  it('refuse a non-positive denominator rather than returning a negative multiple', () => {
    // Matches `revenue > 0` / `ebitda > 0` / `pat > 0` in migration 0028. A
    // negative multiple in a median drags the set toward a number no
    // transaction has ever happened at.
    expect(evToEbitda(candidate('A', { ebitda: -50 }))).toBeNull();
    expect(evToEbitda(candidate('A', { ebitda: 0 }))).toBeNull();
    expect(priceToEarnings(candidate('A', { pat: -10 }))).toBeNull();
    expect(evToRevenue(candidate('A', { revenue: 0 }))).toBeNull();
  });

  it('allow a negative enterprise value through, because that is a real thing', () => {
    // Net cash greater than market cap. Rare, happens after a crash, and the
    // multiple is genuine information rather than an artefact.
    const c = candidate('A', { marketCap: 100, totalDebt: 0, cash: 500 });
    expect(enterpriseValue(c)).toBe(-400);
    expect(evToRevenue(c)).toBe(-0.4);
  });
});

describe('multiplesOf', () => {
  it('returns all four, with nulls where they belong', () => {
    expect(multiplesOf(candidate('A', { ebitda: null }))).toEqual({
      enterpriseValue: 4_400,
      evToRevenue: 4.4,
      evToEbitda: null,
      priceToEarnings: 40,
    });
  });

  it('gives an unlisted peer figures but no multiples', () => {
    const m = multiplesOf(candidate('Unlisted', { marketCap: null, listingStatus: 'unlisted' }));
    expect(m).toEqual({
      enterpriseValue: null,
      evToRevenue: null,
      evToEbitda: null,
      priceToEarnings: null,
    });
  });
});

describe('asComparables', () => {
  it('preserves order, because nearest-first is information', () => {
    const names = asComparables([candidate('First'), candidate('Second')]).map((c) => c.name);
    expect(names).toEqual(['First', 'Second']);
  });
});

describe('revenueGrowth', () => {
  it('is the change over the prior period as a fraction', () => {
    // 1,000 from 800 is +25%.
    expect(revenueGrowth(candidate('A'))).toBe(0.25);
  });

  it('handles a decline', () => {
    expect(revenueGrowth(candidate('A', { revenue: 600, priorRevenue: 800 }))).toBe(-0.25);
  });

  it('is null off a zero or negative base, and null when either side is unknown', () => {
    expect(revenueGrowth(candidate('A', { priorRevenue: 0 }))).toBeNull();
    expect(revenueGrowth(candidate('A', { priorRevenue: -100 }))).toBeNull();
    expect(revenueGrowth(candidate('A', { priorRevenue: null }))).toBeNull();
    expect(revenueGrowth(candidate('A', { revenue: null }))).toBeNull();
  });
});

describe('ebitdaMargin', () => {
  it('is EBITDA over revenue', () => {
    expect(ebitdaMargin(candidate('A'))).toBe(0.2);
  });

  it('allows a negative margin through, unlike a negative multiple', () => {
    // A loss-making business has a real margin and a reader should see it. It
    // is only as a DENOMINATOR that a negative becomes meaningless.
    expect(ebitdaMargin(candidate('A', { ebitda: -150 }))).toBe(-0.15);
  });

  it('is null without a positive revenue', () => {
    expect(ebitdaMargin(candidate('A', { revenue: 0 }))).toBeNull();
    expect(ebitdaMargin(candidate('A', { revenue: null }))).toBeNull();
  });
});

describe('formatting', () => {
  it('renders a multiple to one decimal with the sign', () => {
    expect(formatMultiple(4.4)).toBe('4.4×');
    expect(formatMultiple(22)).toBe('22.0×');
  });

  it('renders an absent figure as a dash, never as a zero', () => {
    expect(formatMultiple(null)).toBe('—');
    expect(formatPercent(null)).toBe('—');
  });

  it('distinguishes a real zero from an absence', () => {
    expect(formatMultiple(0)).toBe('0.0×');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('signs a positive percentage but not a negative one twice', () => {
    expect(formatPercent(0.25)).toBe('+25.0%');
    expect(formatPercent(-0.25)).toBe('-25.0%');
  });
});

describe('agreement with the generated columns in migration 0028', () => {
  /*
   * These are the cases where the SQL and the TypeScript could drift apart, in
   * the shape the migration's own CASE expressions are written. If one of these
   * fails, the two implementations have diverged and the test says which
   * behaviour moved. Editing either side means editing both.
   */
  const cases: {
    what: string;
    given: Parameters<typeof candidate>[1];
    ev: number | null;
    evRev: number | null;
    evEbitda: number | null;
    pe: number | null;
  }[] = [
    {
      what: 'everything present',
      given: {},
      ev: 4_400,
      evRev: 4.4,
      evEbitda: 22,
      pe: 40,
    },
    {
      what: 'null market cap kills all four',
      given: { marketCap: null },
      ev: null,
      evRev: null,
      evEbitda: null,
      pe: null,
    },
    {
      what: 'null debt coalesces to zero',
      given: { totalDebt: null },
      ev: 3_900,
      evRev: 3.9,
      evEbitda: 19.5,
      pe: 40,
    },
    {
      what: 'null cash coalesces to zero',
      given: { cash: null },
      ev: 4_500,
      evRev: 4.5,
      evEbitda: 22.5,
      pe: 40,
    },
    {
      what: 'zero revenue fails the > 0 guard but leaves the others',
      given: { revenue: 0 },
      ev: 4_400,
      evRev: null,
      evEbitda: 22,
      pe: 40,
    },
    {
      what: 'negative EBITDA fails its guard only',
      given: { ebitda: -200 },
      ev: 4_400,
      evRev: 4.4,
      evEbitda: null,
      pe: 40,
    },
    {
      what: 'zero PAT fails its guard only',
      given: { pat: 0 },
      ev: 4_400,
      evRev: 4.4,
      evEbitda: 22,
      pe: null,
    },
  ];

  for (const c of cases) {
    it(c.what, () => {
      const m = multiplesOf(candidate('X', c.given));
      expect(m.enterpriseValue).toBe(c.ev);
      expect(m.evToRevenue).toBe(c.evRev);
      expect(m.evToEbitda).toBe(c.evEbitda);
      expect(m.priceToEarnings).toBe(c.pe);
    });
  }
});
