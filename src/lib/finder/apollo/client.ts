import { expand as expandIndustries, norm as normIndustry } from '../vocab/industries';
import type {
  ApolloRecord,
  CompanyFilters,
  OrgFilters,
  PeopleFilters,
  SearchMeta,
  SearchPerson,
} from './types';

/**
 * The only file that talks to Apollo.
 *
 * Rule: **data fetching only, no business logic.** It knows how to reach Apollo
 * and how to enforce the filters Apollo lies about. It knows nothing about
 * credits, users, caches or the interface.
 *
 * ── The single idea the whole file is built around ─────────────────────────
 *
 * Apollo exposes many parameters that look like filters and behave as relevance
 * hints. Ask for `industry = Healthcare` and you get a venture-capital firm, a
 * meditation app and a compliance vendor, because the parameter is a free-text
 * match over a company's name and keyword tags. Ask for 100 to 2000 employees
 * and you get companies with 51, because Apollo filters on overlapping buckets.
 * So this file asks Apollo broadly, then guarantees the answer itself, and
 * reports every row it removed through the `meta` out-parameter.
 *
 * ── The second idea, which is about failure ────────────────────────────────
 *
 * "We could not look" and "there is nothing there" must never share a code path.
 * A transport failure, a rate limit and a genuinely empty result are three
 * different facts, and only one of them is about the world. `strict` is how a
 * caller says that an empty answer from this function will be shown to a person
 * as an absence, and therefore that a failure must not be allowed to look like
 * one.
 */

/**
 * Apollo serves the same API under both of these, and which one answers has
 * varied by endpoint and over time. The documented prefix is tried first; a
 * wrong prefix fails as a 404, which looks exactly like "no data", so the fall
 * back is not optional.
 */
const BASE_URLS = ['https://api.apollo.io/api/v1', 'https://api.apollo.io/v1'] as const;

/**
 * The prefix proven to work, remembered for the life of the process.
 *
 * Module-scoped rather than per-call, so the probe is paid once. On a serverless
 * host that means once per warm instance, which is still most requests.
 */
let baseOk: string | null = null;

const TIMEOUT_MS = 30_000;
const RETRIES = 3;

/** A failure that came from Apollo, or from not reaching Apollo. Never "no data". */
export class ApolloFailure extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApolloFailure';
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function basesToTry(): readonly string[] {
  if (baseOk) return [baseOk, ...BASE_URLS.filter((b) => b !== baseOk)];
  return BASE_URLS;
}

/**
 * One POST to Apollo, with the base-URL fall back and the retry policy.
 *
 * The critical rule is at the bottom: **if every attempt was rate-limited,
 * throw.** The 429 branch retries without recording an error, so a wholly
 * rate-limited run would otherwise fall out of both loops with nothing to report
 * and hand back an empty object — indistinguishable from Apollo answering and
 * having nothing, which callers would relay to a person as a definitive absence.
 */
async function post(
  endpoint: string,
  payload: Record<string, unknown>,
  apiKey: string,
): Promise<ApolloRecord> {
  /*
   * Declared outside the base loop, exactly as the original does, so it leaks
   * across bases on purpose: a 404 on the first prefix followed by an all-429
   * run on the second reports the 404, which is the more diagnosable of the two.
   */
  let lastError: unknown = null;

  for (const base of basesToTry()) {
    const url = `${base}/${endpoint}`;

    for (let attempt = 0; attempt < RETRIES; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-cache',
            'x-api-key': apiKey,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: 'no-store',
        });

        if (response.status === 429) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }

        // The wrong prefix for this endpoint. Not a data answer, and not worth
        // burning the remaining retries on: try the other base instead.
        if (response.status === 404 || response.status === 405) {
          lastError = new ApolloFailure(`Apollo answered ${response.status} on ${url}`, response.status);
          break;
        }

        // A malformed parameter fails identically on every retry, so the body is
        // worth one log line: without it the only symptom is a generic failure.
        if (response.status === 422 && attempt === 0) {
          const body = await response.clone().text().catch(() => '');
          console.error(`Apollo 422 on ${endpoint} -- response body: ${body.slice(0, 500)}`);
        }

        if (!response.ok) {
          throw new ApolloFailure(`Apollo answered ${response.status} on ${endpoint}`, response.status);
        }

        const json = (await response.json()) as unknown;
        baseOk = base;
        return isRecord(json) ? json : {};
      } catch (error) {
        lastError = error;
        if (attempt === RETRIES - 1) break;
        await sleep(1000 * 2 ** attempt);
      }
    }
  }

  if (lastError) throw lastError;
  throw new ApolloFailure(
    `Apollo did not answer ${endpoint} after ${RETRIES} attempts per base URL (rate limited).`,
  );
}

// ─── Small shared helpers ────────────────────────────────────────────────────

function isRecord(value: unknown): value is ApolloRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecords(value: unknown): ApolloRecord[] {
  return asArray(value).filter(isRecord);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

/**
 * A bare domain: no scheme, no trailing slashes, no leading www.
 *
 * `replace(/\/+$/)` rather than a single-slash trim, because the original strips
 * every trailing slash and "acme.com//" is a thing people paste.
 */
export function cleanDomain(d: unknown): string {
  return str(d)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/^www\./, '');
}

/**
 * A technology display name as the uid Apollo takes on the way in.
 *
 * "Google Analytics" becomes "google_analytics". Sending the display name is not
 * an error and produces no warning: it simply matches nothing, so the filter
 * appears applied while narrowing nothing at all. (Measured later, Apollo does
 * in fact accept both and normalises itself — both forms returned exactly
 * 25,172. So the conversion is belt-and-braces. The *matching* use of this same
 * function, against the display names Apollo returns, is not.)
 */
export function techUid(name: unknown): string {
  return str(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ─── Industry enforcement ────────────────────────────────────────────────────

/**
 * Whether a company's own classification satisfies the requested industries.
 *
 * Reads `industry` and `industries` and **deliberately nothing else**. Name,
 * keywords and description say what a company talks about, not what it is, and
 * matching against them is precisely what returned a venture firm for a
 * healthcare search.
 *
 * The comparison is a substring test in both directions on normalised forms,
 * because a request can be broader than what is stored ("healthcare" against
 * "mental health care") or narrower ("hospital & health care" against "health
 * care").
 */
export function industryMatches(org: ApolloRecord, wanted: ReadonlySet<string>): boolean {
  const have: unknown[] = [org.industry, ...asArray(org.industries)];
  for (const raw of have) {
    const got = normIndustry(isRecord(raw) ? str(raw.name) : str(raw));
    if (!got) continue;
    for (const want of wanted) {
      if (got.includes(want) || want.includes(got)) return true;
    }
  }
  return false;
}

/**
 * Keep only the companies whose classification matches. Returns the survivors
 * and how many went.
 *
 * A company Apollo returned no classification for is **dropped, not kept**. An
 * unverifiable row is exactly the row this function exists to remove.
 */
export function filterByIndustry(
  orgs: readonly ApolloRecord[],
  terms: readonly string[] | undefined,
  label = '',
): { kept: ApolloRecord[]; dropped: number } {
  const wanted = expandIndustries(terms);
  if (wanted.size === 0) return { kept: [...(orgs ?? [])], dropped: 0 };

  const kept = (orgs ?? []).filter((o) => industryMatches(o, wanted));
  const dropped = (orgs ?? []).length - kept.length;
  if (dropped > 0) {
    console.info(`${label || 'filterByIndustry'}: kept ${kept.length}/${orgs.length} on the industry check`);
  }
  return { kept, dropped };
}

// ─── Filter translation ──────────────────────────────────────────────────────

/**
 * Apollo's headcount buckets. It cannot filter on an arbitrary range.
 *
 * A request for 100 to 2000 sends every *overlapping* bucket, "51,100" included,
 * so companies with 51 employees come back for a search whose floor was 100.
 * That is why every caller re-checks the real number afterwards.
 */
const EMPLOYEE_RANGES: readonly (readonly [string, number, number | null])[] = [
  ['1,10', 1, 10],
  ['11,20', 11, 20],
  ['21,50', 21, 50],
  ['51,100', 51, 100],
  ['101,200', 101, 200],
  ['201,500', 201, 500],
  ['501,1000', 501, 1000],
  ['1001,2000', 1001, 2000],
  ['2001,5000', 2001, 5000],
  ['5001,10000', 5001, 10000],
  ['10001,', 10001, null],
];

/** Every bucket label overlapping the requested range. */
export function employeeRangesFor(minEmp: number, maxEmp: number): string[] {
  const out: string[] = [];
  for (const [label, low, high] of EMPLOYEE_RANGES) {
    if (high === null) {
      if (low <= maxEmp) out.push(label);
    } else if (high >= minEmp && low <= maxEmp) {
      out.push(label);
    }
  }
  return out;
}

/**
 * A range object, or null when neither bound is set.
 *
 * Null rather than `{}` because Apollo rejects an empty range object on some
 * filters instead of reading it as unbounded. The checks are `!= null`, not
 * truthiness: `0` is a real bound.
 */
function range(
  filters: Record<string, unknown>,
  minKey: string,
  maxKey: string,
): { min?: unknown; max?: unknown } | null {
  const lo = filters[minKey];
  const hi = filters[maxKey];
  if (lo == null && hi == null) return null;
  const out: { min?: unknown; max?: unknown } = {};
  if (lo != null) out.min = lo;
  if (hi != null) out.max = hi;
  return out;
}

/**
 * Organisation filters, and their Apollo parameter names.
 *
 * One table applied to **both** endpoints, which is the whole reason it is a
 * table: the two cannot drift apart as filters are added. On the people endpoint
 * these constrain the person's current employer.
 */
const ORG_LIST_FILTERS: readonly (readonly [keyof OrgFilters, string])[] = [
  ['industries', 'q_organization_keyword_tags'],
  ['job_titles', 'q_organization_job_titles'],
  ['job_locations', 'organization_job_locations'],
  ['market_segments', 'market_segments'],
  ['naics_codes', 'organization_naics_codes'],
  ['exclude_naics_codes', 'not_organization_naics_codes'],
  ['sic_codes', 'organization_sic_codes'],
  ['exclude_sic_codes', 'not_organization_sic_codes'],
  ['technologies', 'currently_using_any_of_technology_uids'],
  ['technologies_all', 'currently_using_all_of_technology_uids'],
  ['exclude_technologies', 'currently_not_using_any_of_technology_uids'],
];

const ORG_RANGE_FILTERS: readonly (readonly [string, string, string])[] = [
  ['revenue_min', 'revenue_max', 'revenue_range'],
  ['founded_min', 'founded_max', 'organization_founded_year_range'],
  ['num_jobs_min', 'num_jobs_max', 'organization_num_jobs_range'],
  ['job_posted_after', 'job_posted_before', 'organization_job_posted_at_range'],
  ['headcount_growth_min', 'headcount_growth_max', 'organization_headcount_growth_range'],
];

/** The list filters whose values are technologies, and so must become uids. */
const TECH_FILTERS = new Set(['technologies', 'technologies_all', 'exclude_technologies']);

/** Applies every organisation-level filter to a payload, in place. */
function applyOrgFilters(payload: Record<string, unknown>, filters: OrgFilters): void {
  for (const [src, param] of ORG_LIST_FILTERS) {
    const raw = filters[src] as unknown;
    if (!raw || !Array.isArray(raw) || raw.length === 0) continue;

    let values = [...raw];
    if (TECH_FILTERS.has(src)) {
      values = [...new Set(values.map((v) => techUid(v)))].filter(Boolean);
      if (values.length === 0) continue;
    }
    payload[param] = values;
  }

  for (const [minKey, maxKey, param] of ORG_RANGE_FILTERS) {
    const rng = range(filters as Record<string, unknown>, minKey, maxKey);
    if (rng !== null) payload[param] = rng;
  }

  // `!= null`, so a literal 0 is sent rather than skipped.
  if (filters.headcount_growth_months != null) {
    payload.organization_headcount_growth_past_n_months = filters.headcount_growth_months;
  }
  if (filters.include_unknown_founded_year) {
    payload.organization_include_unknown_founded_year = true;
  }
  if (filters.department_counts && Object.keys(filters.department_counts).length > 0) {
    payload.organization_department_or_subdepartment_counts = { ...filters.department_counts };
  }

  /*
   * A one-sided bound is a real request ("1000+", "under 50"), so it becomes the
   * outermost bucket rather than no filter at all — which is what dropping it
   * would silently mean.
   */
  const { employee_min: empMin, employee_max: empMax } = filters;
  if (empMin != null || empMax != null) {
    const ranges = employeeRangesFor(empMin ?? 1, empMax ?? 1e9);
    if (ranges.length > 0) payload.organization_num_employees_ranges = ranges;
  }
}

// ─── Bucket merging ──────────────────────────────────────────────────────────

/**
 * `people` and `contacts` merged onto one shape, with the id trap closed.
 *
 * `mixed_people/api_search` answers in two buckets: `people` are net-new, and
 * `contacts` are people this team has already saved — already paid for, often
 * carrying a verified email. Reading only the first made the better half of the
 * answer invisible: a search of a client's own domain returned strangers while
 * the colleagues sitting in the account were dropped, and a narrow enough search
 * reported that the company had nobody in it.
 *
 * The trap is that a `contacts` row's `id` is a **contact** id, and the person id
 * is a separate `person_id`. Feeding the wrong one into `people/bulk_match`
 * matches nothing while looking exactly like "Apollo has no such record", and
 * burns a credit doing it.
 */
export function mergePeopleBuckets(data: ApolloRecord): ApolloRecord[] {
  const people = asRecords(data?.people);
  const seen = new Set(people.map((p) => str(p.id)).filter(Boolean));

  const contacts = asRecords(data?.contacts);
  for (const contact of contacts) {
    // The fall back to the contact id is a knowing compromise: without a
    // person_id there is nothing better, and dropping the row would lose a
    // colleague this team has already paid for.
    const personId = str(contact.person_id) || str(contact.id);
    if (!personId || seen.has(personId)) continue;
    seen.add(personId);
    people.push({ ...contact, id: personId, is_saved_contact: true });
  }

  if (contacts.length > 0) {
    console.info(
      `apollo people response: ${asRecords(data?.people).length} net new + ${contacts.length} saved contacts`,
    );
  }
  return people;
}

// ─── Row normalisation ───────────────────────────────────────────────────────

function nameList(value: unknown, limit: number): string[] {
  return asArray(value)
    .map((x) => str(isRecord(x) ? x.name : x).trim())
    .filter(Boolean)
    .slice(0, limit);
}

/** One search row, flattened to what the grid renders. */
export function normalizeSearchPerson(p: ApolloRecord): SearchPerson {
  const first = str(p.first_name).trim();
  const last = str(p.last_name).trim();
  // Apollo withholds some surnames by plan, as asterisks: "Vivek Sh***a". That
  // is expected, not a bug, and is resolved only by enriching the id.
  const masked = last ? '' : str(p.last_name_obfuscated).trim();
  const displayLast = last || masked;
  const fullName = `${first} ${displayLast}`.trim() || str(p.name).trim() || null;

  const org = isRecord(p.organization) ? p.organization : {};
  const history = asRecords(p.employment_history);
  const current = history.find((h) => h.current) ?? history[0] ?? {};
  const past = history.filter((h) => !h.current && str(h.organization_name));

  const strings = (value: unknown): string[] =>
    asArray(value)
      .map((d) => str(d))
      .filter(Boolean);

  return {
    id: str(p.id) || undefined,
    full_name: fullName,
    first_name: first || null,
    last_name: last || null,
    name_masked: Boolean(masked),
    title: (p.title as string | null) ?? null,
    headline: (p.headline as string | null) ?? null,
    seniority: (p.seniority as string | null) ?? null,
    departments: strings(p.departments),
    subdepartments: strings(p.subdepartments),
    functions: strings(p.functions),
    email_status: (p.email_status as string | null) ?? null,
    photo_url: (p.photo_url as string | null) ?? null,
    linkedin_url: (p.linkedin_url as string | null) ?? null,
    twitter_url: (p.twitter_url as string | null) ?? null,
    github_url: (p.github_url as string | null) ?? null,
    city: (p.city as string | null) ?? null,
    state: (p.state as string | null) ?? null,
    country: (p.country as string | null) ?? null,
    title_start_date: (current.start_date as string | null) ?? null,
    past_companies: past.slice(0, 3).map((h) => str(h.organization_name)),
    past_roles_count: past.length,
    last_refreshed_at: (p.last_refreshed_at as string | null) ?? null,
    is_saved_contact: Boolean(p.is_saved_contact),

    organization_id: str(org.id) || str(p.organization_id) || null,
    organization_name: (org.name as string | null) ?? null,
    organization_domain:
      (org.primary_domain as string | null) ??
      (org.domain as string | null) ??
      (org.website_url as string | null) ??
      null,
    organization_logo: (org.logo_url as string | null) ?? null,
    organization_industry: (org.industry as string | null) ?? null,
    organization_employees: (org.estimated_num_employees as number | null) ?? null,
    organization_founded: (org.founded_year as number | null) ?? null,
    organization_revenue: (org.annual_revenue as number | null) ?? null,
    organization_funding: (org.total_funding as number | null) ?? null,
    organization_linkedin: (org.linkedin_url as string | null) ?? null,
    organization_website: (org.website_url as string | null) ?? null,
    organization_city: (org.city as string | null) ?? null,
    organization_country: (org.country as string | null) ?? null,
    organization_technologies: nameList(org.technology_names, 12),
    organization_keywords: nameList(org.keywords, 10),
  };
}

/** Fields whose presence is worth counting on every page. */
const COVERAGE_KEYS = [
  'last_name',
  'linkedin_url',
  'photo_url',
  'seniority',
  'city',
  'country',
  'headline',
  'email_status',
  'departments',
  'employment_history',
  'organization_domain',
  'organization_industry',
  'organization_employees',
] as const;

/**
 * "last_name 25/25, photo_url 0/25, ..." for a page.
 *
 * **Counts only, never values**, because those are personal data and must not
 * land in application logs. This exists because which fields Apollo returns
 * varies by plan and changes without notice: without it, a grid that has gone
 * sparse is indistinguishable from a rendering bug.
 */
export function fieldCoverage(rows: readonly SearchPerson[]): string {
  if (rows.length === 0) return 'no rows';
  return COVERAGE_KEYS.map((k) => {
    const n = rows.filter((r) => {
      const v = r[k];
      return Array.isArray(v) ? v.length > 0 : Boolean(v);
    }).length;
    return `${k} ${n}/${rows.length}`;
  }).join(', ');
}

// ─── The three-way domain split ──────────────────────────────────────────────

/**
 * Apollo's domain parameter is a relevance hint, not a restriction: a malformed
 * or unindexed domain silently falls back to an **unfiltered** search rather
 * than erroring or matching nothing. So the domain is enforced here, and the
 * three arms matter more than they look.
 *
 * - present and equal: confirmed, keep
 * - present and different: a real mismatch, drop and count it
 * - absent entirely: unconfirmed, keep but flag
 *
 * That third arm is the one that was missing. Apollo's per-row field coverage is
 * plan-dependent, so dropping domain-less rows read "Apollo didn't say" as
 * "Apollo said no", and the single most common search on the page — everyone at
 * this one company — returned zero for a domain Apollo holds hundreds of people
 * at.
 */
function splitByDomain(
  rows: readonly ApolloRecord[],
  wanted: ReadonlySet<string>,
  read: (row: ApolloRecord) => string,
  flag: 'domain_unconfirmed' | 'employer_unconfirmed',
): { rows: ApolloRecord[]; dropped: number; unconfirmed: number } {
  const confirmed: ApolloRecord[] = [];
  const unconfirmed: ApolloRecord[] = [];
  let dropped = 0;

  for (const row of rows) {
    const have = cleanDomain(read(row));
    if (wanted.has(have)) confirmed.push(row);
    else if (have) dropped += 1;
    else {
      // Flagged in place, so the row the caller already holds carries the mark.
      row[flag] = true;
      unconfirmed.push(row);
    }
  }

  // Confirmed first, order preserved within each group.
  return { rows: [...confirmed, ...unconfirmed], dropped, unconfirmed: unconfirmed.length };
}

function wantedDomains(values: readonly string[] | undefined): Set<string> {
  const out = new Set((values ?? []).map((d) => cleanDomain(d)));
  out.delete('');
  return out;
}

// ─── Company search ──────────────────────────────────────────────────────────

/**
 * An undocumented server-side ceiling on funding-amount bounds.
 *
 * A bound above 2^31-1 returns a hard 422 ("The number ... is too big for our
 * system to handle") rather than being clamped. "Companies that raised over $5
 * billion" is a reasonable thing to ask and it crashed the entire search. It is
 * clamped here instead, and the clamp is reported so the answer can say it ran
 * against the largest figure Apollo can represent.
 */
const MAX_RANGE_VALUE = 2_147_483_647;

/**
 * Companies matching the filters.
 *
 * **Costs one credit per call that returns at least one row**, and zero for an
 * empty result. It bills per *call*, not per company, which is the lever that
 * makes rich people-cards affordable elsewhere: N organisation ids in one
 * request cost the same single credit as one.
 */
export async function searchCompanies(
  filters: CompanyFilters,
  apiKey: string,
  {
    page = 1,
    perPage = 25,
    strict = false,
    meta,
  }: { page?: number; perPage?: number; strict?: boolean; meta?: SearchMeta } = {},
): Promise<ApolloRecord[]> {
  const payload: Record<string, unknown> = { page, per_page: Math.min(perPage, 100) };

  if (filters.name) payload.q_organization_name = filters.name;
  if (filters.domains?.length) payload.q_organization_domains_list = [...filters.domains];
  if (filters.organization_ids?.length) payload.organization_ids = [...filters.organization_ids];
  if (filters.locations?.length) payload.organization_locations = [...filters.locations];
  if (filters.exclude_locations?.length) {
    payload.organization_not_locations = [...filters.exclude_locations];
  }
  if (filters.label_ids?.length) payload.account_label_ids = [...filters.label_ids];

  applyOrgFilters(payload, filters);

  for (const [minKey, maxKey, param] of [
    ['total_funding_min', 'total_funding_max', 'total_funding_range'],
    ['latest_funding_min', 'latest_funding_max', 'latest_funding_amount_range'],
  ] as const) {
    const rng = range(filters as Record<string, unknown>, minKey, maxKey);
    if (rng === null) continue;
    for (const bound of ['min', 'max'] as const) {
      const v = rng[bound];
      if (typeof v === 'number' && v > MAX_RANGE_VALUE) {
        rng[bound] = MAX_RANGE_VALUE;
        // Recorded before the request goes out, so the clamp is reportable even
        // if the call then fails.
        if (meta) (meta.funding_value_clamped ??= []).push(param);
      }
    }
    payload[param] = rng;
  }

  const fundedRange = range(filters as Record<string, unknown>, 'funded_after', 'funded_before');
  if (fundedRange !== null) payload.latest_funding_date_range = fundedRange;

  let data: ApolloRecord;
  try {
    data = await post('mixed_companies/search', payload, apiKey);
  } catch (error) {
    console.error('Failed to fetch companies from Apollo.');
    if (strict) throw error;
    return [];
  }

  if (meta) {
    const pagination = isRecord(data.pagination) ? data.pagination : {};
    meta.total_entries = (pagination.total_entries as number | null) ?? null;
    meta.total_pages = (pagination.total_pages as number | null) ?? null;
  }

  /*
   * Both buckets, merged. An `accounts` row is a company this team already
   * saved, and its `id` is an ACCOUNT id — the organisation id lives in
   * `organization_id`, and the domain in `domain` rather than `primary_domain`.
   * A row with no organisation id is skipped rather than guessed at, because
   * feeding an account id into `organization_ids` matches nothing while looking
   * exactly like "Apollo has no such company".
   */
  let orgs = asRecords(data.organizations);
  for (const acct of asRecords(data.accounts)) {
    const orgId = str(acct.organization_id);
    if (!orgId) {
      console.warn(`apollo accounts row without organization_id, skipping: ${str(acct.name).slice(0, 60)}`);
      continue;
    }
    const merged: ApolloRecord = { ...acct, id: orgId };
    if (!merged.primary_domain) merged.primary_domain = acct.domain;
    orgs.push(merged);
  }

  // Apollo has no text-exclusion parameter, so this one is ours entirely.
  const excludeKeywords = (filters.exclude_keywords ?? []).map((k) => k.toLowerCase()).filter(Boolean);
  if (excludeKeywords.length > 0) {
    const before = orgs.length;
    orgs = orgs.filter((o) => {
      const text = [str(o.name), str(o.short_description), str(o.industry)].join(' ').toLowerCase();
      return !excludeKeywords.some((kw) => text.includes(kw));
    });
    if (meta && orgs.length !== before) meta.exclude_keywords_dropped = before - orgs.length;
  }

  const wanted = wantedDomains(filters.domains);
  if (wanted.size > 0) {
    const before = orgs.length;
    const split = splitByDomain(
      orgs,
      wanted,
      (o) => str(o.primary_domain) || str(o.domain),
      'domain_unconfirmed',
    );
    orgs = split.rows;
    console.info(
      `searchCompanies: domain filter kept ${orgs.length}/${before} (${split.unconfirmed} unconfirmed)`,
    );
    if (meta) {
      meta.domain_dropped = split.dropped;
      meta.domain_unconfirmed = split.unconfirmed;
      // Apollo's total counted the looser match it actually ran.
      if (split.dropped) meta.total_entries = null;
    }
  }

  if (filters.industries?.length) {
    const before = orgs.length;
    const result = filterByIndustry(orgs, filters.industries, 'searchCompanies');
    orgs = result.kept;
    if (meta && result.dropped) {
      meta.industry_dropped = result.dropped;
      meta.total_entries = null;
      console.info(`searchCompanies: ${orgs.length}/${before} survived the industry check`);
    }
  }

  if (filters.max_companies != null) orgs = orgs.slice(0, filters.max_companies);

  console.info(`searchCompanies: received ${orgs.length} companies (after filtering)`);
  return orgs;
}

// ─── People search ───────────────────────────────────────────────────────────

/**
 * People matching the filters.
 *
 * **Free.** Returns identity and role only: no verified emails or phones, and
 * some surnames withheld depending on plan. Field coverage varies by plan, which
 * is what `fieldCoverage` exists to make visible.
 */
export async function searchPeople(
  filters: PeopleFilters,
  apiKey: string,
  {
    page = 1,
    perPage = 25,
    strict = false,
    meta,
  }: { page?: number; perPage?: number; strict?: boolean; meta?: SearchMeta } = {},
): Promise<SearchPerson[]> {
  const payload: Record<string, unknown> = { page, per_page: Math.min(perPage, 100) };

  if (filters.titles?.length) {
    payload.person_titles = [...filters.titles];
    payload.include_similar_titles = filters.include_similar_titles !== false;
  }
  if (filters.seniorities?.length) payload.person_seniorities = [...filters.seniorities];
  // Where the PERSON lives, and where their EMPLOYER is: independent filters
  // that apply together. Dropping either silently answers a different question.
  if (filters.person_locations?.length) payload.person_locations = [...filters.person_locations];
  if (filters.company_locations?.length) payload.organization_locations = [...filters.company_locations];
  if (filters.company_domains?.length) payload.q_organization_domains_list = [...filters.company_domains];
  if (filters.organization_ids?.length) payload.organization_ids = [...filters.organization_ids];
  if (filters.linkedin_urls?.length) payload.person_linkedin_urls = [...filters.linkedin_urls];
  if (filters.keywords) payload.q_keywords = filters.keywords;
  if (filters.email_status?.length) payload.contact_email_status = [...filters.email_status];

  const tenure = range(filters as Record<string, unknown>, 'days_in_title_min', 'days_in_title_max');
  if (tenure !== null) payload.person_days_in_current_title_range = tenure;
  const yoe = range(filters as Record<string, unknown>, 'yoe_min', 'yoe_max');
  if (yoe !== null) payload.person_total_yoe_range = yoe;

  applyOrgFilters(payload, filters);

  let data: ApolloRecord;
  try {
    data = await post('mixed_people/api_search', payload, apiKey);
  } catch (error) {
    console.error('Failed to search people on Apollo.');
    if (strict) throw error;
    return [];
  }

  if (meta) {
    const pagination = isRecord(data.pagination) ? data.pagination : {};
    meta.total_entries = (pagination.total_entries as number | null) ?? null;
    meta.total_pages = (pagination.total_pages as number | null) ?? null;
  }

  const merged = mergePeopleBuckets(data);

  /*
   * Captured here, before the cap and before the domain filter. "Is there
   * another page" is a question about Apollo, so it must never be answered from
   * how many rows survived our own checks.
   */
  if (meta) meta.returned = merged.length;

  const capped = filters.max_people != null ? merged.slice(0, filters.max_people) : merged;
  let normalized = capped.map(normalizeSearchPerson);

  const wanted = wantedDomains(filters.company_domains);
  if (wanted.size > 0) {
    const before = normalized.length;
    const split = splitByDomain(
      normalized as ApolloRecord[],
      wanted,
      (p) => str(p.organization_domain),
      'employer_unconfirmed',
    );
    normalized = split.rows as SearchPerson[];
    console.info(
      `searchPeople: domain filter kept ${normalized.length}/${before} (${split.unconfirmed} unconfirmed)`,
    );

    if (meta) {
      meta.company_dropped = split.dropped;
      meta.company_unconfirmed = split.unconfirmed;

      /*
       * Two ways to know Apollo's total does not describe these rows.
       *
       * One: we removed rows, so the total described a looser match.
       *
       * Two: Apollo left the page SHORT while claiming there is more to come,
       * which is what an ignored filter looks like, and is how "1 of 83,000,000
       * matches" once reached the screen beside a single-company search. A
       * genuinely short LAST page is not that — there the total is within reach
       * of the pages served, so the second half of the test is false.
       *
       * `total_pages` is never invalidated either way. It describes Apollo's own
       * paging, and reading it as invalid is what hid "Load more".
       */
      const served = meta.returned ?? 0;
      const total = meta.total_entries;
      if (split.dropped) {
        meta.total_entries = null;
      } else if (total != null && served < perPage && total > page * perPage) {
        console.info(
          `searchPeople: ignoring an inconsistent total (served ${served} of ${perPage} on page ${page}, total claims ${total})`,
        );
        meta.total_entries = null;
      }
    }
  }

  console.info(`searchPeople: received ${normalized.length} people (${fieldCoverage(normalized)})`);
  return normalized;
}

// ─── Enrichment ──────────────────────────────────────────────────────────────

/**
 * Full records for a list of person ids. Ten per call, in sequential chunks.
 *
 * **About one credit per id actually matched**; misses are free. Returns only
 * the ids Apollo matched, keyed by id.
 *
 * `failed` is the important part. A missing id means one of two very different
 * things: Apollo has no record, or that chunk of ten never got an answer.
 * Without the distinction, a fifty-person reveal in which one chunk timed out
 * returned forty profiles and reported success, and the ten missing people read
 * as ten people Apollo has nothing on. They are the opposite: the ones worth
 * asking for again, and nothing was billed for them, so a retry is free.
 *
 * An answer whose *shape* is unreadable lands in `failed` too. An answer we
 * cannot read is not an answer.
 */
export async function bulkMatchPeople(
  ids: readonly string[],
  apiKey: string,
  failed?: string[],
): Promise<Record<string, ApolloRecord>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};

  const out: Record<string, ApolloRecord> = {};

  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    let data: ApolloRecord;
    try {
      data = await post('people/bulk_match', { details: chunk.map((id) => ({ id })) }, apiKey);
    } catch {
      console.error(`bulkMatchPeople failed for a chunk of ${chunk.length} ids`);
      failed?.push(...chunk);
      continue;
    }

    if (!Array.isArray(data.matches)) {
      console.warn(`bulkMatchPeople: unexpected response shape (keys=${Object.keys(data).sort().slice(0, 8).join(',')})`);
      failed?.push(...chunk);
      continue;
    }

    // Correlated by POSITION: there is no id echoed back to key off. A short
    // array is tolerated rather than treated as a failure.
    chunk.forEach((id, j) => {
      const m = data.matches as unknown[];
      const match = j < m.length ? m[j] : null;
      if (match && isRecord(match)) out[id] = match;
    });
  }

  return out;
}

/**
 * One person, by whatever identifies them.
 *
 * **About one credit on a match; a miss is free.** The caller assembles the
 * payload, because what identifies a person differs by where the request came
 * from: an Apollo id from a search row is exact, a name and a domain is a guess
 * that can land on the wrong one of two same-named colleagues, and an email
 * address is somewhere in between.
 *
 * Returns null when Apollo answered and had nobody. **Throws** when Apollo did
 * not answer, because those are different facts and a caller that renders them
 * identically ends up stating that Apollo has no record of a person it was never
 * asked about.
 */
export async function matchPerson(
  payload: Record<string, unknown>,
  apiKey: string,
): Promise<ApolloRecord | null> {
  const data = await post('people/match', payload, apiKey);
  const person = data.person;
  return isRecord(person) && Object.keys(person).length > 0 ? person : null;
}

/**
 * A company by domain.
 *
 * The cleaning here is deliberately NOT `cleanDomain`: no lowercasing, no `www.`
 * stripping, and the scheme is removed unanchored. Reproduced from the original
 * rather than tidied, because `organizations/enrich` is fussy and this is the
 * form that has been observed to work.
 *
 * `failed` is the same out-parameter pattern `bulkMatchPeople` uses, and it is
 * here for the same reason: an empty result means either "Apollo has no such
 * company" or "Apollo did not answer", and a caller that cannot tell them apart
 * makes claims about a vendor's database out of a failed request.
 */
export async function enrichCompany(
  domain: string,
  apiKey: string,
  failed?: { failed: boolean },
): Promise<ApolloRecord> {
  const clean = domain.replace('https://', '').replace('http://', '').replace(/\/+$/, '');
  try {
    const data = await post('organizations/enrich', { domain: clean }, apiKey);
    // `in` rather than `??`, so a present-but-null key returns null rather than
    // silently handing back the whole envelope as though it were the company.
    return ('organization' in data ? (data.organization as ApolloRecord) : data) ?? {};
  } catch {
    console.error(`Failed to enrich company domain=${domain}`);
    if (failed) failed.failed = true;
    return {};
  }
}

/**
 * A company by Apollo id.
 *
 * `organizations/enrich` is documented as domain-keyed and does not officially
 * accept an id, so this can legitimately come back empty for a real
 * organisation. **Callers must read an empty result as "now try the domain",
 * never as "Apollo has no such company."** Taking it as final is what made every
 * company-profile question answer "Apollo doesn't have a full profile",
 * regardless of which company was asked about: an id was always known, so the
 * domain path was never reached.
 */
export async function enrichCompanyById(
  apolloId: string,
  apiKey: string,
  failed?: { failed: boolean },
): Promise<ApolloRecord> {
  try {
    const data = await post('organizations/enrich', { id: apolloId }, apiKey);
    const org = 'organization' in data ? data.organization : data;
    return isRecord(org) && (org.id || org.name) ? org : {};
  } catch {
    console.error(`Failed to enrich company apollo_id=${apolloId}`);
    if (failed) failed.failed = true;
    return {};
  }
}

/**
 * People at one organisation, via the free people search.
 *
 * `organizationId` must be the Apollo-internal organisation id, not an account
 * id from a CSV export: different namespaces, and the wrong one matches nothing.
 * Logs a count only, never the record, which carries names and addresses.
 */
export async function getLeadership(
  organizationId: string,
  apiKey: string,
  maxPeople = 20,
): Promise<ApolloRecord[]> {
  try {
    const data = await post(
      'mixed_people/api_search',
      { organization_ids: [organizationId], page: 1, per_page: Math.min(maxPeople, 25) },
      apiKey,
    );

    const people = mergePeopleBuckets(data);
    console.info(`getLeadership: ${people.length} people for org ${organizationId}`);

    return people.slice(0, maxPeople).map((p) => {
      const first = str(p.first_name).trim();
      const last = str(p.last_name).trim();
      const history = asArray(p.employment_history);
      const firstRole = isRecord(history[0]) ? history[0] : {};
      return {
        id: p.id,
        is_saved_contact: Boolean(p.is_saved_contact),
        full_name: `${first} ${last}`.trim() || str(p.name).trim() || null,
        first_name: first || null,
        last_name: last || null,
        title: p.title ?? null,
        linkedin_url: p.linkedin_url ?? null,
        email: p.email ?? null,
        start_date: firstRole.start_date ?? null,
      };
    });
  } catch {
    console.error(`Failed to get leadership for org_id=${organizationId}`);
    return [];
  }
}
