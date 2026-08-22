/**
 * SEC EDGAR, via the free XBRL `companyfacts` API.
 *
 * The best free financial dataset in the world and it is not close: every
 * XBRL-tagged fact from every filing by every US registrant, one request per
 * company, no API key, and a nightly `companyfacts.zip` if you would rather have
 * all of it at once. India is this tool's primary market and this is secondary,
 * but it is the source that costs nothing and needs no negotiation, so it is the
 * one to build against first — including for confidence in the pipeline itself.
 *
 * Two rules EDGAR states rather than merely enforcing, both in `EDGAR`'s
 * politeness block at the foot of this file: **ten requests a second across all
 * its domains**, and a `User-Agent` naming a real contact. Without the header it
 * answers 403; over the rate it blocks the address.
 *
 * ── Four things make this harder than it looks ────────────────────────────
 *
 * **One: there is no single revenue tag.** A registrant may report `Revenues`,
 * or `RevenueFromContractWithCustomerExcludingAssessedTax`, or `SalesRevenueNet`
 * — and the same company changes tag between years as the taxonomy moves. So
 * every figure is looked up through an ordered preference list and the first tag
 * that has a usable fact wins. `revenueTagUsed` comes back on the record so a
 * reviewer can see which one it was, because a company that switched tags
 * mid-history will show a discontinuity that is a taxonomy artefact rather than a
 * business event.
 *
 * **Two: quarterly and annual facts sit in the same array.** Nothing in the JSON
 * says "this is the year" — you have to read it off the duration and the form.
 * Taking facts blindly gets you a quarter presented as a year, which understates
 * revenue by roughly three quarters and produces a multiple four times too high.
 * `isAnnual` is where that is decided and it is the most consequential function
 * in the file.
 *
 * **Three: the same period appears more than once.** A 10-K states FY2024, the
 * next 10-K restates it as a comparative, an amended filing restates it again.
 * All three are in the array with different `accn` and `filed` values. The latest
 * `filed` wins, because a restatement is the same source saying something truer
 * about the same period — which is also why `record_financials` in migration 0028
 * replaces on conflict rather than merging.
 *
 * **Four: EBITDA is not an XBRL tag.** It is not in the taxonomy because it is
 * not a GAAP measure. It is derived here as operating income plus depreciation and
 * amortisation, and it is **null when either part is missing** — never operating
 * income on its own quietly relabelled. A peer whose EBITDA is unknown drops out
 * of the EV/EBITDA column and stays in EV/Revenue, which is the honest outcome and
 * exactly what the null-means-unknown rule in `types.ts` is for.
 */

import type { CompanyRecord, FinancialsRecord, Harvest, Skip } from './types';
import { emptyHarvest } from './types';

const SOURCE = 'sec_edgar' as const;

/** One company's facts. Ten-digit zero-padded CIK. */
export function companyFactsUrl(cik: string): string {
  return `https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`;
}

/** EDGAR wants the CIK zero-padded to ten digits in a URL, bare elsewhere. */
export function padCik(cik: string): string {
  return cik.replace(/\D/g, '').padStart(10, '0');
}

/** And bare, without the padding, for storage — so it joins to other sources. */
export function bareCik(cik: string): string {
  const digits = cik.replace(/\D/g, '').replace(/^0+/, '');
  return digits === '' ? '0' : digits;
}

/**
 * One XBRL fact as EDGAR returns it.
 *
 * `start` is absent on an instant fact — a balance-sheet item is true at a moment,
 * not over a period — and that absence is how the two kinds are told apart.
 */
export type Fact = {
  start?: string;
  end: string;
  val: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
};

/** Ordered preference lists. First tag with a usable fact wins. */
export const TAGS = {
  revenue: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'SalesRevenueNet',
    'SalesRevenueGoodsNet',
  ],
  pat: ['NetIncomeLoss', 'ProfitLoss'],
  ebit: ['OperatingIncomeLoss'],
  depreciation: [
    'DepreciationDepletionAndAmortization',
    'DepreciationAndAmortization',
    'DepreciationAmortizationAndAccretionNet',
  ],
  totalAssets: ['Assets'],
  netWorth: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  /**
   * Debt is the weakest of these and the list is short on purpose.
   *
   * There is no reliable single tag for total borrowings: registrants split it
   * across current and non-current, sometimes tag only one, and frequently tag
   * neither at the top level. Rather than assembling a plausible total out of
   * whatever happens to be present — which would understate leverage silently and
   * inflate every equity value derived through the bridge — this looks for the
   * combined tag only, and leaves debt null when it is absent. A blank debt cell
   * on the schedule is a question a reader can ask. A wrong one is not.
   */
  debt: ['DebtLongtermAndShorttermCombinedAmount'],
} as const;

/** Forms whose facts describe a full year. */
const ANNUAL_FORMS = ['10-K', '20-F', '40-F'];

/**
 * Whether a duration fact covers a financial year.
 *
 * Both halves are needed. The duration alone lets a four-quarter cumulative
 * figure from a 10-Q through; the form alone lets a quarterly column inside a
 * 10-K through. Together they are the two independent signals EDGAR gives, and
 * requiring both is what keeps a quarter from being presented as a year.
 *
 * Eleven to thirteen months rather than exactly twelve, because a 52/53-week
 * retailer's year ends on a moving Saturday and can run 371 days.
 */
export function isAnnual(fact: Fact): boolean {
  if (!fact.start || !fact.end) return false;
  const months = monthsBetween(fact.start, fact.end);
  if (months === null || months < 11 || months > 13) return false;
  if (!fact.form) return false;
  return ANNUAL_FORMS.some((f) => fact.form?.startsWith(f));
}

/** Whole months between two ISO dates, or null if either is unreadable. */
export function monthsBetween(startIso: string, endIso: string): number | null {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.4375));
}

/** An instant fact: true at a date, with no period. */
export function isInstant(fact: Fact): boolean {
  return !fact.start && Boolean(fact.end);
}

// ─── Reading the JSON without trusting it ─────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFacts(value: unknown): Fact[] {
  if (!Array.isArray(value)) return [];
  const out: Fact[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const end = item.end;
    const val = item.val;
    if (typeof end !== 'string' || typeof val !== 'number' || !Number.isFinite(val)) continue;
    out.push({
      end,
      val,
      start: typeof item.start === 'string' ? item.start : undefined,
      accn: typeof item.accn === 'string' ? item.accn : undefined,
      fy: typeof item.fy === 'number' ? item.fy : undefined,
      fp: typeof item.fp === 'string' ? item.fp : undefined,
      form: typeof item.form === 'string' ? item.form : undefined,
      filed: typeof item.filed === 'string' ? item.filed : undefined,
      frame: typeof item.frame === 'string' ? item.frame : undefined,
    });
  }
  return out;
}

/**
 * The facts for one tag, and the currency they are in.
 *
 * `units` is keyed by unit — `USD`, `EUR`, `shares`, `USD/shares`. Only a bare
 * three-letter currency is taken: a per-share figure is a different measure and
 * `shares` is not money at all, and either would produce a multiple out by the
 * share count if it slipped through.
 */
export function factsForTag(
  taxonomy: unknown,
  tag: string,
): { facts: Fact[]; currency: string } | null {
  if (!isRecord(taxonomy)) return null;
  const entry = taxonomy[tag];
  if (!isRecord(entry)) return null;
  const units = entry.units;
  if (!isRecord(units)) return null;

  for (const [unit, value] of Object.entries(units)) {
    if (!/^[A-Z]{3}$/.test(unit)) continue;
    const facts = asFacts(value);
    if (facts.length > 0) return { facts, currency: unit };
  }
  return null;
}

/**
 * The most recently filed fact for a period end, out of a list.
 *
 * A restatement is the same source saying something truer about the same period,
 * so the latest filing wins. Ties break on `accn` so the result is stable rather
 * than depending on array order — two facts filed the same day with the same
 * period is rare and it does happen, and a figure that changes between two runs
 * of the same ingest is the sort of thing nobody ever manages to reproduce.
 */
export function latestFiled(facts: readonly Fact[]): Fact | null {
  let best: Fact | null = null;
  for (const fact of facts) {
    if (!best) {
      best = fact;
      continue;
    }
    const a = fact.filed ?? '';
    const b = best.filed ?? '';
    if (a > b || (a === b && (fact.accn ?? '') > (best.accn ?? ''))) best = fact;
  }
  return best;
}

/** Every annual period end this company has reported, newest first. */
export function annualPeriodEnds(taxonomy: unknown, tags: readonly string[]): string[] {
  const ends = new Set<string>();
  for (const tag of tags) {
    const found = factsForTag(taxonomy, tag);
    if (!found) continue;
    for (const fact of found.facts) {
      if (isAnnual(fact)) ends.add(fact.end);
    }
  }
  return [...ends].sort().reverse();
}

/** The annual value of a tag for one period end, latest filing winning. */
function annualValue(
  taxonomy: unknown,
  tags: readonly string[],
  periodEnd: string,
): { value: number; tag: string; currency: string; fact: Fact } | null {
  for (const tag of tags) {
    const found = factsForTag(taxonomy, tag);
    if (!found) continue;
    const candidates = found.facts.filter((f) => f.end === periodEnd && isAnnual(f));
    const fact = latestFiled(candidates);
    if (fact) return { value: fact.val, tag, currency: found.currency, fact };
  }
  return null;
}

/**
 * The instant value of a tag at a date, latest filing winning.
 *
 * Matched on the exact date rather than the nearest, deliberately. A balance sheet
 * three days either side of the year end is a different balance sheet, and
 * accepting the nearest one would silently pair a year's revenue with a quarter's
 * cash. Where the dates do not line up the figure is simply not known, which the
 * null says.
 */
function instantValue(
  taxonomy: unknown,
  tags: readonly string[],
  at: string,
): { value: number; currency: string } | null {
  for (const tag of tags) {
    const found = factsForTag(taxonomy, tag);
    if (!found) continue;
    const candidates = found.facts.filter((f) => isInstant(f) && f.end === at);
    const fact = latestFiled(candidates);
    if (fact) return { value: fact.val, currency: found.currency };
  }
  return null;
}

/** A financials record with the extra provenance EDGAR can supply. */
export type EdgarFinancials = FinancialsRecord & {
  /** Which revenue tag was used, so a tag switch shows up as a tag switch. */
  revenueTagUsed?: string | null;
};

/** What `parseCompanyFacts` produces. */
export type EdgarHarvest = Harvest & { financials: EdgarFinancials[] };

/**
 * Turn one `companyfacts` response into a company and its annual history.
 *
 * `years` caps how far back to go. Ten is plenty for a comparables schedule and
 * a large registrant's response is several megabytes covering two decades, most
 * of which nobody will look at.
 */
export function parseCompanyFacts(
  json: unknown,
  { years = 10 }: { years?: number } = {},
): EdgarHarvest {
  const harvest: EdgarHarvest = { ...emptyHarvest(), financials: [] };

  if (!isRecord(json)) {
    harvest.skipped.push({ at: 'response', reason: 'Response was not a JSON object' });
    return harvest;
  }

  const cikRaw = json.cik;
  const cik = typeof cikRaw === 'number' ? String(cikRaw) : typeof cikRaw === 'string' ? cikRaw : null;
  const name = typeof json.entityName === 'string' ? json.entityName.trim() : '';

  if (!cik || name === '') {
    harvest.skipped.push({ at: 'response', reason: 'Response had no cik or no entityName' });
    return harvest;
  }

  const at = bareCik(cik);
  const facts = json.facts;
  if (!isRecord(facts)) {
    harvest.skipped.push({ at, reason: 'Response had no facts object' });
    return harvest;
  }

  const taxonomy = facts['us-gaap'] ?? facts['ifrs-full'];
  if (!isRecord(taxonomy)) {
    harvest.skipped.push({ at, reason: 'No us-gaap or ifrs-full taxonomy in the response' });
    return harvest;
  }

  const company: CompanyRecord = {
    name,
    cik: at,
    country: 'US',
    // Filing with the SEC is not the same as being listed — a registrant may
    // have only registered debt. So this is left unknown rather than assumed,
    // and a quote from a market source is what settles it.
    listing_status: 'unknown',
    source: SOURCE,
    source_url: companyFactsUrl(at),
  };
  harvest.companies.push(company);

  const ends = annualPeriodEnds(taxonomy, TAGS.revenue).slice(0, Math.max(years, 1));
  if (ends.length === 0) {
    harvest.skipped.push({
      at,
      reason: `No annual revenue fact found under any of: ${TAGS.revenue.join(', ')}`,
    });
    return harvest;
  }

  for (const periodEnd of ends) {
    const revenue = annualValue(taxonomy, TAGS.revenue, periodEnd);
    if (!revenue) continue;

    const ebit = annualValue(taxonomy, TAGS.ebit, periodEnd);
    const dep = annualValue(taxonomy, TAGS.depreciation, periodEnd);
    const pat = annualValue(taxonomy, TAGS.pat, periodEnd);

    // EBITDA is derived and null unless BOTH parts are present. Operating income
    // relabelled as EBITDA would understate every EV/EBITDA multiple built on it.
    const ebitda = ebit && dep ? ebit.value + dep.value : null;

    const assets = instantValue(taxonomy, TAGS.totalAssets, periodEnd);
    const equity = instantValue(taxonomy, TAGS.netWorth, periodEnd);
    const cash = instantValue(taxonomy, TAGS.cash, periodEnd);
    const debt = instantValue(taxonomy, TAGS.debt, periodEnd);

    harvest.financials.push({
      match: { by: 'cik', value: at },
      period_start: revenue.fact.start ?? null,
      period_end: periodEnd,
      fy_label: revenue.fact.fy ? String(revenue.fact.fy) : null,
      months: revenue.fact.start ? monthsBetween(revenue.fact.start, periodEnd) : null,
      // EDGAR's primary statements are consolidated. A registrant with
      // subsidiaries files consolidated accounts and there is no standalone
      // column to confuse it with, unlike an Indian AOC-4.
      basis: 'consolidated',
      revenue: revenue.value,
      ebit: ebit ? ebit.value : null,
      ebitda,
      pat: pat ? pat.value : null,
      total_assets: assets ? assets.value : null,
      net_worth: equity ? equity.value : null,
      total_debt: debt ? debt.value : null,
      cash: cash ? cash.value : null,
      currency: revenue.currency,
      is_audited: true,
      source: SOURCE,
      source_url: companyFactsUrl(at),
      as_of: revenue.fact.filed ?? null,
      revenueTagUsed: revenue.tag,
    });
  }

  return harvest;
}

/**
 * Fetch and parse one company.
 *
 * The whole of the network handling, and there is deliberately almost nothing in
 * it: a URL, a header, and a status check. Everything with a decision in it is
 * above this line and tested without a network.
 */
export async function fetchCompanyFacts(
  fetcher: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
  cik: string,
  userAgent: string,
): Promise<EdgarHarvest> {
  const url = companyFactsUrl(cik);
  const response = await fetcher(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });

  if (!response.ok) {
    const harvest: EdgarHarvest = { ...emptyHarvest(), financials: [] };
    const skip: Skip = {
      at: bareCik(cik),
      reason:
        response.status === 403
          ? 'EDGAR answered 403. It requires a User-Agent naming a real contact.'
          : `EDGAR answered ${response.status}`,
    };
    harvest.skipped.push(skip);
    return harvest;
  }

  return parseCompanyFacts(await response.json());
}

export const EDGAR = {
  id: SOURCE,
  label: 'SEC EDGAR XBRL companyfacts',
  politeness: {
    // Both stated policy rather than observed behaviour. Ten per second is the
    // published ceiling across all EDGAR domains; the User-Agent is required and
    // its absence is answered with 403 rather than with an explanation.
    requestsPerSecond: 10,
    userAgent: 'The Finance Intelligence team@thefinanceintelligence.com',
  },
} as const;
