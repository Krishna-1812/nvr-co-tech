import { expand as expandIndustries } from './vocab/industries';
import { industryMatches, techUid } from './apollo/client';
import type { ApolloRecord } from './apollo/types';
import { titleMatches } from './taxonomy';

/**
 * The honesty engine: enforcing, in code, the filters Apollo treats as hints.
 *
 * ── The audit this came out of ─────────────────────────────────────────────
 *
 * Every filter the tool exposes was measured against what Apollo actually does
 * with it. They fall into three groups, and the grouping is the design.
 *
 * **Strict server-side, trust Apollo.** `person_seniorities`,
 * `contact_email_status`, NAICS and SIC codes (prefix-matched, documented), the
 * numeric ranges, and `organization_ids`. These are Apollo's own structured
 * fields compared numerically or by exact code, and there is nothing to add.
 *
 * **Relevance matches dressed as filters, verify here.** Industry, employee
 * count, revenue, HQ location, technology, title, domain, excluded keywords.
 * Apollo treats each as a hint that widens recall, so it returns rows that do
 * not satisfy the filter.
 *
 * **Unverifiable on this plan, left to Apollo and labelled honestly.**
 * `person_locations` and `contact_email_status` describe fields the free people
 * search does not return, so there is nothing to check them against without
 * paying per person. `market_segments` is documented as matching "the
 * organization's tags and name" and has no canonical field behind it at all, so
 * the interface calls it the keyword match it is rather than pretending it is a
 * segment filter.
 */

/** Reason key to the words a person reads beside the count. */
export const VERIFY_LABELS: Readonly<Record<string, string>> = {
  company: 'working somewhere else',
  domain: 'a different company at that domain',
  industry: 'outside the industry',
  employees: 'outside the size range',
  revenue: 'outside the revenue range',
  hq: 'headquartered elsewhere',
  technology: 'not using the technology',
  title: 'the wrong title',
  excluded_keyword: 'matching an excluded keyword',
};

/** The employer's facts, however the row happened to spell them. */
type OrgView = {
  industry?: unknown;
  industries?: unknown;
  employees?: unknown;
  revenue?: unknown;
  city?: unknown;
  state?: unknown;
  country?: unknown;
  address?: unknown;
  technologies?: unknown;
};

/**
 * One row presented as a company, whichever tab it came from.
 *
 * A person row carries their employer under `organization_*` keys and a company
 * row carries the same facts under its own names. Normalising here means every
 * check below is written once and cannot reach two different conclusions about
 * the same employer depending on which tab asked.
 */
export function orgView(r: ApolloRecord, isPeople: boolean): OrgView {
  if (!isPeople) {
    return {
      industry: r.industry,
      industries: r.industries,
      employees: r.estimated_num_employees,
      revenue: r.annual_revenue,
      city: r.city,
      state: r.state,
      country: r.country,
      address: r.raw_address,
      technologies: r.technologies,
    };
  }
  return {
    industry: r.organization_industry,
    industries: r.organization_industries,
    employees: r.organization_employees,
    revenue: r.organization_revenue,
    city: r.organization_city,
    state: r.organization_state,
    country: r.organization_country,
    address: r.organization_address,
    technologies: r.organization_technologies,
  };
}

// ─── Places ──────────────────────────────────────────────────────────────────

/**
 * Apollo takes locations as free text and its own matcher understands "Austin,
 * TX". The check here did not: it tested each comma-separated part as a raw
 * substring, and **"tx" does not appear in "Texas"** any more than "ny" appears
 * in "New York". So the two most natural ways to type a US location removed
 * every row Apollo had already matched, and the page reported them as
 * "headquartered elsewhere". "Boston, MA" and "San Diego, CA" only ever passed
 * by accident, "ma" and "ca" happening to sit inside "Massachusetts" and
 * "California" — which is why the fix also had to make matching whole-word.
 */
const STATE_ABBR: Readonly<Record<string, string>> = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas',
  ca: 'california', co: 'colorado', ct: 'connecticut', de: 'delaware',
  fl: 'florida', ga: 'georgia', hi: 'hawaii', id: 'idaho',
  il: 'illinois', in: 'indiana', ia: 'iowa', ks: 'kansas',
  ky: 'kentucky', la: 'louisiana', me: 'maine', md: 'maryland',
  ma: 'massachusetts', mi: 'michigan', mn: 'minnesota',
  ms: 'mississippi', mo: 'missouri', mt: 'montana', ne: 'nebraska',
  nv: 'nevada', nh: 'new hampshire', nj: 'new jersey',
  nm: 'new mexico', ny: 'new york', nc: 'north carolina',
  nd: 'north dakota', oh: 'ohio', ok: 'oklahoma', or: 'oregon',
  pa: 'pennsylvania', ri: 'rhode island', sc: 'south carolina',
  sd: 'south dakota', tn: 'tennessee', tx: 'texas', ut: 'utah',
  vt: 'vermont', va: 'virginia', wa: 'washington',
  wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming',
  dc: 'district of columbia',
};

/**
 * Some of these collide with a state code: "CA" is California and Canada, "IN"
 * is Indiana and India, "DE" is Delaware and Germany. Both readings go into the
 * candidate set and any one of them may match — which is safe only because
 * **every** comma-separated part of the typed location still has to match, so a
 * loose state part cannot carry a row on its own. "Toronto, CA" reaches Canada;
 * it does not reach Toronto, Ohio.
 */
const COUNTRY_ABBR: Readonly<Record<string, string>> = {
  us: 'united states', usa: 'united states', 'u.s.': 'united states',
  'u.s.a.': 'united states', uk: 'united kingdom', gb: 'united kingdom',
  uae: 'united arab emirates', ca: 'canada', in: 'india',
  de: 'germany', au: 'australia', fr: 'france', jp: 'japan',
  sg: 'singapore', nl: 'netherlands', es: 'spain', it: 'italy',
  br: 'brazil', mx: 'mexico', il: 'israel', ie: 'ireland',
  se: 'sweden', ch: 'switzerland', nz: 'new zealand', za: 'south africa',
};

/** Every spelling of one typed location part worth testing for. */
export function placeTerms(part: string): Set<string> {
  const p = String(part ?? '').trim().toLowerCase();
  if (!p) return new Set();

  const out = new Set([p]);
  for (const table of [STATE_ABBR, COUNTRY_ABBR]) {
    if (p in table) out.add(table[p]);
    for (const [abbr, full] of Object.entries(table)) if (p === full) out.add(abbr);
  }
  return out;
}

/** Whole-word containment, so "CA" matches California and not Chicago. */
export function placeHas(have: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(have);
}

/**
 * Whether a company's HQ is in one of the requested places.
 *
 * Matched against city, state, country and raw address joined together, so "San
 * Francisco, CA" matches a record holding those two in different fields.
 */
export function placeMatches(org: OrgView, wanted: readonly string[] | undefined): boolean {
  const have = [org.city, org.state, org.country, org.address]
    .map((x) => String(x ?? '').toLowerCase())
    .join(' | ');
  if (!have.replace(/[\s|]/g, '')) return false;

  for (const term of wanted ?? []) {
    const parts = String(term ?? '')
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    if (parts.length === 0) continue;
    // EVERY part must match, ANY of its spellings may.
    if (parts.every((p) => [...placeTerms(p)].some((t) => placeHas(have, t)))) return true;
  }
  return false;
}

// ─── Technologies and numbers ────────────────────────────────────────────────

/**
 * Apollo takes technologies as uids and **returns** them as display names, so
 * both sides are normalised through the same function or they never compare at
 * all.
 */
export function techMatches(org: OrgView, wanted: readonly string[] | undefined): boolean {
  const have = new Set(
    (Array.isArray(org.technologies) ? org.technologies : []).map((t) => techUid(t)),
  );
  have.delete('');
  if (have.size === 0) return false;
  return (wanted ?? []).some((t) => have.has(techUid(t)));
}

/**
 * Whether a figure Apollo returned really is inside the requested bounds.
 *
 * **A record with no figure at all is not inside a range that was asked for**,
 * so it fails here rather than being waved through. The request is a hint to
 * Apollo; the number Apollo returned is what settles it.
 */
export function numInRange(
  value: unknown,
  lo: number | null | undefined,
  hi: number | null | undefined,
): boolean {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return false;
  if (lo != null && n < lo) return false;
  if (hi != null && n > hi) return false;
  return true;
}

/**
 * Whether a headcount really is inside the requested range.
 *
 * Apollo only filters by discrete buckets, so a request for 100 to 2000 sends
 * every overlapping bucket and companies with 51 employees come back for a
 * search whose floor was 100.
 */
export function sizeOk(
  employees: unknown,
  min: number | null | undefined,
  max: number | null | undefined,
): boolean {
  return numInRange(employees, min, max);
}

// ─── The pass itself ─────────────────────────────────────────────────────────

/** The filters this pass knows how to re-check. */
export type VerifyFilters = {
  industries?: string[];
  employee_min?: number | null;
  employee_max?: number | null;
  revenue_min?: number | null;
  revenue_max?: number | null;
  company_locations?: string[];
  locations?: string[];
  technologies?: string[];
  titles?: string[];
  include_similar_titles?: boolean;
};

export type VerifyResult<T> = {
  kept: T[];
  /** Reason to how many rows failed THAT check. Counts overlap — see below. */
  dropped: Record<string, number>;
  /** Rows kept because the paid employer lookup failed, not because they passed. */
  employerUnavailable: number;
};

/**
 * Enforce every filter Apollo treats as a hint rather than a rule.
 *
 * A row missing the field a check needs is **dropped, not waved through**: an
 * unverifiable row is exactly the row that produced "I searched for Healthcare
 * and got a venture firm". There are two exceptions. A check whose filter was
 * not requested never runs. And a row flagged `employer_lookup_failed` — set
 * when the paid lookup behind these fields never got an answer — is kept and
 * counted separately, because there "missing" describes an outage rather than
 * Apollo's classification, and rejecting it under a reason nothing checked would
 * be asserting something about a company we failed to look up.
 *
 * ── `dropped`'s counts deliberately overlap ────────────────────────────────
 *
 * A row that is both the wrong industry and undersized is tallied under **both**.
 * Reporting only the first reason a fixed check order happened to reach
 * undercounted how many rows a filter further down was also responsible for:
 * "Removed 24: 18 outside the industry" was true only if none of those 18 also
 * failed a later check.
 *
 * So `sum(dropped.values())` can exceed `rows.length - kept.length`, and that is
 * **expected, not a bug**. Callers must compute the rejected total from real row
 * counts and never by summing this object. Membership of `kept` is still exactly
 * one row in, one row out.
 */
export function verifyRows<T extends ApolloRecord>(
  rows: readonly T[],
  filters: VerifyFilters,
  isPeople: boolean,
): VerifyResult<T> {
  const wantedIndustry = expandIndustries(filters.industries);
  const { employee_min: empMin, employee_max: empMax } = filters;
  const { revenue_min: revMin, revenue_max: revMax } = filters;
  const places = isPeople ? filters.company_locations : filters.locations;
  const techs = filters.technologies;

  /*
   * Only when somebody has explicitly unchecked "include similar titles".
   * Leaving it checked is a request for Apollo's fuzzy match, and overriding
   * that here would make the checkbox do nothing.
   */
  const strictTitles = Boolean(
    isPeople && filters.titles?.length && filters.include_similar_titles === false,
  );

  const hasEmployerFilter = Boolean(
    wantedIndustry.size > 0 ||
      empMin != null ||
      empMax != null ||
      revMin != null ||
      revMax != null ||
      places?.length ||
      techs?.length,
  );

  const dropped: Record<string, number> = {};
  const kept: T[] = [];
  let employerUnavailable = 0;

  for (const r of rows ?? []) {
    const org = orgView(r, isPeople);

    if (r.employer_lookup_failed && hasEmployerFilter) {
      employerUnavailable += 1;
      kept.push(r);
      continue;
    }

    const reasons: string[] = [];
    if (wantedIndustry.size > 0 && !industryMatches(org as ApolloRecord, wantedIndustry)) {
      reasons.push('industry');
    }
    if ((empMin != null || empMax != null) && !sizeOk(org.employees, empMin, empMax)) {
      reasons.push('employees');
    }
    if ((revMin != null || revMax != null) && !numInRange(org.revenue, revMin, revMax)) {
      reasons.push('revenue');
    }
    if (places?.length && !placeMatches(org, places)) reasons.push('hq');
    if (techs?.length && !techMatches(org, techs)) reasons.push('technology');
    if (strictTitles && !titleMatches(r.title as string, filters.titles)) reasons.push('title');

    if (reasons.length > 0) {
      for (const reason of reasons) dropped[reason] = (dropped[reason] ?? 0) + 1;
    } else {
      kept.push(r);
    }
  }

  if (Object.keys(dropped).length > 0) {
    const summary = Object.entries(dropped)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    console.info(`finder verify: kept ${kept.length}/${(rows ?? []).length} (${summary})`);
  }

  return { kept, dropped, employerUnavailable };
}
