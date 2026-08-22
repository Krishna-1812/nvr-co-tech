import { describe, expect, it } from 'vitest';
import { candidate, evenSpread, subject } from './fixtures';
import { asComparables } from './multiples';
import { spreadOf } from './stats';
import {
  applyDiscounts,
  applyMethod,
  describeDiscounts,
  enterpriseFromEquity,
  equityFromEnterprise,
  isApplied,
  isEnterpriseMultiple,
  reconcile,
} from './conclude';
import type { MethodKey } from './types';

const PEERS = asComparables(evenSpread());

/*
 * The fixture is built so all three methods produce a product of exactly 4,000
 * against the default subject, which is what makes the bridge visible:
 *
 *   EV/Revenue  median 4   × revenue 1,000 = 4,000  → an ENTERPRISE value
 *   EV/EBITDA   median 20  × EBITDA  200   = 4,000  → an ENTERPRISE value
 *   P/E         median 40  × PAT     100   = 4,000  → an EQUITY value
 *
 * Subject net debt is 400 (500 debt less 100 cash), so the two enterprise
 * methods must land on equity of 3,600 and the equity method on 4,000. If any of
 * them agrees with the others, the bridge has been applied to the wrong family
 * or applied twice.
 */
const spreads = {
  ev_revenue: spreadOf(PEERS, (c) => c.multiples.evToRevenue),
  ev_ebitda: spreadOf(PEERS, (c) => c.multiples.evToEbitda),
  pe: spreadOf(PEERS, (c) => c.multiples.priceToEarnings),
} satisfies Record<MethodKey, ReturnType<typeof spreadOf>>;

describe('the fixture medians are what the tests below assume', () => {
  it('reads 4, 20 and 40', () => {
    expect(spreads.ev_revenue.median).toBe(4);
    expect(spreads.ev_ebitda.median).toBe(20);
    expect(spreads.pe.median).toBe(40);
  });
});

describe('isEnterpriseMultiple', () => {
  it('puts the two EV multiples in one family and P/E in the other', () => {
    expect(isEnterpriseMultiple('ev_revenue')).toBe(true);
    expect(isEnterpriseMultiple('ev_ebitda')).toBe(true);
    expect(isEnterpriseMultiple('pe')).toBe(false);
  });
});

describe('the bridge', () => {
  it('goes enterprise to equity by taking off net debt', () => {
    expect(equityFromEnterprise(4_000, subject())).toBe(3_600);
  });

  it('goes back the other way', () => {
    expect(enterpriseFromEquity(3_600, subject())).toBe(4_000);
  });

  it('is a round trip', () => {
    const s = subject({ totalDebt: 1_234, cash: 567 });
    expect(equityFromEnterprise(enterpriseFromEquity(999, s), s)).toBe(999);
  });

  it('treats a blank debt or cash as zero', () => {
    expect(equityFromEnterprise(4_000, subject({ totalDebt: null, cash: null }))).toBe(4_000);
  });

  it('passes null through rather than inventing a value', () => {
    expect(equityFromEnterprise(null, subject())).toBeNull();
    expect(enterpriseFromEquity(null, subject())).toBeNull();
  });

  it('handles a net-cash subject, where equity exceeds enterprise value', () => {
    expect(equityFromEnterprise(1_000, subject({ totalDebt: 0, cash: 300 }))).toBe(1_300);
  });
});

describe('applyMethod', () => {
  it('applies an enterprise multiple and bridges to equity', () => {
    const out = applyMethod('ev_revenue', spreads.ev_revenue, 'median', subject());
    expect(isApplied(out)).toBe(true);
    if (!isApplied(out)) return;

    expect(out.multiple).toBe(4);
    expect(out.subjectMetric).toBe(1_000);
    expect(out.impliedEnterpriseValue).toBe(4_000);
    expect(out.impliedEquityValue).toBe(3_600);
    expect(out.peers).toBe(5);
  });

  it('applies an equity multiple WITHOUT bridging, and derives enterprise value backwards', () => {
    const out = applyMethod('pe', spreads.pe, 'median', subject());
    if (!isApplied(out)) throw new Error('expected P/E to apply');

    // 40 × 100 = 4,000, and that is already the equity. Subtracting net debt
    // here would have said 3,600 and understated the shareholders by 400.
    expect(out.impliedEquityValue).toBe(4_000);
    expect(out.impliedEnterpriseValue).toBe(4_400);
  });

  it('is the single most important assertion in this file', () => {
    /*
     * All three products are 4,000. The two enterprise methods must reach 3,600
     * of equity and the equity method 4,000. If this ever fails, somebody has
     * applied the debt-and-cash bridge to the wrong family — the error that is
     * invisible in the output because the wrong number looks exactly like the
     * right one.
     */
    const s = subject();
    const evRev = applyMethod('ev_revenue', spreads.ev_revenue, 'median', s);
    const evEbitda = applyMethod('ev_ebitda', spreads.ev_ebitda, 'median', s);
    const pe = applyMethod('pe', spreads.pe, 'median', s);
    if (!isApplied(evRev) || !isApplied(evEbitda) || !isApplied(pe)) {
      throw new Error('expected all three to apply');
    }

    expect(evRev.impliedEquityValue).toBe(3_600);
    expect(evEbitda.impliedEquityValue).toBe(3_600);
    expect(pe.impliedEquityValue).toBe(4_000);
    expect(pe.impliedEquityValue).not.toBe(evRev.impliedEquityValue);
  });

  it('honours the statistic it was asked for', () => {
    // Q1 of 2,3,4,5,6 is 3, so 3 × 1,000 = 3,000 enterprise, 2,600 equity.
    const out = applyMethod('ev_revenue', spreads.ev_revenue, 'q1', subject());
    if (!isApplied(out)) throw new Error('expected it to apply');
    expect(out.multiple).toBe(3);
    expect(out.statistic).toBe('q1');
    expect(out.impliedEquityValue).toBe(2_600);
  });

  it('refuses when no peer had the multiple, and says so', () => {
    const unlisted = asComparables([candidate('U', { marketCap: null })]);
    const empty = spreadOf(unlisted, (c) => c.multiples.evToRevenue);
    const out = applyMethod('ev_revenue', empty, 'median', subject());
    expect(isApplied(out)).toBe(false);
    if (isApplied(out)) return;
    expect(out.reason).toContain('No comparable in the set');
  });

  it('names P/E as P/E in its refusal rather than calling it a multiple', () => {
    const unlisted = asComparables([candidate('U', { marketCap: null })]);
    const empty = spreadOf(unlisted, (c) => c.multiples.priceToEarnings);
    const out = applyMethod('pe', empty, 'median', subject());
    if (isApplied(out)) throw new Error('expected a refusal');
    expect(out.reason).toContain('usable P/E');
  });

  it('distinguishes a missing subject figure from a non-positive one', () => {
    // Two different sentences because they call for two different actions: go
    // and find the number, versus this method cannot work for this company.
    const missing = applyMethod('ev_ebitda', spreads.ev_ebitda, 'median', subject({ ebitda: null }));
    const negative = applyMethod('ev_ebitda', spreads.ev_ebitda, 'median', subject({ ebitda: -50 }));
    if (isApplied(missing) || isApplied(negative)) throw new Error('expected refusals');

    expect(missing.reason).toBe("The subject's EBITDA is not known");
    expect(negative.reason).toBe(
      "The subject's EBITDA is not positive, so this method cannot produce a meaningful value",
    );
  });

  it('refuses a zero metric, not only a negative one', () => {
    const out = applyMethod('pe', spreads.pe, 'median', subject({ pat: 0 }));
    if (isApplied(out)) throw new Error('expected a refusal');
    expect(out.reason).toContain('not positive');
  });
});

describe('reconcile', () => {
  const results = [
    applyMethod('ev_revenue', spreads.ev_revenue, 'median', subject()),
    applyMethod('pe', spreads.pe, 'median', subject()),
  ];

  it('weights the applied methods', () => {
    // 3,600 and 4,000 at half each is 3,800.
    const c = reconcile(results, { ev_revenue: 0.5, pe: 0.5 });
    expect(c.low).toBe(3_600);
    expect(c.high).toBe(4_000);
    expect(c.weighted).toBe(3_800);
    expect(c.weightsNormalised).toBe(false);
  });

  it('reports the dispersion between methods', () => {
    const c = reconcile(results, { ev_revenue: 0.5, pe: 0.5 });
    expect(c.dispersion).toBeCloseTo(4_000 / 3_600, 12);
  });

  it('scales weights that do not sum to one, and says that it did', () => {
    // 40 and 40 become half each. The answer is the same; the disclosure is
    // the point — a reviewer accepting a weighting is entitled to know it was
    // not the weighting handed in.
    const c = reconcile(results, { ev_revenue: 40, pe: 40 });
    expect(c.weights).toEqual({ ev_revenue: 0.5, pe: 0.5 });
    expect(c.weightsNormalised).toBe(true);
    expect(c.weighted).toBe(3_800);
  });

  it('gives an unnamed method zero weight rather than a default', () => {
    const c = reconcile(results, { ev_revenue: 1 });
    expect(c.weights).toEqual({ ev_revenue: 1, pe: 0 });
    expect(c.weighted).toBe(3_600);
  });

  it('still shows an unweighted method in the range, because the range is the evidence', () => {
    // Deliberate: `weighted` is the conclusion and low/high is what was
    // considered. A method applied and then given no weight is a judgement a
    // reviewer may want to disagree with, so it stays visible.
    const c = reconcile(results, { ev_revenue: 1 });
    expect(c.low).toBe(3_600);
    expect(c.high).toBe(4_000);
    expect(c.applied).toHaveLength(2);
  });

  it('concludes nothing rather than zero when nothing was weighted', () => {
    const c = reconcile(results, {});
    expect(c.weighted).toBeNull();
    expect(c.low).toBe(3_600);
  });

  it('ignores a negative or non-finite weight', () => {
    const c = reconcile(results, { ev_revenue: -1, pe: 2 });
    expect(c.weights).toEqual({ ev_revenue: 0, pe: 1 });
    expect(c.weighted).toBe(4_000);
  });

  it('keeps refusals in the output so a reader can see what did not run', () => {
    const withRefusal = [
      ...results,
      applyMethod('ev_ebitda', spreads.ev_ebitda, 'median', subject({ ebitda: null })),
    ];
    const c = reconcile(withRefusal, { ev_revenue: 0.4, pe: 0.3, ev_ebitda: 0.3 });

    expect(c.refused).toHaveLength(1);
    expect(c.refused[0].method).toBe('ev_ebitda');
    // The 30% that had nowhere to go is rescaled across what ran, and flagged.
    expect(c.weightsNormalised).toBe(true);
    expect(c.weights.ev_revenue).toBeCloseTo(4 / 7, 12);
    expect(c.weights.pe).toBeCloseTo(3 / 7, 12);
  });

  it('concludes nothing when every method refused', () => {
    const none = [
      applyMethod('ev_ebitda', spreads.ev_ebitda, 'median', subject({ ebitda: null })),
      applyMethod('pe', spreads.pe, 'median', subject({ pat: null })),
    ];
    const c = reconcile(none, { ev_ebitda: 0.5, pe: 0.5 });
    expect(c.applied).toHaveLength(0);
    expect(c.refused).toHaveLength(2);
    expect(c.low).toBeNull();
    expect(c.high).toBeNull();
    expect(c.weighted).toBeNull();
    expect(c.dispersion).toBeNull();
  });
});

describe('applyDiscounts', () => {
  it('applies successive discounts multiplicatively, not additively', () => {
    // 20% then 10% leaves 72%, not 70%. The difference is small and the
    // reasoning is not: they are two reductions of the same value, not two
    // slices of it.
    expect(applyDiscounts(1_000, { dlom: 0.2, dloc: 0.1 })).toBeCloseTo(720, 10);
  });

  it('has no default discount', () => {
    expect(applyDiscounts(1_000, {})).toBe(1_000);
  });

  it('clamps a discount into nought-to-one rather than inverting the value', () => {
    expect(applyDiscounts(1_000, { dlom: 1.5 })).toBe(0);
    expect(applyDiscounts(1_000, { dlom: -0.5 })).toBe(1_000);
  });

  it('passes null through', () => {
    expect(applyDiscounts(null, { dlom: 0.2 })).toBeNull();
  });
});

describe('describeDiscounts', () => {
  it('says plainly when none were applied', () => {
    expect(describeDiscounts({})).toBe('No marketability or control discount applied');
  });

  it('shows the arithmetic, so a reader who adds them can see why 72 and not 70', () => {
    expect(describeDiscounts({ dlom: 0.2, dloc: 0.1 })).toBe(
      'DLOM 20% and DLOC 10%, applied in succession — 72.0% of the undiscounted value',
    );
  });

  it('names only the one that was applied, and drops "in succession" with it', () => {
    expect(describeDiscounts({ dlom: 0.25 })).toBe(
      'DLOM 25%, applied — 75.0% of the undiscounted value',
    );
  });
});
