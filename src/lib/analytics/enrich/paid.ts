import type { PaidFirmographics, PersonMatch } from '../types';

/**
 * The part that costs money.
 *
 * A separate file from free.ts, with no import running in the other direction,
 * and that separation is the enforcement mechanism rather than a filing
 * preference. The rule this system is built around is that a paid lookup
 * happens because one person deliberately clicked one button about one account
 * — never on a page load, never in a loop over a list of visitors, never as a
 * side effect of the free resolution path. A rule like that is kept by making
 * the expensive function impossible to reach by accident, not by remembering.
 *
 * Every call is also written to `enrichment_spend` by the action that invokes
 * it, naming the person who caused it. If the rule is ever broken, that table
 * is where it will show.
 */

/** A week for a hit, an hour for a miss. Firmographics do not change daily. */
export const PAID_TTL_SECONDS = 7 * 24 * 60 * 60;
export const PAID_NEGATIVE_TTL_SECONDS = 60 * 60;
export const PAID_VERSION = 1;

const TIMEOUT_MS = 8_000;

export function paidEnrichmentConfigured(): boolean {
  return Boolean(process.env.APOLLO_API_KEY);
}

/**
 * Headcount as a band rather than a number.
 *
 * Providers disagree about the exact figure and all of them are stale; nobody
 * makes a different decision about a 180-person company than a 210-person one.
 * A band is the honest resolution of the underlying data.
 */
export function employeeBand(count: number | null): string | null {
  if (count == null || !Number.isFinite(count) || count <= 0) return null;
  if (count <= 10) return '1-10';
  if (count <= 50) return '11-50';
  if (count <= 200) return '51-200';
  if (count <= 500) return '201-500';
  if (count <= 1_000) return '501-1K';
  if (count <= 5_000) return '1K-5K';
  if (count <= 10_000) return '5K-10K';
  return '10K+';
}

type ApolloOrg = {
  estimated_num_employees?: unknown;
  annual_revenue?: unknown;
  industry?: unknown;
  name?: unknown;
};

type ApolloPerson = {
  name?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  title?: unknown;
  email?: unknown;
  linkedin_url?: unknown;
  organization?: { name?: unknown };
};

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

async function apollo(path: string, body: Record<string, unknown>): Promise<unknown> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return null;

  try {
    const response = await fetch(`https://api.apollo.io/api/v1/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Deeper detail on one company, and who to talk to there.
 *
 * The buying committee is fetched in the same click rather than behind a second
 * one: knowing a company is 200 people is not actionable on its own, and making
 * somebody spend a second credit to find out whose name to put in an email is
 * an interface that will simply not be used.
 */
export async function deepenCompany(domain: string): Promise<PaidFirmographics | null> {
  const enriched = (await apollo('organizations/enrich', { domain })) as
    | { organization?: ApolloOrg }
    | null;

  const org = enriched?.organization;
  if (!org) return null;

  const people = (await apollo('mixed_people/search', {
    q_organization_domains: domain,
    person_titles: ['CFO', 'Finance Director', 'Financial Controller', 'Head of Finance', 'CEO'],
    page: 1,
    per_page: 5,
  })) as { people?: ApolloPerson[] } | null;

  const employees = num(org.estimated_num_employees);

  return {
    employeeBand: employeeBand(employees),
    employees,
    revenue: num(org.annual_revenue),
    industry: str(org.industry),
    committee: (people?.people ?? [])
      .map((p) => ({
        name: str(p.name) ?? [str(p.first_name), str(p.last_name)].filter(Boolean).join(' '),
        title: str(p.title) ?? '',
        linkedin: str(p.linkedin_url),
      }))
      .filter((p) => p.name && p.title),
  };
}

/**
 * One person, matched by whatever signal is available.
 *
 * The order of preference is deliberate and privacy-shaped: a hashed email is
 * tried before a plain one wherever both exist, so a raw address never has to
 * leave our systems when working from a hashed feed. A name-and-domain pair is
 * the last resort because it is the only one of the three that can match the
 * wrong person.
 */
export async function matchPerson(signals: {
  emailSha256?: string | null;
  email?: string | null;
  name?: string | null;
  domain?: string | null;
}): Promise<PersonMatch | null> {
  const body: Record<string, unknown> = {};

  if (signals.emailSha256) body.hashed_email = signals.emailSha256;
  else if (signals.email) body.email = signals.email;
  else if (signals.name && signals.domain) {
    body.name = signals.name;
    body.domain = signals.domain;
  } else return null;

  const result = (await apollo('people/match', body)) as { person?: ApolloPerson } | null;
  const person = result?.person;
  if (!person) return null;

  const fullName =
    str(person.name) ?? [str(person.first_name), str(person.last_name)].filter(Boolean).join(' ');
  if (!fullName) return null;

  return {
    fullName,
    email: str(person.email),
    title: str(person.title),
    company: str(person.organization?.name),
    linkedin: str(person.linkedin_url),
    // High, but never 1.0: a provider match is somebody else's inference, and
    // only a first-party deterministic signal is allowed to claim certainty.
    confidence: 0.85,
    method: 'provider',
  };
}
