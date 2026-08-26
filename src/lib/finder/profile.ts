import { orgPhone } from './fields';
import { growthPair } from './rows';
import type { ApolloRecord } from './apollo/types';

/**
 * A revealed person and their employer, in the shape the profile panel renders.
 *
 * This is the *other* shape, and the distinction is worth stating once here so
 * nobody merges the two. `rows.ts` holds the FLAT shapes — one key per column,
 * shared by the grid and the export, because a spreadsheet needs a header row.
 * This file holds the NESTED shape — a person with a company hanging off them,
 * with emails and phones as lists of objects that keep their own status — because
 * a profile panel needs to say "work email, verified" rather than print an
 * address under a header called Email and lose the qualification.
 *
 * Both are built from the same raw Apollo record, and both are built in code.
 * Nothing here summarises: a credit was spent to learn these fields, and the
 * point of paying was to see them.
 */

/**
 * The version stamp on a cached record.
 *
 * The cache holds RAW Apollo records rather than the profiles below, so it needs
 * a stamp of its own — and the stamp must be written by the same code path that
 * reads it. In the tool this is ported from it was not: the read checked for a
 * key stamped by the normaliser, which never touched anything the cache wrote,
 * so every cached row failed the gate, the cache returned nothing ever, and bulk
 * enrich re-bought people it had already paid for while honestly reporting
 * "cached: 0". Bump this only when the stored shape changes.
 */
export const PERSON_SHAPE = 1;

export type ProfileEmail = { email: string; status: string | null; type: string | null };
export type ProfilePhone = { number: string; type: string | null; status: string | null };

export type CompanyProfile = {
  name: string | null;
  domain: string | null;
  website: string | null;
  linkedin: string | null;
  facebook: string | null;
  twitter: string | null;
  logo: string | null;
  industry: string | null;
  industries: string[];
  employees: number | null;
  revenue: number | null;
  revenue_printed: string | null;
  founded: number | null;
  phone: string | null;
  hq: string | null;
  address: string | null;
  description: string | null;
  keywords: string[];
  technologies: string[];
  growth6: unknown;
  growth12: unknown;
  /** People Apollo lists at the top of this company. Only on a company lookup. */
  leadership?: ApolloRecord[];
};

export type PersonJob = {
  title: string | null;
  company: string | null;
  start: string | null;
  end: string | null;
  current: boolean;
};

export type PersonProfile = {
  matched: boolean;
  /** The shape this profile was built in, for anything that stores one. */
  sv: number;
  /** The address this lookup was made BY, when it was made by one. */
  email: string | null;
  name: string | null;
  title: string | null;
  headline: string | null;
  photo: string | null;
  seniority: string | null;
  departments: string[];
  functions: string[];
  city: string | null;
  state: string | null;
  country: string | null;
  location: string | null;
  time_zone: string | null;
  linkedin: string | null;
  twitter: string | null;
  facebook: string | null;
  apollo_id: string | null;
  /** The address APOLLO returned, which is not always the one asked with. */
  apollo_email: string | null;
  emails: ProfileEmail[];
  phones: ProfilePhone[];
  history: PersonJob[];
  company: CompanyProfile | null;
};

/** A profile that is not a profile: nothing was found, or nothing answered. */
export type Miss = { matched: false; lookup_failed?: true };

export type PersonResult = PersonProfile | Miss;
export type CompanyResult = ({ matched: true } & CompanyProfile) | Miss;

// ─── Reading a raw record ────────────────────────────────────────────────────

const text = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return s || null;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
};

function list(value: unknown, limit: number): string[] {
  const out: string[] = [];
  for (const x of Array.isArray(value) ? value : []) {
    const v = String(
      x && typeof x === 'object' ? ((x as { name?: unknown }).name ?? '') : (x ?? ''),
    ).trim();
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

const rec = (v: unknown): ApolloRecord => (v && typeof v === 'object' ? (v as ApolloRecord) : {});

/**
 * Every address on the record, de-duplicated, each keeping its own status.
 *
 * Apollo puts them in three places and they do not mean the same thing: `email`
 * is the one it considers primary, `contact_emails` carries a verification
 * status per address, and `personal_emails` is a bare list of strings. Flattened
 * into one list rather than one field, because a profile that showed only the
 * primary would silently drop the verified one sitting behind it.
 */
export function profileEmails(p: ApolloRecord): ProfileEmail[] {
  const out: ProfileEmail[] = [];
  const seen = new Set<string>();

  const add = (address: unknown, status: unknown, type: string | null) => {
    const email = String(address ?? '').trim();
    if (!email) return;
    const key = email.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ email, status: text(status), type });
  };

  add(p.email, p.email_status, 'work');
  for (const raw of Array.isArray(p.contact_emails) ? p.contact_emails : []) {
    const e = rec(raw);
    add(e.email, e.email_status ?? e.status, text(e.type) ?? 'work');
  }
  for (const raw of Array.isArray(p.personal_emails) ? p.personal_emails : []) {
    add(raw, null, 'personal');
  }
  return out;
}

/**
 * Phone numbers, preferring Apollo's sanitised form.
 *
 * The raw form is whatever was scraped — "+91 (80) 4718-1000 ext 4" — and the
 * sanitised one is dialable. Both are kept in Apollo's payload; only one of them
 * is worth putting on a card next to a call button.
 */
export function profilePhones(p: ApolloRecord): ProfilePhone[] {
  const out: ProfilePhone[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(p.phone_numbers) ? p.phone_numbers : []) {
    const n = rec(raw);
    const number = String(n.sanitized_number ?? n.raw_number ?? '').trim();
    if (!number || seen.has(number)) continue;
    seen.add(number);
    out.push({ number, type: text(n.type), status: text(n.status) });
  }
  return out;
}

/** Where somebody is, as one line, from whichever parts Apollo happens to hold. */
function place(...parts: unknown[]): string | null {
  return parts.map(text).filter(Boolean).join(', ') || null;
}

/**
 * One company, in the profile shape.
 *
 * Shares `orgPhone` and `growthPair` with the flat row builders on purpose: the
 * phone number is assembled from three possible fields and the growth figures
 * carry a convention, and having two implementations of either is how one
 * surface starts disagreeing with another about the same company.
 *
 * There is deliberately no 24-month growth figure, though Apollo returns one.
 * `growthPair` is the single place the fraction-versus-percent convention is
 * sanity-checked, and a third field read around it would be the first one to
 * quietly drift.
 */
export function orgProfile(org: ApolloRecord): CompanyProfile {
  const [growth6, growth12] = growthPair(org);
  return {
    name: text(org.name),
    domain: text(org.primary_domain ?? org.domain),
    website: text(org.website_url),
    linkedin: text(org.linkedin_url),
    facebook: text(org.facebook_url),
    twitter: text(org.twitter_url),
    logo: text(org.logo_url),
    industry: text(org.industry),
    industries: list(org.industries, 6),
    employees: num(org.estimated_num_employees),
    revenue: num(org.annual_revenue),
    revenue_printed: text(org.organization_revenue_printed),
    founded: num(org.founded_year),
    phone: orgPhone(org),
    hq: place(org.city, org.state, org.country),
    address: text(org.raw_address),
    description: text(org.short_description),
    keywords: list(org.keywords, 12),
    technologies: list(org.technology_names ?? org.current_technologies, 16),
    growth6,
    growth12,
  };
}

/**
 * One revealed person, in the profile shape.
 *
 * `lookedUpBy` is the address the caller searched with, kept apart from
 * `apollo_email`, which is the address Apollo came back with. They are usually
 * the same and occasionally are not, and collapsing them would make a profile
 * appear to confirm an address that it actually replaced.
 */
export function personProfile(p: ApolloRecord, lookedUpBy = ''): PersonProfile {
  const org = rec(p.organization);
  const name = text(p.name) ?? text([p.first_name, p.last_name].map(text).filter(Boolean).join(' '));

  const history: PersonJob[] = [];
  for (const raw of Array.isArray(p.employment_history) ? p.employment_history : []) {
    const h = rec(raw);
    const company = text(h.organization_name);
    const title = text(h.title);
    if (!company && !title) continue;
    history.push({
      title,
      company,
      start: text(h.start_date),
      end: text(h.end_date),
      current: Boolean(h.current),
    });
    if (history.length >= 10) break;
  }

  return {
    matched: true,
    sv: PERSON_SHAPE,
    email: text(lookedUpBy),
    name,
    title: text(p.title),
    headline: text(p.headline),
    photo: text(p.photo_url),
    seniority: text(p.seniority),
    departments: list(p.departments, 8),
    functions: list(p.functions, 8),
    city: text(p.city),
    state: text(p.state),
    country: text(p.country),
    location: place(p.city, p.state, p.country),
    time_zone: text(p.time_zone),
    linkedin: text(p.linkedin_url),
    twitter: text(p.twitter_url),
    facebook: text(p.facebook_url),
    apollo_id: text(p.id),
    apollo_email: text(p.email),
    emails: profileEmails(p),
    phones: profilePhones(p),
    history,
    company: org.id || org.name ? orgProfile(org) : null,
  };
}
