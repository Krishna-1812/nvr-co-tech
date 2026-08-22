/**
 * Assembling everything one comparables screen needs, out of registry rows.
 *
 * Pure: it takes rows and gives back a view. The page does the querying, this
 * does the deciding, and the split is what lets the whole screen be tested
 * without a database — including the parts that are easiest to get wrong, which
 * are all about which row wins when a company has several.
 *
 * ── The subject is a company in the registry, for now ─────────────────────
 *
 * Which is a smaller thing than the product eventually needs — the real client is
 * usually unlisted and its figures get typed in — but it buys something a typed
 * subject cannot, and it is worth having first:
 *
 * **A listed subject has a market capitalisation, so the screen can check
 * itself.** The peers imply a value, the market has already stated one, and the
 * gap between them is a live test of the whole method. A peer set that lands
 * within a few per cent is working. One that implies half is telling you the peer
 * set is wrong, before a client does. That is the ten-company hand check made
 * continuous, and it is the reason this is the first version rather than a
 * shortcut on the way to one.
 */

import { applyMethod, isApplied, reconcile } from './conclude';
import { crore } from './format';
import { asComparables } from './multiples';
import { applyScreen, describeScreen, sizeBand, type Screen } from './screen';
import { spreadOf } from './stats';
import type {
  Basis,
  Candidate,
  Comparable,
  Conclusion,
  Figure,
  ListingStatus,
  MethodKey,
  Rejection,
  Spread,
  Statistic,
  Subject,
} from './types';

/** A `companies` row, as the page selects it. */
export type CompanyRow = {
  id: string;
  name: string;
  listing_status: string | null;
  country: string | null;
  industry: string | null;
  business_description: string | null;
  nse_symbol: string | null;
  cin: string | null;
};

/** A `company_financials` row. */
export type FinancialsRow = {
  company_id: string;
  period_end: string;
  basis: string | null;
  revenue: number | null;
  ebitda: number | null;
  ebit: number | null;
  pat: number | null;
  total_debt: number | null;
  cash: number | null;
  currency: string | null;
  source: string;
  source_url: string | null;
  as_of: string | null;
};

/** A `company_quotes` row. */
export type QuoteRow = {
  company_id: string;
  as_of: string;
  market_cap: number | null;
  currency: string | null;
  source: string;
};

const LISTING: ListingStatus[] = ['listed', 'unlisted', 'delisted', 'unknown'];

function listingOf(raw: string | null): ListingStatus {
  return LISTING.find((s) => s === raw) ?? 'unknown';
}

function basisOf(raw: string | null): Basis {
  return raw === 'standalone' ? 'standalone' : 'consolidated';
}

/**
 * Source precedence, when the same period arrives from two places.
 *
 * `company_financials` is unique on (company, period, basis, **source**), so two
 * rows for one year is the normal case rather than a fault — an exchange result
 * and an MCA filing for the same twelve months will not agree to the rupee. The
 * order is stated rather than left to whichever row the database returned first,
 * because a schedule that silently changes its mind between two page loads is
 * worse than one that is consistently using the second-best source.
 *
 * Exchange filings first: they are quarterly, so they are more current, and they
 * are consolidated, which is what a comparables schedule wants. The MCA's AOC-4
 * is more complete and roughly a year behind.
 */
const SOURCE_RANK: Record<string, number> = {
  nse: 0,
  bse: 1,
  sec_edgar: 2,
  filesure: 3,
  probe42: 4,
  mca_master: 5,
  preview: 6,
};

function rankOf(source: string): number {
  return SOURCE_RANK[source] ?? 99;
}

/**
 * The financials to use for one company: newest period, then best source, then
 * the basis the peer set asked for.
 *
 * Basis is filtered rather than ranked. Mixing standalone and consolidated inside
 * one peer set is the most common way a comparables table quietly becomes wrong
 * and cannot be spotted afterwards from the numbers alone, so a company with only
 * the wrong basis available contributes no figures at all and is rejected with a
 * reason — which is a visible gap rather than an invisible error.
 */
export function bestFinancials(rows: readonly FinancialsRow[], basis: Basis): FinancialsRow | null {
  const usable = rows.filter((r) => basisOf(r.basis) === basis);
  if (usable.length === 0) return null;

  return [...usable].sort((a, b) => {
    if (a.period_end !== b.period_end) return a.period_end < b.period_end ? 1 : -1;
    return rankOf(a.source) - rankOf(b.source);
  })[0];
}

/** The period before the one in use, for the growth column. */
export function priorFinancials(
  rows: readonly FinancialsRow[],
  basis: Basis,
  currentPeriodEnd: string,
): FinancialsRow | null {
  const earlier = rows.filter((r) => basisOf(r.basis) === basis && r.period_end < currentPeriodEnd);
  if (earlier.length === 0) return null;
  return [...earlier].sort((a, b) => (a.period_end < b.period_end ? 1 : -1))[0];
}

/** The quote to use: nearest on or before the peer set date, best source first. */
export function bestQuote(rows: readonly QuoteRow[], asOf: string): QuoteRow | null {
  const upto = rows.filter((r) => r.as_of <= asOf);
  // Nothing on or before the date is not a reason to reach forward: a market cap
  // from after the valuation date is information the valuation did not have.
  if (upto.length === 0) return null;

  return [...upto].sort((a, b) => {
    if (a.as_of !== b.as_of) return a.as_of < b.as_of ? 1 : -1;
    return rankOf(a.source) - rankOf(b.source);
  })[0];
}

/** One company's rows, turned into a candidate the engine can read. */
export function toCandidate(
  company: CompanyRow,
  financials: readonly FinancialsRow[],
  quotes: readonly QuoteRow[],
  { basis, asOf }: { basis: Basis; asOf: string },
): { candidate: Candidate } | { reason: string } {
  const current = bestFinancials(financials, basis);
  if (!current) {
    return {
      reason: `No ${basis} financials in the registry, and mixing bases inside one peer set cannot be spotted from the numbers afterwards`,
    };
  }

  const prior = priorFinancials(financials, basis, current.period_end);
  const quote = bestQuote(quotes, asOf);

  return {
    candidate: {
      companyId: company.id,
      name: company.name,
      listingStatus: listingOf(company.listing_status),
      country: company.country ?? 'IN',
      industry: company.industry,
      periodEnd: current.period_end,
      basis,
      currency: current.currency ?? 'INR',
      revenue: current.revenue,
      priorRevenue: prior?.revenue ?? null,
      ebitda: current.ebitda,
      ebit: current.ebit,
      pat: current.pat,
      totalDebt: current.total_debt,
      cash: current.cash,
      marketCap: quote?.market_cap ?? null,
      quoteAsOf: quote?.as_of ?? null,
    },
  };
}

/** One company's rows, turned into the subject. */
export function toSubject(
  company: CompanyRow,
  financials: readonly FinancialsRow[],
  { basis }: { basis: Basis },
): Subject | null {
  const current = bestFinancials(financials, basis);
  if (!current) return null;

  return {
    name: company.name,
    currency: current.currency ?? 'INR',
    periodEnd: current.period_end,
    basis,
    revenue: current.revenue,
    ebitda: current.ebitda,
    pat: current.pat,
    totalDebt: current.total_debt,
    cash: current.cash,
  };
}

/** Where the three multiples are read off a comparable. */
export const PICK: Record<MethodKey, (c: Comparable) => Figure> = {
  ev_revenue: (c) => c.multiples.evToRevenue,
  ev_ebitda: (c) => c.multiples.evToEbitda,
  pe: (c) => c.multiples.priceToEarnings,
};

export const METHOD_LABEL: Record<MethodKey, string> = {
  ev_revenue: 'EV / Revenue',
  ev_ebitda: 'EV / EBITDA',
  pe: 'P / E',
};

/**
 * Default weights.
 *
 * Equal, and equal is a choice rather than an absence of one: it says the three
 * methods are being treated as equally informative until somebody who knows the
 * company says otherwise. The screen shows the weighting and the dispersion side
 * by side so it can be argued with, which is the point — a default that hid
 * itself would be a conclusion nobody made.
 */
export const DEFAULT_WEIGHTS: Partial<Record<MethodKey, number>> = {
  ev_revenue: 1 / 3,
  ev_ebitda: 1 / 3,
  pe: 1 / 3,
};

/** Everything the screen renders. */
export type CompsView = {
  subject: Subject;
  subjectCompany: CompanyRow | null;
  /** The market's own answer, when the subject is listed. Null otherwise. */
  subjectMarketCap: Figure;
  subjectQuoteAsOf: string | null;
  comparables: Comparable[];
  rejected: Rejection[];
  spreads: Record<MethodKey, Spread>;
  conclusion: Conclusion;
  screen: Screen;
  screenNote: string;
  statistic: Statistic;
  asOf: string;
  basis: Basis;
  /** Distinct sources behind the figures on screen, for the provenance line. */
  sources: string[];
};

export type BuildInput = {
  subjectCompany: CompanyRow;
  subjectFinancials: readonly FinancialsRow[];
  subjectQuotes: readonly QuoteRow[];
  /** Every other company in the pool, with its rows. */
  pool: readonly {
    company: CompanyRow;
    financials: readonly FinancialsRow[];
    quotes: readonly QuoteRow[];
  }[];
  asOf: string;
  basis?: Basis;
  statistic?: Statistic;
  screen?: Screen;
  weights?: Partial<Record<MethodKey, number>>;
};

/**
 * Build the view.
 *
 * The size band is derived from the subject's own revenue when the caller has not
 * asked for one — a third to three times, which is the convention in practice —
 * and it is applied rather than merely displayed. A peer set of every company in
 * the industry is not a peer set.
 */
export function buildCompsView(input: BuildInput): CompsView | null {
  const basis = input.basis ?? 'consolidated';
  const statistic = input.statistic ?? 'median';

  const subject = toSubject(input.subjectCompany, input.subjectFinancials, { basis });
  if (!subject) return null;

  const screen: Screen =
    input.screen ??
    ({
      country: input.subjectCompany.country ?? 'IN',
      excludeCompanyId: input.subjectCompany.id,
      ...(subject.revenue !== null ? sizeBand(subject.revenue) : {}),
    } satisfies Screen);

  const candidates: Candidate[] = [];
  const rejected: Rejection[] = [];

  for (const entry of input.pool) {
    const outcome = toCandidate(entry.company, entry.financials, entry.quotes, { basis, asOf: input.asOf });
    if ('reason' in outcome) {
      rejected.push({
        // A company with no usable figures still has to appear somewhere, or the
        // set silently shrinks and nobody can tell whether it was screened out
        // or never found.
        candidate: {
          companyId: entry.company.id,
          name: entry.company.name,
          listingStatus: listingOf(entry.company.listing_status),
          country: entry.company.country ?? 'IN',
          industry: entry.company.industry,
          periodEnd: null,
          basis,
          currency: 'INR',
          revenue: null,
          ebitda: null,
          pat: null,
          totalDebt: null,
          cash: null,
          marketCap: null,
        },
        reason: outcome.reason,
        decidedBy: 'screen',
      });
      continue;
    }
    candidates.push(outcome.candidate);
  }

  const screened = applyScreen(candidates, screen);
  rejected.push(...screened.rejected);

  const comparables = asComparables(screened.kept);

  const spreads = {
    ev_revenue: spreadOf(comparables, PICK.ev_revenue),
    ev_ebitda: spreadOf(comparables, PICK.ev_ebitda),
    pe: spreadOf(comparables, PICK.pe),
  } satisfies Record<MethodKey, Spread>;

  const results = (Object.keys(spreads) as MethodKey[]).map((method) =>
    applyMethod(method, spreads[method], statistic, subject),
  );
  const conclusion = reconcile(results, input.weights ?? DEFAULT_WEIGHTS);

  const subjectQuote = bestQuote(input.subjectQuotes, input.asOf);

  const sources = new Set<string>();
  for (const entry of input.pool) {
    for (const f of entry.financials) sources.add(f.source);
    for (const q of entry.quotes) sources.add(q.source);
  }

  return {
    subject,
    subjectCompany: input.subjectCompany,
    subjectMarketCap: subjectQuote?.market_cap ?? null,
    subjectQuoteAsOf: subjectQuote?.as_of ?? null,
    comparables,
    rejected,
    spreads,
    conclusion,
    screen,
    // Rupees are what is stored; crore is what an Indian finance team reads.
    screenNote: describeScreen(screen, { money: (n) => crore(n, { symbol: false }) }),
    statistic,
    asOf: input.asOf,
    basis,
    sources: [...sources].sort(),
  };
}

/** How many methods actually ran, for the caveat line. */
export function appliedCount(conclusion: Conclusion): number {
  return conclusion.applied.filter(isApplied).length;
}
