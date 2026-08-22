/**
 * Test fixtures.
 *
 * Figures are round on purpose. Every expected value in the test files is
 * arithmetic somebody can do in their head or check on a phone — 4,000 over
 * 1,000 is 4× and not 4.0013× — because a test whose expected value was produced
 * by running the code it is testing proves only that the code is deterministic.
 * Where a test needs an awkward number it says so and shows the working.
 *
 * Amounts are in ₹ lakh throughout, which is arbitrary and consistent: multiples
 * are ratios, so the unit cancels, and the only thing that matters is that the
 * numerator and denominator of any one multiple share it.
 */

import type { Basis, Candidate, ListingStatus, Subject } from './types';

/**
 * A candidate with sensible defaults, overridden per test.
 *
 * Defaults describe a plain listed company with a complete balance sheet: market
 * cap 4,000, revenue 1,000, EBITDA 200, PAT 100, debt 500, cash 100. So
 * enterprise value is 4,400, EV/Revenue is 4.4×, EV/EBITDA is 22×, P/E is 40×.
 * Those four numbers turn up throughout the tests and are worth remembering.
 */
export function candidate(name: string, over: Partial<Candidate> = {}): Candidate {
  return {
    companyId: `c-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    listingStatus: 'listed' as ListingStatus,
    country: 'IN',
    industry: 'Logistics',
    periodEnd: '2026-03-31',
    basis: 'consolidated' as Basis,
    currency: 'INR',
    revenue: 1_000,
    priorRevenue: 800,
    ebitda: 200,
    ebit: 150,
    pat: 100,
    totalDebt: 500,
    cash: 100,
    marketCap: 4_000,
    quoteAsOf: '2026-08-22',
    ...over,
  };
}

/**
 * A subject with the same defaults, so a peer and the subject are directly
 * comparable when a test wants them to be.
 *
 * Net debt of 400 (500 debt less 100 cash) is deliberately non-zero: a subject
 * with no net debt would make the enterprise-to-equity bridge invisible, and the
 * bridge is the thing most worth testing.
 */
export function subject(over: Partial<Subject> = {}): Subject {
  return {
    name: 'Subject Logistics Pvt Ltd',
    currency: 'INR',
    periodEnd: '2026-03-31',
    basis: 'consolidated',
    revenue: 1_000,
    ebitda: 200,
    pat: 100,
    totalDebt: 500,
    cash: 100,
    ...over,
  };
}

/**
 * Five peers whose EV/Revenue multiples are exactly 2, 3, 4, 5 and 6.
 *
 * Built by holding revenue at 1,000 and moving market cap, with debt and cash
 * equal so they cancel out of enterprise value entirely. That leaves EV equal to
 * market cap, so the intended multiple is legible from the fixture rather than
 * needing to be derived — and the median of 2,3,4,5,6 is 4, the quartiles are 3
 * and 5, which is the simplest possible check on the percentile method.
 */
export function evenSpread(): Candidate[] {
  return [2, 3, 4, 5, 6].map((m) =>
    candidate(`Peer ${m}x`, {
      revenue: 1_000,
      marketCap: m * 1_000,
      totalDebt: 200,
      cash: 200,
    }),
  );
}
