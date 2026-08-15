import type { Firmographics } from '../types';
import { fingerprint } from './tech';
import { readJsonLd, readMetaTags, readPeople } from './schema';

/**
 * Everything worth knowing about a company that the company already published.
 *
 * This runs automatically for every identified visitor, which is only defensible
 * because it costs nothing and asks nobody for permission it does not have: it
 * fetches a public homepage the way a browser would, with a User-Agent that says
 * plainly who is asking, and reads the structured data the company put there for
 * exactly this purpose.
 *
 * What it deliberately cannot get is headcount and revenue for a private
 * company, because those are not published anywhere. Those fields are left
 * empty rather than estimated from staff-page counts or funding rumours. An
 * honest gap on a screen is a gap somebody can go and fill; a plausible
 * invention is a number that gets quoted in a meeting.
 *
 * LinkedIn is never scraped. Not for people, not for company size, not for
 * anything.
 */

/** Bumped when the extraction below changes, so cached rows re-resolve once. */
export const ENRICH_VERSION = 1;

/** Firmographics move slowly. A dead site should be retried much sooner. */
export const POSITIVE_TTL_SECONDS = 7 * 24 * 60 * 60;
export const NEGATIVE_TTL_SECONDS = 60 * 60;

const FETCH_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 600_000;

const AGENT =
  'Mozilla/5.0 (compatible; FinanceIntelligenceBot/1.0; +https://thefinanceintelligence.com/about)';

async function fetchPage(url: string): Promise<{ html: string; headers: Headers } | null> {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': AGENT, accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return { html, headers: response.headers };
  } catch {
    return null;
  }
}

/**
 * A HEAD request to a free logo service.
 *
 * Two things for the price of one request: a 200 means somebody else's brand
 * index has heard of this domain, which is a soft corroboration that it is a
 * real company rather than a domain guessed out of an organisation name — and
 * the same URL is then a usable logo for the account card.
 */
async function findLogo(domain: string): Promise<string | null> {
  const url = `https://logo.clearbit.com/${encodeURIComponent(domain)}`;
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(2_500),
      cache: 'no-store',
    });
    return response.ok ? url : null;
  } catch {
    return null;
  }
}

/**
 * The public-filer registry, for the small minority who are one.
 *
 * Gated behind a flag because it is an extra network call that returns nothing
 * for almost every B2B website visitor — most companies are privately held.
 * That empty result is the correct answer and not a failure of the method, and
 * it is worth saying so out loud because the instinct on seeing it is to widen
 * the search until something comes back.
 *
 * The ambiguity guard matters more than the lookup: when the registry answers
 * with several possible matches rather than one, this declines to pick. Two
 * companies with similar names is precisely the situation where guessing
 * attaches one company's filings to another company's account.
 */
async function lookupRegistry(name: string): Promise<{ industry: string | null; id: string | null }> {
  if (process.env.ANALYTICS_REGISTRY_LOOKUP !== '1') return { industry: null, id: null };

  const contact = process.env.ANALYTICS_CONTACT_EMAIL;
  // EDGAR's fair-access policy requires a contact address in the User-Agent.
  // Without one, the polite thing is not to ask.
  if (!contact) return { industry: null, id: null };

  try {
    const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(name)}&type=10-K&dateb=&owner=exclude&count=10&output=atom`;
    const response = await fetch(url, {
      headers: { 'user-agent': `FinanceIntelligence/1.0 (${contact})` },
      signal: AbortSignal.timeout(4_000),
      cache: 'no-store',
    });
    if (!response.ok) return { industry: null, id: null };

    const body = await response.text();
    // More than one <entry> means the search was ambiguous. Decline rather than
    // attach the wrong company's classification to this account.
    if ((body.match(/<entry>/g) ?? []).length > 1) return { industry: null, id: null };

    return {
      industry: body.match(/assigned-sic-desc>([^<]+)</i)?.[1]?.trim() ?? null,
      id: body.match(/cik>(\d+)</i)?.[1] ?? null,
    };
  } catch {
    return { industry: null, id: null };
  }
}

export async function enrichCompanyFree(domain: string): Promise<Firmographics | null> {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!clean || !clean.includes('.')) return null;

  // HTTPS first, then plain HTTP: a company that has not got round to a
  // certificate is still a company, and its markup reads the same.
  const page = (await fetchPage(`https://${clean}`)) ?? (await fetchPage(`http://${clean}`));
  const logoUrl = await findLogo(clean);

  if (!page) {
    // Nothing was readable, but the logo service may still have vouched for the
    // brand. That alone is worth caching rather than treating as a total miss.
    return logoUrl
      ? { ...blank(clean), logoUrl }
      : null;
  }

  const structured = readJsonLd(page.html);
  const tags = readMetaTags(page.html);
  const name = structured.name ?? tags.name;

  const registry = name ? await lookupRegistry(name) : { industry: null, id: null };

  return {
    domain: clean,
    name,
    description: structured.description ?? tags.description,
    city: structured.city,
    country: structured.country,
    linkedin: structured.linkedin,
    foundedYear: structured.foundedYear,
    tech: fingerprint(page.html, page.headers),
    logoUrl,
    industry: registry.industry,
    registryId: registry.id,
    people: readPeople(page.html),
  };
}

const blank = (domain: string): Firmographics => ({
  domain,
  name: null,
  description: null,
  city: null,
  country: null,
  linkedin: null,
  foundedYear: null,
  tech: [],
  logoUrl: null,
  industry: null,
  registryId: null,
  people: [],
});
