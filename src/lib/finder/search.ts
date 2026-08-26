import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { searchCompanies, searchPeople } from './apollo/client';
import type { CompanyFilters, PeopleFilters, SearchMeta, SearchPerson } from './apollo/types';
import { attachEmployerFacts, type EmployerStats } from './employer';
import { resolveCompanyName, isDomainShaped, type Choice } from './resolve';
import { companyRow, withDerivedRole } from './rows';
import { learnFrom, newSpend, recordSpend } from './store';
import { verifyRows, VERIFY_LABELS, type VerifyFilters } from './verify';
import { hint as codeHint, splitValid } from './vocab/codes';

/**
 * The grid search: the most defensive function in the tool.
 *
 * Everything here is in service of one distinction. Apollo not answering, and
 * Apollo answering with nothing, are different facts about the world, and this
 * screen once drew them identically — "No matches. Try widening the filters",
 * which is advice that cannot help, about a search that never ran.
 *
 * The rest is the same idea applied to filters rather than to failure: rows
 * Apollo returned that do not actually satisfy what was asked for are removed
 * rather than shown, and the response says how many and why. No page ever
 * silently shrinks, and a filter that is quietly doing nothing shows up as a
 * reason that never appears.
 */

/** One page. Small enough to read, large enough to compare across. */
const PER_PAGE = 24;

/**
 * Every numeric range filter, coerced.
 *
 * The shipped panel only ever sends real numbers, so this changes nothing
 * there. But this pipeline has no schema validation, and a non-numeric value
 * reaching the range checks or the bucket mapping threw deep enough that the
 * catch below reported it as "Apollo did not answer this search. Try again in a
 * moment": a validation bug dressed up as a transient outage, and worst on a
 * request that will fail identically every time it is retried.
 */
const NUMERIC_KEYS = [
  'employee_min', 'employee_max', 'revenue_min', 'revenue_max',
  'founded_min', 'founded_max', 'num_jobs_min', 'num_jobs_max',
  'headcount_growth_min', 'headcount_growth_max', 'headcount_growth_months',
  'yoe_min', 'yoe_max', 'days_in_title_min', 'days_in_title_max',
  'total_funding_min', 'total_funding_max', 'latest_funding_min', 'latest_funding_max',
] as const;

export function intOrNone(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number.parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Filters describing the EMPLOYER, none of which can be honoured without the
 * employer's own record — which the free people search does not carry.
 */
const NEEDS_EMPLOYER = [
  'industries', 'employee_min', 'employee_max', 'revenue_min', 'revenue_max',
  'company_locations', 'technologies', 'technologies_all', 'exclude_technologies',
] as const;

export type SearchRequest = {
  entity: 'people' | 'companies';
  page: number;
  filters: Record<string, unknown>;
};

export type SearchResponse = {
  results: Record<string, unknown>[];
  has_more: boolean;
  total?: number | null;
  page?: number;
  search_failed?: true;
  error?: string;
  needs_company_choice?: true;
  choices?: Choice[];
  resolved_company?: (string | null)[];
  companies_described?: EmployerStats;
  company_unconfirmed?: number;
  company_detail?: boolean;
  industry_forced_company_detail?: true;
  rejected?: Record<string, number>;
  rejected_total?: number;
  rejected_labels?: Record<string, string>;
  invalid_codes?: Record<string, { codes: string[]; hint: string }>;
  funding_value_clamped?: true;
  credits?: number;
};

export function readRequest(body: unknown): SearchRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const raw = (b.filters ?? {}) as Record<string, unknown>;

  // `entity` is "companies" only on an exact match; anything else is people.
  const entity = b.entity === 'companies' ? 'companies' : 'people';

  const page = Math.max(1, Math.min(intOrNone(b.page) ?? 1, 500));
  return { entity, page, filters: { ...raw } };
}

export async function runSearch(
  supabase: SupabaseClient<Database>,
  apiKey: string,
  request: SearchRequest,
): Promise<SearchResponse> {
  const { entity, page } = request;
  const filters: Record<string, unknown> = { ...request.filters };

  /*
   * Popped, not read. Everything left in `filters` goes on to build an Apollo
   * payload, and a key Apollo does not know is a key some future filter loop
   * could pass through by accident. Absent means on: the thin card is what
   * turning it on replaced.
   */
  const detailAsked = filters.company_detail !== false;
  delete filters.company_detail;

  for (const key of NUMERIC_KEYS) {
    if (key in filters && filters[key] !== null) filters[key] = intOrNone(filters[key]);
  }

  /*
   * NAICS and SIC are the two filters with a shape Apollo enforces. Official
   * NAICS codes are SIX digits, so pasting one from any government source is
   * rejected outright — previously without a word to anybody, who saw an empty
   * page and read it as "no such companies".
   */
  const badCodes: Record<string, { codes: string[]; hint: string }> = {};
  for (const [key, kind] of [
    ['naics_codes', 'naics'],
    ['exclude_naics_codes', 'naics'],
    ['sic_codes', 'sic'],
    ['exclude_sic_codes', 'sic'],
  ] as const) {
    const value = filters[key];
    if (!Array.isArray(value) || value.length === 0) continue;
    const [good, bad] = splitValid(kind, value as string[]);
    if (bad.length > 0) {
      badCodes[kind] ??= { codes: [], hint: codeHint(kind) };
      badCodes[kind].codes.push(...bad);
    }
    if (good.length > 0) filters[key] = good;
    else delete filters[key];
  }

  /*
   * Asking for an employer-level filter AND no company detail is a
   * contradiction. The filter that was typed wins, the lookup runs, and the
   * response says it was turned back on rather than silently answering a
   * different question.
   */
  const wantsEmployer = NEEDS_EMPLOYER.some((k) => {
    const v = filters[k];
    return v != null && !(Array.isArray(v) && v.length === 0);
  });
  const industryForced = entity === 'people' && wantsEmployer && !detailAsked;
  const companyDetail = detailAsked || industryForced;

  const meta: SearchMeta = {};
  const spend = newSpend();
  let resolvedNames: (string | null)[] | null = null;

  // ── Resolve a typed company NAME ──────────────────────────────────────────
  if (entity === 'people') {
    const rawDomains = (filters.company_domains as string[] | undefined) ?? [];
    const typed = rawDomains.length === 1 ? String(rawDomains[0] ?? '').trim() : '';

    if (typed && !isDomainShaped(typed)) {
      let resolution;
      try {
        resolution = await resolveCompanyName(supabase, typed, apiKey, spend);
      } catch (error) {
        console.warn(
          `finder: company-name resolve failed: ${error instanceof Error ? error.message : 'unknown'}`,
        );
        return {
          results: [],
          has_more: false,
          search_failed: true,
          error: `Apollo did not answer while looking up "${typed}". Try again in a moment.`,
        };
      }

      if (!resolution.found) {
        return { results: [], has_more: false, error: `No company found matching "${typed}".` };
      }

      if (resolution.choices) {
        // Never guess between distinct companies, and never OR across all of
        // them. Hand the candidates back and run for exactly the one picked.
        const out: SearchResponse = {
          results: [],
          has_more: false,
          needs_company_choice: true,
          choices: resolution.choices,
        };
        if (spend.credits) {
          out.credits = spend.credits;
          await recordSpend(supabase, 'company-resolve', spend.credits);
        }
        return out;
      }

      delete filters.company_domains;
      filters.organization_ids = [
        ...new Set([...((filters.organization_ids as string[]) ?? []), resolution.orgId]),
      ];
      resolvedNames = [resolution.orgName];
    }
  }

  let results: Record<string, unknown>[] = [];
  let firmo: EmployerStats | null = null;
  let verifyDropped: Record<string, number> = {};
  let employerUnavailable = 0;
  /*
   * The real count of rows the verify pass removed, independent of how its own
   * reasons tally. A row failing two checks is counted under both there, so
   * only an actual before/after row count gives an honest total.
   */
  let verifyDroppedRows = 0;

  try {
    if (entity === 'people') {
      // strict, because the default swallows a transport failure into an empty
      // list which this route would then serve as a fact about the world.
      const people = await searchPeople(filters as PeopleFilters, apiKey, {
        page,
        perPage: PER_PAGE,
        meta,
        strict: true,
      });

      if (companyDetail) firmo = await attachEmployerFacts(supabase, people, apiKey, spend);

      // Outside the toggle on purpose: reading a title costs nothing, so
      // turning off the paid company lookup must not also throw away the free
      // classification that comes with every row.
      const withRole = people.map((p) => withDerivedRole(p as Record<string, unknown>));

      const verified = verifyRows(withRole, filters as VerifyFilters, true);
      results = verified.kept;
      verifyDropped = verified.dropped;
      employerUnavailable = verified.employerUnavailable;
      verifyDroppedRows = withRole.length - results.length;
    } else {
      const raw = await searchCompanies(filters as CompanyFilters, apiKey, {
        page,
        perPage: PER_PAGE,
        meta,
        strict: true,
      });

      /*
       * Bills one credit per call returning at least one row — and that is
       * APOLLO'S row count, taken before our own checks removed any. A search
       * that returned twenty companies and kept none of them still cost a
       * credit, and counting the survivors made exactly that case look free.
       * Counted at the call site, like every other caller, rather than inferred
       * later from what came back.
       */
      if ((meta.returned ?? raw.length) > 0) spend.credits += 1;
      await learnFrom(supabase, raw);

      const rows = raw.map(companyRow);
      // The industry was already enforced inside searchCompanies; this adds the
      // size, revenue, HQ and technology checks and reports all of them from one
      // place, so the two tabs cannot disagree about the same company.
      const verified = verifyRows(rows, filters as VerifyFilters, false);
      results = verified.kept;
      verifyDropped = verified.dropped;
      verifyDroppedRows = rows.length - results.length;
    }
  } catch (error) {
    console.warn(
      `finder: search failed (entity=${entity}): ${error instanceof Error ? error.message : 'unknown'}`,
    );
    const out: SearchResponse = {
      results: [],
      has_more: false,
      search_failed: true,
      error:
        'Apollo did not answer this search, so nothing was found and nothing was ruled out. Try again in a moment.',
    };
    /*
     * A typed company NAME can already have spent a real credit resolving to an
     * organisation id before the people search that follows it failed. That
     * spend happened and this request failing cannot undo it — reporting
     * nothing here left it permanently missing from both the response and the
     * ledger, breaking the one guarantee the ledger makes.
     */
    if (spend.credits) {
      out.credits = spend.credits;
      await recordSpend(supabase, `search-${entity}`, spend.credits);
    }
    return out;
  }

  /*
   * Prefer Apollo's own page count. `results.length === perPage` both over- and
   * under-reports on the last page. Where the page count is unavailable, fall
   * back to how many rows APOLLO served — never to how many survived our own
   * checks, which is what hid "Load more" the moment any row was removed and
   * stranded a reader on 23 of a company's 355 people.
   */
  const served = meta.returned ?? results.length;
  const hasMore = meta.total_pages ? page < meta.total_pages : served >= PER_PAGE;

  const out: SearchResponse = {
    results,
    has_more: Boolean(hasMore),
    total: meta.total_entries ?? null,
    page,
  };

  if (resolvedNames) out.resolved_company = resolvedNames;

  // Says how the company detail on these rows was obtained, so a page that cost
  // a credit and a page served entirely from cache are told apart on screen
  // rather than both silently claiming to be free.
  if (firmo && firmo.orgs > 0) out.companies_described = firmo;

  /*
   * Not a rejection: these rows are IN the results, each carrying its own flag.
   * But the count belongs on the response, so the header can say Apollo did not
   * confirm every row rather than implying the lookup verified them all.
   */
  const unconfirmed =
    (meta.company_unconfirmed ?? 0) + employerUnavailable || (meta.domain_unconfirmed ?? 0);
  if (unconfirmed) out.company_unconfirmed = unconfirmed;

  if (entity === 'people') {
    // Echoed back so the results header describes the rows it is actually
    // showing, rather than the state of a checkbox that may have been flipped
    // since. Only meaningful for people: the Companies tab pays for full
    // records either way and has nothing to switch off.
    out.company_detail = companyDetail;
    if (industryForced) out.industry_forced_company_detail = true;
  }

  // ── The rejection report ──────────────────────────────────────────────────
  const rejected: Record<string, number> = { ...verifyDropped };
  const add = (key: string, n: number | undefined) => {
    if (n) rejected[key] = (rejected[key] ?? 0) + n;
  };
  // Each of these removed its rows before the shared verify pass ever saw them.
  add('industry', meta.industry_dropped);
  add('company', meta.company_dropped);
  add('domain', meta.domain_dropped);
  add('excluded_keyword', meta.exclude_keywords_dropped);

  if (Object.keys(rejected).length > 0) {
    out.rejected = rejected;
    /*
     * NOT the sum of the reasons. The verify pass tallies a row under EVERY
     * reason it fails, so a row that is both the wrong industry and undersized
     * appears in both and summing would count it twice. `verifyDroppedRows` is
     * the real row-count drop; the meta-sourced counts are each already exactly
     * one-to-one with a removed row, because each stage removes a row from
     * contention before the next one sees it.
     */
    out.rejected_total =
      verifyDroppedRows +
      (meta.industry_dropped ?? 0) +
      (meta.company_dropped ?? 0) +
      (meta.domain_dropped ?? 0) +
      (meta.exclude_keywords_dropped ?? 0);
    out.rejected_labels = Object.fromEntries(
      Object.keys(rejected).map((k) => [k, VERIFY_LABELS[k] ?? k]),
    );
    // Apollo's own total counted its looser match, so it overstates the real
    // number by whatever proportion this page just removed.
    out.total = null;
  }

  // Reported whatever else happened, including on an otherwise good page,
  // because the search that ran was not the search that was asked for.
  if (Object.keys(badCodes).length > 0) out.invalid_codes = badCodes;
  if (meta.funding_value_clamped?.length) out.funding_value_clamped = true;

  if (spend.credits) {
    out.credits = spend.credits;
    await recordSpend(supabase, `search-${entity}`, spend.credits);
  }

  return out;
}

/**
 * The filters that make Apollo's own count an upper bound rather than a figure.
 *
 * Each is re-checked in code afterwards, so the page will show this many rows
 * or fewer. Saying "2,400 matches" when the page will show 300 is exactly the
 * kind of claim this tool exists not to make.
 */
export const COUNT_VERIFIED_FILTERS = [
  'industries', 'employee_min', 'employee_max', 'revenue_min', 'revenue_max',
  'company_locations', 'technologies', 'technologies_all', 'titles', 'company_domains',
] as const;

export type CountResponse = { count: number | null; approx?: boolean; reason?: string };

/**
 * How many people match, before anybody spends anything.
 *
 * Apollo's people search is free and reports its own total, so the size of a
 * result can be shown while the filters are still being set. This endpoint
 * refuses all three things that could cost money, each with a reason rather
 * than a silent null:
 *
 *  - the Companies tab outright, because that search bills per call and a count
 *    that updated while somebody typed would spend one per keystroke
 *  - the employer lookup, popped and never forwarded
 *  - resolving a typed company NAME, which is a paid company search
 */
export async function runCount(
  apiKey: string,
  entity: string,
  rawFilters: Record<string, unknown>,
): Promise<CountResponse> {
  if (entity === 'companies') {
    return {
      count: null,
      reason: 'Company search costs a credit per run, so there is no free way to preview the count.',
    };
  }

  const filters: Record<string, unknown> = { ...rawFilters };
  delete filters.company_detail;

  const domains = (filters.company_domains as string[] | undefined) ?? [];
  if (domains.length === 1 && !isDomainShaped(String(domains[0] ?? ''))) {
    return {
      count: null,
      reason: 'Looking up a company by name costs a credit, so the count waits until you search.',
    };
  }

  for (const key of NUMERIC_KEYS) {
    if (key in filters && filters[key] !== null) filters[key] = intOrNone(filters[key]);
  }
  for (const [key, kind] of [
    ['naics_codes', 'naics'],
    ['exclude_naics_codes', 'naics'],
    ['sic_codes', 'sic'],
    ['exclude_sic_codes', 'sic'],
  ] as const) {
    const value = filters[key];
    if (!Array.isArray(value) || value.length === 0) continue;
    const [good] = splitValid(kind, value as string[]);
    if (good.length > 0) filters[key] = good;
    else delete filters[key];
  }

  const meta: SearchMeta = {};
  try {
    // One row, because the count is in the pagination envelope rather than in
    // the rows: asking for a full page would be paying attention we do not need.
    await searchPeople(filters as PeopleFilters, apiKey, { perPage: 1, meta, strict: true });
  } catch {
    return { count: null, reason: 'Could not reach Apollo.' };
  }

  if (meta.total_entries == null) {
    return { count: null, reason: 'Apollo does not report a total for this filter set.' };
  }

  const approx = COUNT_VERIFIED_FILTERS.some((k) => {
    const v = (rawFilters as Record<string, unknown>)[k];
    return v != null && !(Array.isArray(v) && v.length === 0);
  });

  return { count: meta.total_entries, approx };
}

/** Casting a person row for the callers that need the Apollo shape back. */
export type { SearchPerson };
