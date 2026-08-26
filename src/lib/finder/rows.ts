import { orgPhone } from './fields';
import type { ApolloRecord } from './apollo/types';
import { deriveRole } from './taxonomy';

/**
 * The two flat row shapes the grid and the export share.
 *
 * They are shared on purpose: a spreadsheet outlives the session that made it,
 * so a column that means one thing on screen and another in the file is a lie
 * with a long shelf life. One shape, one set of keys, both surfaces.
 */

function names(seq: unknown, limit: number): string[] {
  const out: string[] = [];
  for (const x of Array.isArray(seq) ? seq : []) {
    const v = String(
      x && typeof x === 'object' ? ((x as { name?: unknown }).name ?? '') : (x ?? ''),
    ).trim();
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

function clip(value: unknown, max: number): string | null {
  const s = String(value ?? '').slice(0, max);
  return s || null;
}

/**
 * The 6-month and 12-month headcount growth figures, read in one place.
 *
 * Returned completely unconverted. Every renderer assumes these are fractions
 * (0.19 meaning 19%), a convention settled from the source rather than from a
 * live probe, because the free endpoint strips org firmographics down to
 * id/name/domain and there was nothing to probe with. So this logs loudly when a
 * value looks like it might already be a whole percent: the first fast-growing
 * company anybody looks at with a real key either confirms the convention or
 * catches the error right there.
 */
export function growthPair(o: ApolloRecord): [unknown, unknown] {
  const out: unknown[] = [];
  for (const field of [
    'organization_headcount_six_month_growth',
    'organization_headcount_twelve_month_growth',
  ]) {
    const v = o?.[field];
    out.push(v);
    const n = Number(v);
    if (Number.isFinite(n) && n === Math.trunc(n) && Math.abs(n) >= 2) {
      console.warn(
        `finder growth field ${field}=${String(v)} for ${String(o?.name ?? o?.id ?? '?')} looks like it may already be a whole percent, not the fraction every renderer assumes`,
      );
    }
  }
  return [out[0], out[1]];
}

/**
 * One company from the paid search, flattened.
 *
 * Unlike the people search this endpoint is paid and returns full records, so
 * there is real depth to show — and the grid was once throwing most of it away.
 * A company card showing headcount and nothing else reads as a thin imitation
 * when the payload it was built from already held the phone number, the address
 * and the growth trend. Still all optional: Apollo leaves plenty of these blank
 * for smaller companies.
 */
export function companyRow(o: ApolloRecord): Record<string, unknown> {
  const [growth6, growth12] = growthPair(o);
  return {
    id: o.id ?? null,
    name: o.name ?? null,
    primary_domain: o.primary_domain ?? o.domain ?? null,
    logo_url: o.logo_url ?? null,
    website_url: o.website_url ?? null,
    linkedin_url: o.linkedin_url ?? null,
    twitter_url: o.twitter_url ?? null,
    facebook_url: o.facebook_url ?? null,
    estimated_num_employees: o.estimated_num_employees ?? null,
    industry: o.industry ?? null,
    industries: names(o.industries, 4),
    founded_year: o.founded_year ?? null,
    annual_revenue: o.annual_revenue ?? null,
    revenue_printed: o.organization_revenue_printed ?? null,
    total_funding: o.total_funding ?? null,
    latest_funding_round_date: o.latest_funding_round_date ?? null,
    publicly_traded_symbol: o.publicly_traded_symbol ?? null,
    short_description: clip(o.short_description, 280),
    technologies: names(o.technology_names, 12),
    keywords: names(o.keywords, 10),
    city: o.city ?? null,
    state: o.state ?? null,
    country: o.country ?? null,
    raw_address: o.raw_address ?? null,
    phone: orgPhone(o),
    growth6,
    growth12,
    /*
     * Set only where a domain-scoped search returned this row with no domain
     * field to check against the one asked for. Kept on screen rather than
     * dropped, so the interface can say the match is unconfirmed rather than
     * implying it was verified.
     */
    domain_unconfirmed: Boolean(o.domain_unconfirmed),
  };
}

/**
 * One Apollo org as the `organization_*` fields a person row carries.
 *
 * Deliberately the same key names the person normaliser already uses, so a row
 * that came back from Apollo with firmographics attached and a row that had them
 * merged in afterwards are indistinguishable to the grid and to the export.
 */
export function employerFacts(o: ApolloRecord): Record<string, unknown> {
  const [growth6, growth12] = growthPair(o);
  return {
    // `website_url` last, because some records carry only that: a full URL where
    // a bare domain belongs still beats an employer row with no link at all.
    organization_domain: o.primary_domain ?? o.domain ?? o.website_url ?? null,
    organization_logo: o.logo_url ?? null,
    organization_industry: o.industry ?? null,
    organization_industries: names(o.industries, 4),
    organization_employees: o.estimated_num_employees ?? null,
    organization_founded: o.founded_year ?? null,
    organization_revenue: o.annual_revenue ?? null,
    organization_revenue_printed: o.organization_revenue_printed ?? null,
    organization_funding: o.total_funding ?? null,
    organization_funding_date: o.latest_funding_round_date ?? null,
    organization_ticker: o.publicly_traded_symbol ?? null,
    organization_website: o.website_url ?? null,
    organization_linkedin: o.linkedin_url ?? null,
    organization_twitter: o.twitter_url ?? null,
    organization_phone: orgPhone(o),
    organization_city: o.city ?? null,
    organization_state: o.state ?? null,
    organization_country: o.country ?? null,
    organization_address: o.raw_address ?? null,
    organization_description: clip(o.short_description, 420),
    organization_keywords: names(o.keywords, 12),
    organization_technologies: names(o.technology_names ?? o.current_technologies, 12),
    organization_growth6: growth6,
    organization_growth12: growth12,
  };
}

/**
 * The two facts where a bare `0` is a real, meaningful value.
 *
 * Flat headcount growth over the period really is 0. Everywhere else on an
 * Apollo record a bare 0 (employees, revenue, founded year) means Apollo does
 * not have the number rather than that the number is zero — so the merge treats
 * these two differently, and treating them the same silently discarded a real
 * "0%" that had been fetched and paid for, leaving the field blank instead.
 */
export const GROWTH_KEYS = ['organization_growth6', 'organization_growth12'] as const;

/** Whether a value is Apollo's way of saying it has nothing here. */
function absent(v: unknown): boolean {
  return v === null || v === undefined || v === '' || v === 0 || (Array.isArray(v) && v.length === 0);
}

/**
 * Merge one employer's facts into a person row, in place.
 *
 * Merging only into empty keys means a field the person's own record carried
 * always wins over the employer's copy, and a row keeps whatever it already had
 * if the lookup came back thin — nothing here ever blanks anything.
 */
export function mergeEmployerFacts(row: Record<string, unknown>, facts: Record<string, unknown>): void {
  for (const [key, val] of Object.entries(facts)) {
    if ((GROWTH_KEYS as readonly string[]).includes(key)) {
      if (val == null || row[key] != null) continue;
      row[key] = val;
      continue;
    }
    if (absent(val)) continue;
    if (absent(row[key])) row[key] = val;
  }
}

/**
 * One REVEALED person, flattened into the same shape a searched person has.
 *
 * Contact details are included here and nowhere else in this file, and the rule
 * is simple: reaching this function means somebody spent a credit on this
 * person, and the free search path never calls it.
 *
 * The employer fields are the quiet win. `people/bulk_match` returns the
 * employer as a full organisation record, so the firmographics the free path has
 * to buy separately are already sitting in this response — read through the same
 * mapper, so an enriched row and a searched row carry identical company fields,
 * and this copy is free because the credit was spent on the person.
 */
export function enrichedPersonRow(p: ApolloRecord): Record<string, unknown> {
  const org = (p.organization && typeof p.organization === 'object' ? p.organization : {}) as ApolloRecord;

  const history = (Array.isArray(p.employment_history) ? p.employment_history : []).filter(
    (h): h is ApolloRecord => Boolean(h) && typeof h === 'object',
  );
  const past = history.filter((h) => !h.current && h.organization_name);

  const phones: string[] = [];
  for (const raw of Array.isArray(p.phone_numbers) ? p.phone_numbers : []) {
    if (!raw || typeof raw !== 'object') continue;
    const n = raw as ApolloRecord;
    const value = String(n.sanitized_number ?? n.raw_number ?? '').trim();
    if (value && !phones.includes(value)) phones.push(value);
  }

  const facts = employerFacts(org);
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(facts)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    kept[key] = value;
  }

  return {
    id: p.id ?? null,
    full_name:
      p.name ||
      [p.first_name, p.last_name].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ') ||
      null,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    // Never carried over from the search row it replaces: this record was
    // bought, and the surname on it is the real one.
    name_masked: false,
    title: p.title ?? null,
    headline: p.headline ?? null,
    seniority: p.seniority ?? null,
    departments: (Array.isArray(p.departments) ? p.departments : []).filter(Boolean),
    email: p.email ?? null,
    email_status: p.email_status ?? null,
    phones: phones.slice(0, 3),
    photo_url: p.photo_url ?? null,
    linkedin_url: p.linkedin_url ?? null,
    twitter_url: p.twitter_url ?? null,
    city: p.city ?? null,
    state: p.state ?? null,
    country: p.country ?? null,
    past_companies: past.slice(0, 3).map((h) => h.organization_name),
    organization_id: org.id ?? p.organization_id ?? null,
    organization_name: org.name ?? null,
    ...kept,
    ...deriveRole(p.title as string),
    enriched: true,
  };
}

/**
 * Seniority and function, read off the title, added to every person row.
 *
 * Free, so it sits **outside** the paid company-detail toggle: turning off the
 * lookup you pay for should not also throw away the classification you do not.
 */
export function withDerivedRole(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, ...deriveRole(row.title as string) };
}
