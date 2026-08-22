/**
 * The four multiples.
 *
 * ── Why this arithmetic exists twice ──────────────────────────────────────
 *
 * Migration 0028 computes these same four as generated columns on
 * `peer_set_members`, and this file computes them again in TypeScript. That is
 * deliberate and it is not the kind of duplication that rots, for two reasons.
 *
 * The database is authoritative for anything SAVED: once a peer set is written,
 * the stored multiple is what a reviewer sees, and it cannot drift from the
 * figures beside it because Postgres regenerates it from those figures. That is
 * the same guarantee `net_total` and `grand_total` give a voucher.
 *
 * But a comparables table is worked on before it is saved — peers added, peers
 * removed, a period changed — and asking the database to recompute on every
 * keystroke would mean writing rows nobody has agreed to yet. So the screen
 * needs the same arithmetic in front of it.
 *
 * What keeps the two honest is `multiples.test.ts`: it runs a table of edge cases
 * that name the SQL behaviour explicitly — the `> 0` guards, the coalesce of a
 * null debt to zero, the null-in-null-out rule — so if somebody changes one side
 * the test says which side moved. If you edit this file, edit the migration, and
 * vice versa.
 *
 * ── Why nothing is rounded ────────────────────────────────────────────────
 *
 * A multiple is not money. Rounding one to two decimals and then multiplying it
 * by a subject revenue moves the answer by real amounts — at a revenue of ₹40
 * crore, a multiple rounded from 4.2749 to 4.27 loses ₹19.6 lakh of value for no
 * reason anybody could defend. So the engine keeps full precision throughout and
 * rounding happens once, at the display boundary. `formatMultiple` below is that
 * boundary, and it is the only function here that rounds.
 */

import type { Candidate, Comparable, Figure, Multiples } from './types';

/** Whether a figure is a usable number rather than "not known". */
export function isKnown(figure: Figure | undefined): figure is number {
  return typeof figure === 'number' && Number.isFinite(figure);
}

/**
 * Enterprise value: market capitalisation, plus debt, less cash.
 *
 * Null when there is no market capitalisation, because without a price the
 * market has not said what the company is worth and there is nothing to add debt
 * to. That is why an unlisted peer contributes a revenue figure to a peer set and
 * no multiple.
 *
 * A null debt or cash counts as zero, matching `coalesce(total_debt, 0)` in the
 * migration. This is the one place the engine substitutes a default for an
 * unknown, and it is worth being uneasy about: a company with undisclosed
 * borrowings gets an enterprise value that is too low. It is done anyway because
 * the alternative — refusing an EV to any peer with an incomplete balance sheet —
 * would empty the table for exactly the private companies this tool exists to
 * value, and because the direction of the error is knowable rather than random.
 * Where it matters, the schedule shows debt and cash beside the multiple so a
 * reader can see which cells were blank.
 */
export function enterpriseValue(c: Pick<Candidate, 'marketCap' | 'totalDebt' | 'cash'>): Figure {
  if (!isKnown(c.marketCap)) return null;
  return c.marketCap + (isKnown(c.totalDebt) ? c.totalDebt : 0) - (isKnown(c.cash) ? c.cash : 0);
}

/**
 * A ratio, or null.
 *
 * The denominator must be strictly positive, not merely non-zero. A negative
 * EBITDA produces a negative multiple, which is arithmetically fine and
 * analytically meaningless: it says the market pays a negative amount per rupee
 * of losses, and putting it into a median drags the whole peer set toward a
 * number no transaction has ever happened at. Loss-making peers are excluded
 * from that multiple and reported as missing, which is a fact a reader can act
 * on. This matches the `revenue > 0` / `ebitda > 0` / `pat > 0` guards in 0028.
 */
function ratio(numerator: Figure, denominator: Figure): Figure {
  if (!isKnown(numerator) || !isKnown(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

/** EV / Revenue. The workhorse for anything growing faster than it earns. */
export function evToRevenue(c: Pick<Candidate, 'marketCap' | 'totalDebt' | 'cash' | 'revenue'>): Figure {
  return ratio(enterpriseValue(c), c.revenue);
}

/** EV / EBITDA. */
export function evToEbitda(c: Pick<Candidate, 'marketCap' | 'totalDebt' | 'cash' | 'ebitda'>): Figure {
  return ratio(enterpriseValue(c), c.ebitda);
}

/**
 * Price / Earnings.
 *
 * Note what is on top: market capitalisation, not enterprise value. P/E is an
 * EQUITY multiple and the other two are ENTERPRISE multiples, which is the
 * distinction `conclude.ts` exists to get right — applying a P/E gives an equity
 * value directly, applying an EV multiple gives an enterprise value that still
 * needs the debt-and-cash bridge. Mixing them up overstates a leveraged
 * company's equity by the whole of its net debt.
 */
export function priceToEarnings(c: Pick<Candidate, 'marketCap' | 'pat'>): Figure {
  return ratio(c.marketCap, c.pat);
}

/** All four at once. */
export function multiplesOf(c: Candidate): Multiples {
  return {
    enterpriseValue: enterpriseValue(c),
    evToRevenue: evToRevenue(c),
    evToEbitda: evToEbitda(c),
    priceToEarnings: priceToEarnings(c),
  };
}

/** A candidate with its multiples attached. */
export function asComparable(c: Candidate): Comparable {
  return { ...c, multiples: multiplesOf(c) };
}

/** Every candidate, with multiples. Order is preserved. */
export function asComparables(candidates: readonly Candidate[]): Comparable[] {
  return candidates.map(asComparable);
}

/**
 * Revenue growth over the prior period, as a fraction.
 *
 * Used by the growth screen and shown on the schedule, because a peer trading at
 * 8× revenue while growing 60% a year and a peer trading at 8× revenue while
 * shrinking are not comparable to each other, let alone to the subject.
 *
 * Requires a strictly positive prior revenue for the same reason `ratio` does: a
 * growth rate off a zero or negative base is a number with no meaning.
 */
export function revenueGrowth(c: Pick<Candidate, 'revenue' | 'priorRevenue'>): Figure {
  if (!isKnown(c.revenue) || !isKnown(c.priorRevenue) || c.priorRevenue <= 0) return null;
  return (c.revenue - c.priorRevenue) / c.priorRevenue;
}

/**
 * EBITDA margin, as a fraction.
 *
 * Negative margins are allowed through, unlike negative multiples. A margin of
 * −15% is a fact about the business that a reader should see; it is only as the
 * denominator of a multiple that a negative figure becomes nonsense.
 */
export function ebitdaMargin(c: Pick<Candidate, 'revenue' | 'ebitda'>): Figure {
  if (!isKnown(c.ebitda) || !isKnown(c.revenue) || c.revenue <= 0) return null;
  return c.ebitda / c.revenue;
}

/**
 * A multiple for display: one decimal, with the ×.
 *
 * One decimal rather than two because two implies a precision that a peer set of
 * nine companies does not have. An empty figure renders as an em dash, never as
 * a zero and never as "N/A" — the dash is what an accountant writes in a column
 * where there is nothing, and it reads as absence rather than as a value.
 */
export function formatMultiple(figure: Figure): string {
  if (!isKnown(figure)) return '—';
  return `${figure.toFixed(1)}×`;
}

/** A percentage for display: one decimal, signed. Absent renders as a dash. */
export function formatPercent(figure: Figure): string {
  if (!isKnown(figure)) return '—';
  const pct = figure * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}
