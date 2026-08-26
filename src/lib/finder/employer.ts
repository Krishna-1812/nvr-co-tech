import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { searchCompanies } from './apollo/client';
import type { ApolloRecord, SearchPerson } from './apollo/types';
import { employerFacts, mergeEmployerFacts } from './rows';
import { learnFrom, readFirmo, writeFirmo, type Spend } from './store';

/**
 * Describing the employers on a page of people, for one credit.
 *
 * ── Why this is affordable at all ──────────────────────────────────────────
 *
 * Apollo's free people search returns seven fields per person and nothing about
 * the employer past id, name and domain. Nearly everything anybody wants to see
 * beside a person — industry, headcount, HQ, revenue, funding, tech stack — is
 * *company* data, and every API that hands company data over is paid.
 *
 * But the company search bills per **call**, not per company. One
 * `mixed_companies/search` filtered to a page's distinct organisation ids
 * describes all of them for a single credit, so a 24-row page of people at 24
 * different employers costs exactly what a 24-row page at one employer costs.
 * Cached for 30 days on top of that, most pages in steady use spend nothing.
 *
 * ── What it never does ─────────────────────────────────────────────────────
 *
 * Never throws, and never blanks anything. A row keeps whatever it already had,
 * so the page renders exactly as before if Apollo is unreachable.
 */

/** How many distinct employers one page will pay to describe. */
const MAX_ORGS = 50;

export type EmployerStats = {
  orgs: number;
  cached: number;
  fetched: number;
  /**
   * Organisations whose lookup never got an answer.
   *
   * Present only for an outage, and it is not cosmetic: every filter that
   * depends on this data — industry, size, HQ, technology — must not tell a row
   * it failed a check that never ran. See `verifyRows`.
   */
  fetch_failed_ids?: string[];
};

export async function attachEmployerFacts(
  supabase: SupabaseClient<Database>,
  rows: SearchPerson[],
  apiKey: string,
  spend: Spend,
): Promise<EmployerStats> {
  const stats: EmployerStats = { orgs: 0, cached: 0, fetched: 0 };
  if (rows.length === 0 || !apiKey) return stats;

  const ids = [...new Set(rows.map((r) => String(r.organization_id ?? '')).filter(Boolean))].slice(
    0,
    MAX_ORGS,
  );
  if (ids.length === 0) return stats;
  stats.orgs = ids.length;

  const facts = new Map<string, Record<string, unknown>>();

  for (const [orgId, payload] of await readFirmo(supabase, ids)) {
    facts.set(orgId, payload as Record<string, unknown>);
  }
  stats.cached = facts.size;

  const missing = ids.filter((id) => !facts.has(id));
  if (missing.length > 0) {
    const fresh = new Map<string, Record<string, unknown>>();
    let orgs: ApolloRecord[] | null = null;

    try {
      /*
       * `strict: true`. The default swallows a transport failure and returns an
       * empty array, which reads here as "Apollo has nothing on these
       * companies" — and every filter depending on this fetch would then reject
       * every row on the page under a specific, false reason, for a question
       * Apollo never answered. `orgs === null` below is what tells an outage
       * apart from a genuinely empty answer.
       */
      orgs =
        (await searchCompanies(
          { organization_ids: missing, max_companies: missing.length },
          apiKey,
          { perPage: Math.min(missing.length, 100), strict: true },
        )) ?? [];

      for (const o of orgs) {
        const orgId = String(o.id ?? '');
        if (missing.includes(orgId)) fresh.set(orgId, employerFacts(o));
      }

      if (orgs.length > 0) {
        spend.credits += 1;
        // Every paid record teaches the pickers one more value Apollo genuinely
        // uses, which is the cheapest vocabulary this tool will ever get.
        await learnFrom(supabase, orgs);
      }
    } catch (error) {
      console.warn(
        `finder: employer firmographics lookup failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      if (orgs === null) stats.fetch_failed_ids = [...missing];
    }

    if (fresh.size > 0) {
      for (const [orgId, payload] of fresh) facts.set(orgId, payload);
      await writeFirmo(supabase, fresh as ReadonlyMap<string, ApolloRecord>);
    }
    stats.fetched = fresh.size;
  }

  const failed = new Set(stats.fetch_failed_ids ?? []);
  for (const r of rows) {
    const orgId = String(r.organization_id ?? '');
    /*
     * Flagged rather than silently left thin. `verifyRows` reads this to keep a
     * row it cannot check instead of rejecting it under a reason nothing
     * checked, which is the difference between "this company is the wrong size"
     * and "we never found out how big this company is".
     */
    if (failed.has(orgId)) r.employer_lookup_failed = true;

    const payload = facts.get(orgId);
    if (payload) mergeEmployerFacts(r as Record<string, unknown>, payload);
  }

  console.info(
    `finder employer firmographics: ${stats.orgs} orgs, ${stats.cached} cached, ${stats.fetched} fetched`,
  );
  return stats;
}
