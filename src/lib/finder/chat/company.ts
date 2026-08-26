import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { searchCompanies, searchPeople } from '../apollo/client';
import type { ApolloRecord, SearchMeta } from '../apollo/types';
import { identifyCompany, type IdentifiedCompany } from '../llm/lookup';
import { dedupeOrgs, domainKey, isDomainShaped, normName, toChoice, type Choice } from '../resolve';
import { readResolve, writeResolve, type Spend } from '../store';

/**
 * Which company is this question about?
 *
 * Four paths, cheapest first, and the ordering is the whole design: an answer
 * that says "our records have nobody matching that" beside "1 credit used" reads
 * as paying for nothing, when what was actually bought was working out **which**
 * company to ask about.
 *
 *  1. A pick off a list already fetched — free and exact.
 *  2. The company pinned earlier in the conversation — free.
 *  3. A free probe: guess the domain, confirm it with a free people search.
 *  4. The paid company search, which itself falls back to a live web
 *     identification and a second lookup by the real company's own domain.
 */

type Client = SupabaseClient<Database>;

export type ResolvedOrg = { id: string; name: string; primary_domain: string };

/**
 * `(clean name, domain)` from whatever the parser handed back.
 *
 * The model can return a name carrying its own domain — "Position2
 * (position2.com)" when somebody picks from a disambiguation list — and
 * searching that literal string as a company name finds nothing. A parenthesised
 * or bare domain is split out and used for an exact lookup instead.
 */
export function cleanCompanyName(raw: string): { name: string; domain: string } {
  let name = String(raw ?? '').trim();
  let domain = '';

  const bracketed = /\(([^)]*\.[a-z]{2,})\)\s*$/i.exec(name);
  if (bracketed) {
    domain = bracketed[1].trim().toLowerCase();
    name = name.slice(0, bracketed.index).trim();
  } else if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(name)) {
    domain = name.toLowerCase();
  }

  return { name: name.replace(/^[\s,-]+|[\s,-]+$/g, ''), domain };
}

/**
 * Extensions guessed for a typed name with no domain of its own.
 *
 * Order is not significant: every guess rides in the **same** free search,
 * because the domain filter takes a list, and each row is checked against the
 * typed name independently. So trying more never changes which one wins, only
 * whether a non-.com company is found at all. Guessing only .com meant a real,
 * different company on .io fell through to the paid resolver every time.
 */
const PROBE_TLDS = ['.com', '.io', '.co', '.ai', '.net'];

/**
 * The organisation for a typed name, resolved **without spending a credit**.
 *
 * Answering "who is the CMO of Tealium" used to begin by paying the company
 * search purely to learn Apollo's organisation id for Tealium, even when the
 * answer that came back was "nobody on file" — which reads, fairly, as having
 * paid for nothing. But the people search is free and returns each person's
 * employer id and name, so one free search scoped to the guessed domain yields
 * the very same id the paid search was being bought for.
 *
 * The guard against answering about the wrong business is what confirms the
 * guess: Apollo's **own** employer name for people found at that domain must
 * normalise exactly equal to the typed name. "Delta" guesses delta.com and finds
 * "Delta Air Lines", which is not an exact match, so this returns null and the
 * caller falls through to the paid resolver and its disambiguation prompt.
 */
export async function probeCompanyFree(
  typedName: string,
  apiKey: string,
): Promise<ResolvedOrg | null> {
  const typed = String(typedName ?? '').trim();
  const norm = normName(typed);
  if (!typed || !norm || !apiKey) return null;

  // An input that is already a domain is resolved exactly by the normal path.
  if (isDomainShaped(typed)) return null;

  const base = norm.replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '');
  const guesses = PROBE_TLDS.map((tld) => base + tld).filter(isDomainShaped);
  if (guesses.length === 0) return null;

  let rows;
  try {
    rows = await searchPeople({ company_domains: guesses, max_people: 10 }, apiKey, {
      perPage: 10,
      strict: true,
    });
  } catch (error) {
    console.warn(
      `finder: free company probe failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return null;
  }

  for (const r of rows) {
    const orgName = String(r.organization_name ?? '').trim();
    const orgId = String(r.organization_id ?? '').trim();
    // No id means nothing downstream can scope a people search to this company,
    // so it is not a usable resolution: let the paid path run.
    if (!orgName || !orgId || normName(orgName) !== norm) continue;

    const domain =
      String(r.organization_domain ?? guesses[0])
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/+$/, '')
        .replace(/^www\./, '')
        .split('/')[0] || guesses[0];

    console.info(`finder: free probe pinned an org at ${domain} for 0 credits`);
    return { id: orgId, name: orgName, primary_domain: domain };
  }
  return null;
}

export type Resolution = { org: ApolloRecord | null; choices: Choice[] | null };

function cacheKey(name: string, domain: string): string {
  if (domain) return `d:${domain}`;
  const norm = normName(name);
  return norm ? `n:${norm}` : '';
}

/**
 * The paid resolution: at most one of `org` and `choices` is set.
 *
 * `choices` appears only when the name is **genuinely** ambiguous — still more
 * than one distinct company after deduping. It never silently guesses between
 * two equally plausible companies, and never asks somebody to choose between
 * duplicates of a single one.
 *
 * Cached for 24 hours, positive-only, under every key a later question might
 * arrive by. The one gap that leaves is a domain search that returns hits but no
 * exact match: that call did cost a credit while reporting nothing found, and a
 * repeat pays again. Accepted rather than cached, because caching a negative
 * risks telling a genuinely new company at that domain that it does not exist.
 */
export async function resolveCompanyDirect(
  supabase: Client,
  rawName: string,
  apiKey: string,
  domainHint: string,
  spend: Spend,
): Promise<Resolution> {
  const cleaned = cleanCompanyName(rawName);
  const name = cleaned.name;
  const domain = (domainHint || cleaned.domain || '').trim().toLowerCase();

  const key = cacheKey(name, domain);
  if (key) {
    const hit = await readResolve(supabase, key);
    if (hit && (hit.org || hit.choices)) {
      return { org: hit.org, choices: (hit.choices as Choice[] | null) ?? null };
    }
  }

  const search = async (filters: Record<string, unknown>): Promise<ApolloRecord[]> => {
    const meta: SearchMeta = {};
    const rows = await searchCompanies(filters, apiKey, { strict: true, meta });
    /*
     * Billed on what APOLLO served, not on what survived our own checks. A
     * domain search that returns a neighbouring company and keeps none of it
     * still cost a credit, and counting the survivors made exactly that case
     * look free. Taken per call, rather than inferred from how this function
     * ended up resolving.
     */
    if ((meta.returned ?? rows.length) > 0) spend.credits += 1;
    return dedupeOrgs(rows);
  };

  const remember = async (org: ApolloRecord | null, choices: Choice[] | null) => {
    if (!org && !choices) return { org, choices };
    const keys = new Set<string>(key ? [key] : []);
    if (org) {
      const d = domainKey(org);
      const n = normName(String(org.name ?? ''));
      if (d) keys.add(`d:${d}`);
      if (n) keys.add(`n:${n}`);
    }
    await writeResolve(supabase, [...keys], org, choices as unknown as ApolloRecord[] | null);
    return { org, choices };
  };

  if (domain) {
    const hits = await search({ domains: [domain], max_companies: 5 });
    /*
     * Only an ACTUAL domain match counts. The vendor's domain parameter is a
     * fuzzy search input rather than a strict equality filter, so taking the
     * first hit would hand back a neighbouring company that shares nothing with
     * the requested domain, silently answering about the wrong business.
     */
    const want = domain.replace(/^www\./, '');
    const exact = hits.filter((c) => domainKey(c) === want);
    if (exact.length > 0) return remember(exact[0], null);
    // Fall through to a name search: a domain the vendor does not index should
    // not dead-end while a usable company name is still in hand.
    if (!name) return remember(null, null);
  }

  if (!name) return remember(null, null);

  const candidates = await search({ name, max_companies: 8 });
  if (candidates.length === 0) return remember(null, null);
  if (candidates.length === 1) return remember(candidates[0], null);

  /*
   * An empty normalised key — a name made entirely of stripped filler, "The
   * Company Group" — must not count as an exact match, or it would equal every
   * other empty-normalising candidate and pick one at random.
   */
  const queryNorm = normName(name);
  const exact = queryNorm ? candidates.filter((c) => normName(String(c.name ?? '')) === queryNorm) : [];
  if (exact.length === 1) return remember(exact[0], null);

  const pool = (exact.length > 1 ? exact : candidates).slice(0, 5);
  return remember(null, pool.map(toChoice));
}

export type ResolveNotes = { identified?: IdentifiedCompany };

/**
 * The full resolution, with one web-assisted second chance.
 *
 * When Apollo finds nothing, the typed string is identified against the live web
 * and Apollo is asked again using the real company's own name and domain. That
 * is what turns "cmo of thoughworks" from a dead end into an answer.
 *
 * `notes` receives the identification whenever the web made one, **including**
 * when Apollo still has no record of it. The caller needs it either way: to say
 * which company it read the name as, and to research the right company when our
 * own records cannot help at all.
 */
export async function resolveCompany(
  supabase: Client,
  name: string,
  apiKey: string,
  options: { domain?: string; spend: Spend; notes?: ResolveNotes; useWeb?: boolean },
): Promise<Resolution> {
  const first = await resolveCompanyDirect(
    supabase,
    name,
    apiKey,
    options.domain ?? '',
    options.spend,
  );
  if (first.org || first.choices) return first;

  if (options.useWeb === false) return { org: null, choices: null };

  const identified = await identifyCompany(name || (options.domain ?? ''));
  if (!identified) return { org: null, choices: null };
  if (options.notes) options.notes.identified = identified;

  // Same normalisation both sides, so "Thoughtworks" identified from
  // "Thoughtworks, Ltd." is not treated as a new name worth re-searching.
  if (normName(identified.name) === normName(name) && !identified.domain) {
    return { org: null, choices: null };
  }

  console.info(
    `finder: identified "${String(name).slice(0, 60)}" as "${identified.name.slice(0, 60)}" (${identified.domain || 'no domain'})`,
  );

  return resolveCompanyDirect(
    supabase,
    identified.name,
    apiKey,
    identified.domain,
    options.spend,
  );
}

/**
 * Pins the research to the exact company that was resolved, so a common name
 * does not send it researching a different business.
 */
export function companyNote(org: { name?: unknown; primary_domain?: unknown; domain?: unknown } | null): string {
  const name = String(org?.name ?? '').trim();
  const domain = String(org?.primary_domain ?? org?.domain ?? '').trim();
  if (!name && !domain) return '';
  return `\n\nThe company in question is ${name || domain}${domain && name ? ` (${domain})` : ''}. Research that specific company.`;
}
