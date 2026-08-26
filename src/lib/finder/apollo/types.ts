/**
 * The shapes the Apollo client speaks in.
 *
 * Kept apart from the client itself so the verification layer, the routes and
 * the components can name a row without importing the thing that fetches one.
 */

/** A raw Apollo record, before this code has decided what any of it means. */
export type ApolloRecord = Record<string, unknown>;

/**
 * One person from the free search, flattened.
 *
 * **Every field is optional by design.** Measured against a live account: the
 * free tier returns id, first_name, last_name, title, linkedin_url,
 * last_refreshed_at and a thin organization, and nothing else. Photo, location,
 * seniority, department and employment history come only from paid enrichment.
 * Writing this type with required fields would be writing down a plan we do not
 * have, and every renderer would then be lying about what it is guaranteed.
 */
export type SearchPerson = {
  id?: string;
  full_name?: string | null;
  first_name?: string | null;
  /** The real surname. Null when Apollo withheld it — see `name_masked`. */
  last_name?: string | null;
  /** Apollo returned only an obfuscated surname, so the name on screen is short. */
  name_masked?: boolean;
  title?: string | null;
  headline?: string | null;
  seniority?: string | null;
  departments?: string[];
  subdepartments?: string[];
  functions?: string[];
  email_status?: string | null;
  photo_url?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  github_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  title_start_date?: string | null;
  past_companies?: string[];
  past_roles_count?: number;
  last_refreshed_at?: string | null;
  /**
   * Set by us, never by Apollo: this row came from the `contacts` bucket, which
   * means this team has already paid for them.
   */
  is_saved_contact?: boolean;
  /** Apollo returned no domain for the employer, so we could not confirm it. */
  employer_unconfirmed?: boolean;

  organization_id?: string | null;
  organization_name?: string | null;
  organization_domain?: string | null;
  organization_logo?: string | null;
  organization_industry?: string | null;
  organization_employees?: number | null;
  organization_founded?: number | null;
  organization_revenue?: number | null;
  organization_funding?: number | null;
  organization_linkedin?: string | null;
  organization_website?: string | null;
  organization_city?: string | null;
  organization_country?: string | null;
  organization_technologies?: string[];
  organization_keywords?: string[];

  /** Anything a later stage attaches: employer facts, derived role, and so on. */
  [key: string]: unknown;
};

/** Filters that describe an ORGANISATION. Applied to both endpoints. */
export type OrgFilters = {
  industries?: string[];
  job_titles?: string[];
  job_locations?: string[];
  market_segments?: string[];
  naics_codes?: string[];
  exclude_naics_codes?: string[];
  sic_codes?: string[];
  exclude_sic_codes?: string[];
  technologies?: string[];
  technologies_all?: string[];
  exclude_technologies?: string[];
  revenue_min?: number | null;
  revenue_max?: number | null;
  founded_min?: number | null;
  founded_max?: number | null;
  num_jobs_min?: number | null;
  num_jobs_max?: number | null;
  job_posted_after?: string | null;
  job_posted_before?: string | null;
  headcount_growth_min?: number | null;
  headcount_growth_max?: number | null;
  headcount_growth_months?: number | null;
  include_unknown_founded_year?: boolean;
  department_counts?: Record<string, unknown>;
  employee_min?: number | null;
  employee_max?: number | null;
};

export type CompanyFilters = OrgFilters & {
  name?: string;
  domains?: string[];
  locations?: string[];
  exclude_locations?: string[];
  label_ids?: string[];
  organization_ids?: string[];
  /** Client-side only. Apollo has no text-exclusion parameter at all. */
  exclude_keywords?: string[];
  total_funding_min?: number | null;
  total_funding_max?: number | null;
  latest_funding_min?: number | null;
  latest_funding_max?: number | null;
  funded_after?: string | null;
  funded_before?: string | null;
  max_companies?: number | null;
};

export type PeopleFilters = OrgFilters & {
  titles?: string[];
  include_similar_titles?: boolean;
  seniorities?: string[];
  person_locations?: string[];
  company_locations?: string[];
  company_domains?: string[];
  organization_ids?: string[];
  linkedin_urls?: string[];
  keywords?: string;
  email_status?: string[];
  days_in_title_min?: number | null;
  days_in_title_max?: number | null;
  yoe_min?: number | null;
  yoe_max?: number | null;
  max_people?: number | null;
};

/**
 * The out-parameter every search fills in.
 *
 * This pattern is used consistently across the whole tool, and its purpose is
 * always the same: **a caller that shows a filtered list must be able to say
 * what it filtered.** A function that quietly removed rows and returned only the
 * survivors would make an honest interface impossible to build on top of it.
 */
export type SearchMeta = {
  /**
   * Apollo's own row total — or null, once we know it does not describe the
   * rows being returned. See `searchPeople` for the two ways that happens.
   */
  total_entries?: number | null;
  /**
   * Apollo's own page count. **Never invalidated**, even when `total_entries`
   * is: it describes Apollo's paging rather than our filtering. Reading it as
   * invalid is what once hid "Load more" and stranded a reader on 23 of 355
   * people.
   */
  total_pages?: number | null;
  /** Rows Apollo actually served on this page, before any of our own filtering. */
  returned?: number;
  /** Rows dropped because Apollo's own domain field disagreed with the request. */
  domain_dropped?: number;
  /** Rows kept despite Apollo returning no domain to check. */
  domain_unconfirmed?: number;
  /** The people-search equivalents, describing a person's EMPLOYER. */
  company_dropped?: number;
  company_unconfirmed?: number;
  industry_dropped?: number;
  exclude_keywords_dropped?: number;
  /** Which funding parameters had a bound reduced to Apollo's ceiling. */
  funding_value_clamped?: string[];
};
