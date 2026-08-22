/**
 * The domain model for comparable-company valuation, and the only description
 * of it.
 *
 * Three things shaped this file.
 *
 * `Figure` is `number | null` everywhere, and **null means "not known"**. It
 * never means zero. That distinction is the whole reason this tool can be sold
 * to somebody who checks: a private company that has not filed has an unknown
 * revenue, and a company that genuinely earned nothing has a revenue of zero,
 * and a comparables table that renders both as `0` is lying about one of them.
 * Every function here propagates null rather than substituting a default, so a
 * multiple that cannot be computed comes back null and the screen shows a gap.
 *
 * Dates are `yyyy-mm-dd` strings rather than Date objects, for the reason
 * lib/recon/types gives: every date here comes out of a filing and goes into a
 * schedule, and a Date carries a timezone that neither of those has. ISO strings
 * also compare correctly with `<=`, which is the only comparison needed.
 *
 * And everything is a plain object with free functions over it, not a class. A
 * concluded valuation is stored as JSON and reopened months later by a reviewer,
 * so every value in here has to survive a round trip through Postgres unchanged.
 */

/** A money or count figure. Null is "not known" — never zero. */
export type Figure = number | null;

/** Matches `companies.listing_status` in migration 0028. */
export type ListingStatus = 'listed' | 'unlisted' | 'delisted' | 'unknown';

/**
 * Standalone or consolidated.
 *
 * Kept on every figure rather than assumed, because mixing the two inside one
 * peer set is the most common way a comparables table quietly becomes wrong and
 * it cannot be spotted afterwards from the numbers alone. A holding company's
 * standalone revenue can be a tenth of its consolidated revenue.
 */
export type Basis = 'standalone' | 'consolidated';

/**
 * Who or what decided a peer belonged in the set.
 *
 * Mirrors `peer_set_members.decided_by`. It exists so a reviewer can tell a
 * mechanical screen result from a judgement somebody made, which are different
 * things to argue with.
 */
export type DecidedBy = 'screen' | 'model' | 'person';

/**
 * One candidate company with the figures a comparables table needs.
 *
 * This is the shape the engine works on — deliberately flat, and deliberately
 * not the database row. `peer_set_members` freezes these same numbers, and this
 * type is what gets frozen; keeping them the same shape is what lets a saved
 * schedule be re-rendered years later without the engine having to know which
 * version of the database wrote it.
 */
export type Candidate = {
  companyId: string;
  name: string;
  listingStatus: ListingStatus;
  country: string;
  industry?: string | null;

  /** The reporting period these figures are for, `yyyy-mm-dd`. */
  periodEnd: string | null;
  basis: Basis;
  currency: string;

  revenue: Figure;
  /** The prior period's revenue, for the growth screen. Null if unknown. */
  priorRevenue?: Figure;
  ebitda: Figure;
  ebit?: Figure;
  pat: Figure;
  totalDebt: Figure;
  cash: Figure;

  /** As at the peer set's date, not the period end. Null for an unlisted peer. */
  marketCap: Figure;
  /** The date the market cap was true, `yyyy-mm-dd`. */
  quoteAsOf?: string | null;

  /** Which stored rows these came from, so every cell traces to a filing. */
  financialsId?: number | null;
  quoteId?: number | null;
};

/**
 * The four multiples, as computed. Any of them may be null.
 *
 * Deliberately the same four the database generates, and computed by the same
 * arithmetic — see the note at the top of multiples.ts on why there are two
 * implementations of one formula and why that is safe rather than duplication.
 */
export type Multiples = {
  enterpriseValue: Figure;
  evToRevenue: Figure;
  evToEbitda: Figure;
  priceToEarnings: Figure;
};

/** A candidate with its multiples worked out. */
export type Comparable = Candidate & { multiples: Multiples };

/**
 * A candidate that did not make the set, and why not.
 *
 * The reason is required, not optional. `peer_set_members` enforces the same
 * thing with a CHECK constraint, for the same reason: a peer set whose rejects
 * are invisible is the one a reviewer cannot check, and "we looked at it and
 * ruled it out because it is a holding company" is worth more to them than a
 * shorter list with no explanation.
 */
export type Rejection = {
  candidate: Candidate;
  reason: string;
  decidedBy: DecidedBy;
};

/** What a screen concluded about a pool of candidates. */
export type ScreenResult = {
  kept: Candidate[];
  rejected: Rejection[];
};

/**
 * The distribution of one multiple across a peer set.
 *
 * `n` and `missing` are both reported because they answer different questions. A
 * median over four peers out of twelve is a different claim from a median over
 * eleven, and only one of those should be put in front of an investor without a
 * caveat. The screen shows both.
 */
export type Spread = {
  /** How many peers had this figure. */
  n: number;
  /** How many were in the set but had no value for it. */
  missing: number;
  min: Figure;
  q1: Figure;
  median: Figure;
  q3: Figure;
  max: Figure;
  mean: Figure;
  /**
   * Values outside the 1.5 × IQR fence. Reported, never removed — see the note
   * in stats.ts on why the engine refuses to drop them for you.
   */
  outliers: number[];
};

/** Which multiple a method used. */
export type MethodKey = 'ev_revenue' | 'ev_ebitda' | 'pe';

/** Which statistic of the peer spread was applied. */
export type Statistic = 'median' | 'mean' | 'q1' | 'q3';

/**
 * The subject being valued.
 *
 * `totalDebt` and `cash` are here because they are needed for the bridge between
 * enterprise value and equity value, and that bridge uses the SUBJECT's balance
 * sheet, never the peers'. Getting that wrong is the classic error this file
 * exists to make hard.
 */
export type Subject = {
  name: string;
  currency: string;
  periodEnd: string | null;
  basis: Basis;
  revenue: Figure;
  ebitda: Figure;
  pat: Figure;
  totalDebt: Figure;
  cash: Figure;
};

/** One method applied to the subject, with its working. */
export type MethodOutput = {
  method: MethodKey;
  statistic: Statistic;
  /** The peer multiple applied. */
  multiple: number;
  /** The subject figure it was applied to. */
  subjectMetric: number;
  impliedEnterpriseValue: Figure;
  impliedEquityValue: Figure;
  /** How many peers the multiple was drawn from, for the caveat. */
  peers: number;
};

/**
 * A method that could not be applied, and why.
 *
 * Separate from MethodOutput rather than a MethodOutput with nulls in it,
 * because "we applied EV/EBITDA and got nothing" and "we could not apply
 * EV/EBITDA because the subject is loss-making at EBITDA" are different
 * sentences and the second one is the useful one.
 */
export type MethodRefusal = {
  method: MethodKey;
  reason: string;
};

/** What a weighting concluded. */
export type Conclusion = {
  applied: MethodOutput[];
  refused: MethodRefusal[];
  /** Weight per method as actually used, after any normalisation. */
  weights: Record<string, number>;
  /**
   * True when the supplied weights did not sum to 1 and were scaled. Recorded
   * rather than silently corrected: a reviewer asked to accept a weighting is
   * entitled to know it was not the weighting that was handed in.
   */
  weightsNormalised: boolean;
  low: Figure;
  high: Figure;
  weighted: Figure;
  /**
   * high / low. The single most useful number on a reconciliation screen: it is
   * how far apart the methods are, and a reader who sees 8× knows not to trust
   * the weighted average no matter how carefully it was weighted.
   */
  dispersion: Figure;
};
