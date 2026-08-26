import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { searchCompanies } from './apollo/client';
import type { ApolloRecord } from './apollo/types';
import { readResolve, writeResolve, type Spend } from './store';

/**
 * Turning a typed company name into an Apollo organisation id.
 *
 * The filter bar has one "at company" box, and people put either a domain or a
 * name in it. A domain goes straight to Apollo. A name has to be resolved
 * first, because `organization_ids` is an exact, id-keyed filter while the
 * domain parameter is a fuzzy hint — so a resolved single match is a strict
 * filter rather than a guess.
 *
 * ── A name matching two companies is never resolved to one ─────────────────
 *
 * It is not OR-ed across every match either. The filter bar has no "did you
 * mean" turn the way a conversation does, so the caller is handed the
 * candidates and the person picks. Guessing between two real companies produces
 * an answer about the wrong business, which is worse than not answering.
 */

/**
 * Company name to comparison key.
 *
 * NFKC first, because Apollo stores stylised names with typographic characters —
 * Position2 is literally "Position²" in Apollo — and a raw a-z0-9 filter would
 * silently drop that superscript, turning "Position2" and "Position²" into
 * "position2" and "position": two keys that never compare equal, so an exact
 * match is missed and a single company is reported as ambiguous.
 */
export function normName(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|group|holdings|the)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalised domain for one Apollo row, used as the identity key when deduping. */
export function domainKey(c: ApolloRecord): string {
  return String(c.primary_domain ?? c.domain ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/^www\./, '');
}

/**
 * Whether the "at company" box holds a domain rather than a name.
 *
 * A domain passes straight through; a name needs resolving, and getting this
 * backwards means either paying to resolve something Apollo already understands
 * or sending a company name into a parameter that expects a hostname.
 */
export function isDomainShaped(s: string | null | undefined): boolean {
  const cleaned = String(s ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '');
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(cleaned);
}

/**
 * Collapse rows that are the same real company.
 *
 * Apollo can return one organisation more than once for a query, and the
 * net-new and already-saved buckets can each carry it. Without this the person
 * is shown several identical options to choose between, which is a
 * disambiguation prompt that cannot be answered.
 */
export function dedupeOrgs(candidates: readonly ApolloRecord[]): ApolloRecord[] {
  const out: ApolloRecord[] = [];
  const seen = new Set<string>();
  for (const c of candidates ?? []) {
    const key = domainKey(c) || normName(String(c.name ?? ''));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** One candidate, in the shape every disambiguation surface renders. */
export type Choice = {
  name: string | null;
  domain: string;
  id: string | null;
  logo: string | null;
  hq: string;
};

export function toChoice(c: ApolloRecord): Choice {
  return {
    name: (c.name as string | null) ?? null,
    domain: domainKey(c),
    id: (c.id as string | null) ?? null,
    logo: (c.logo_url as string | null) ?? null,
    hq: [c.city, c.state, c.country].filter(Boolean).map(String).join(', '),
  };
}

export type NameResolution =
  | { found: false }
  | { found: true; orgId: string; orgName: string | null; choices: null }
  | { found: true; orgId: null; orgName: null; choices: Choice[] };

/**
 * A plain company name to an organisation id, or to the candidates to choose
 * between.
 *
 * Cached for 24 hours under the key that was typed. Without that, paging a
 * name-filtered search billed a fresh company-search credit on every "Load
 * more" — once per page instead of once per distinct name — on what is
 * otherwise a free people search.
 *
 * Only a **found** resolution is cached. A no-match search costs zero credits,
 * because the company endpoint only bills a call that returns at least one row,
 * so there is nothing to save by caching "not found" and only staleness to risk
 * if the name is indexed later.
 */
export async function resolveCompanyName(
  supabase: SupabaseClient<Database>,
  name: string,
  apiKey: string,
  spend: Spend,
): Promise<NameResolution> {
  const key = `n:${normName(name) || String(name ?? '').trim().toLowerCase()}`;
  if (key === 'n:') return { found: false };

  const cached = await readResolve(supabase, key);
  if (cached) {
    if (cached.org?.id) {
      return {
        found: true,
        orgId: String(cached.org.id),
        orgName: (cached.org.name as string | null) ?? null,
        choices: null,
      };
    }
    if (cached.choices && cached.choices.length > 0) {
      return { found: true, orgId: null, orgName: null, choices: cached.choices as Choice[] };
    }
  }

  const rows = dedupeOrgs(
    await searchCompanies({ name, max_companies: 10 }, apiKey, { strict: true }).then((r) => {
      // Billed on a call that returned something, counted at the call site
      // rather than inferred afterwards.
      if (r.length > 0) spend.credits += 1;
      return r;
    }),
  );

  if (rows.length === 0) return { found: false };

  if (rows.length === 1) {
    const orgId = String(rows[0].id ?? '');
    const orgName = (rows[0].name as string | null) ?? null;
    if (!orgId) return { found: false };
    // Written under the typed key AND the resolved company's own domain and
    // name, so a later search naming it a different way still hits.
    await writeResolve(
      supabase,
      [key, `d:${domainKey(rows[0])}`, `n:${normName(orgName)}`].filter((k) => !k.endsWith(':')),
      rows[0],
      null,
    );
    return { found: true, orgId, orgName, choices: null };
  }

  const choices = rows.map(toChoice);
  await writeResolve(supabase, [key], null, choices as unknown as ApolloRecord[]);
  return { found: true, orgId: null, orgName: null, choices };
}
