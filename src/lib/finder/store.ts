import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { ApolloRecord } from './apollo/types';

/**
 * Everything Contact Finder keeps, and the one rule all of it obeys.
 *
 * ── Cache positives, never negatives ───────────────────────────────────────
 *
 * A company search that returns nothing costs zero credits. So there is no
 * credit to save by caching a miss, only staleness to risk — and the staleness
 * is the expensive kind, because it tells a genuinely new company that it does
 * not exist. Every cache below is therefore positive-only, and the one place
 * that costs something (a domain search that returns hits but no exact match
 * does spend a credit and reports nothing found) is accepted rather than cached,
 * for exactly that reason.
 *
 * ── Where the cache actually lives ─────────────────────────────────────────
 *
 * The tool this is ported from ran as one long-lived process and put a
 * dictionary in front of Postgres, which paid for itself. Here every request may
 * land on a different instance, so an in-process tier only helps within a single
 * invocation — Postgres is the cache, not the second tier. That is a real
 * difference in what these functions are worth, and it is the reason there is no
 * memory tier here at all rather than a decorative one.
 */

type Client = SupabaseClient<Database>;

/**
 * The house `p jsonb` RPCs are not in the generated Functions map's argument
 * shapes, so calls are cast the same way `makeRpcWriter` does in
 * lib/comps/ingest/writers.ts.
 */
type RpcName = Parameters<Client['rpc']>[0];

/**
 * A write that failing must never break the read that follows it.
 *
 * Every one of these is a cache or a record of something that has already
 * happened. Losing one costs a little money next time; turning it into a 500
 * would take an answer away from somebody who has already paid for it.
 */
async function quietRpc(supabase: Client, fn: string, p: unknown): Promise<void> {
  try {
    const { error } = await supabase.rpc(fn as RpcName, { p } as never);
    if (error) console.warn(`finder: ${fn} failed: ${error.message}`);
  } catch (error) {
    console.warn(`finder: ${fn} threw: ${error instanceof Error ? error.message : 'unknown'}`);
  }
}

// ─── Employer firmographics, 30 days ─────────────────────────────────────────

const FIRMO_TTL_DAYS = 30;

/** Cached firmographics for a page's organisations, keyed by Apollo org id. */
export async function readFirmo(
  supabase: Client,
  orgIds: readonly string[],
): Promise<Map<string, ApolloRecord>> {
  const out = new Map<string, ApolloRecord>();
  const ids = [...new Set(orgIds)].filter(Boolean);
  if (ids.length === 0) return out;

  const cutoff = new Date(Date.now() - FIRMO_TTL_DAYS * 86_400_000).toISOString();

  // One query for the whole page. Per-row lookups turned a 24-person page into
  // 24 round trips for data that is fetched from Apollo in a single call.
  const { data, error } = await supabase
    .from('finder_org_firmo')
    .select('org_id, payload')
    .in('org_id', ids)
    .gt('updated_at', cutoff);

  if (error) {
    console.warn(`finder: firmo cache read failed: ${error.message}`);
    return out;
  }

  for (const row of data ?? []) {
    if (row.payload && typeof row.payload === 'object') {
      out.set(row.org_id, row.payload as ApolloRecord);
    }
  }
  return out;
}

export async function writeFirmo(
  supabase: Client,
  facts: ReadonlyMap<string, ApolloRecord>,
): Promise<void> {
  if (facts.size === 0) return;
  const rows = [...facts].map(([org_id, payload]) => ({ org_id, payload }));
  await quietRpc(supabase, 'finder_cache_org_firmo', { rows });
}

// ─── Learned vocabulary ──────────────────────────────────────────────────────

/**
 * A page of Apollo records can carry over a thousand technology names, and the
 * first search after a deploy would otherwise do a thousand inserts inside one
 * request. Whatever is left arrives on the next search — this only fills a
 * dropdown, so it has all the time in the world.
 */
const VOCAB_WRITE_MAX = 120;

/** Everything worth learning from a page of Apollo company records. */
export async function learnFrom(supabase: Client, orgs: readonly ApolloRecord[]): Promise<void> {
  const industries = new Set<string>();
  const vocab: { kind: 'technology' | 'location'; value: string }[] = [];
  const seenVocab = new Set<string>();

  const addVocab = (kind: 'technology' | 'location', value: string) => {
    const v = value.trim();
    if (!v) return;
    const key = `${kind}:${v.toLowerCase()}`;
    if (seenVocab.has(key)) return;
    seenVocab.add(key);
    vocab.push({ kind, value: v });
  };

  for (const org of orgs) {
    const industry = typeof org.industry === 'string' ? org.industry.trim() : '';
    if (industry) industries.add(industry);
    for (const raw of Array.isArray(org.industries) ? org.industries : []) {
      const name =
        typeof raw === 'string'
          ? raw
          : raw && typeof raw === 'object'
            ? String((raw as { name?: unknown }).name ?? '')
            : '';
      if (name.trim()) industries.add(name.trim());
    }

    for (const t of Array.isArray(org.technology_names) ? org.technology_names : []) {
      if (typeof t === 'string') addVocab('technology', t);
    }
    for (const t of Array.isArray(org.technologies) ? org.technologies : []) {
      if (typeof t === 'string') addVocab('technology', t);
    }

    /*
     * Recorded at all three levels the picker offers, because a person typing
     * "Texas" and a person typing "Austin, Texas" are both asking a question the
     * picker should be able to complete.
     */
    const city = String(org.city ?? '').trim();
    const state = String(org.state ?? '').trim();
    const country = String(org.country ?? '').trim();
    if (country) addVocab('location', country);
    if (state && country) addVocab('location', `${state}, ${country}`);
    if (city && state) addVocab('location', `${city}, ${state}`);
  }

  await Promise.all([
    industries.size > 0
      ? quietRpc(supabase, 'finder_learn_industries', {
          values: [...industries].slice(0, VOCAB_WRITE_MAX),
        })
      : Promise.resolve(),
    vocab.length > 0
      ? quietRpc(supabase, 'finder_learn_vocab', { values: vocab.slice(0, VOCAB_WRITE_MAX) })
      : Promise.resolve(),
  ]);
}

/** Learned industry strings, most-seen first. */
export async function readLearnedIndustries(supabase: Client): Promise<string[]> {
  const { data, error } = await supabase
    .from('finder_industry_seen')
    .select('value')
    .order('hits', { ascending: false })
    .limit(2000);

  if (error) {
    console.warn(`finder: learned industries read failed: ${error.message}`);
    return [];
  }
  return (data ?? []).map((r) => r.value);
}

/** Learned technology or place strings, most-seen first. */
export async function readLearnedVocab(
  supabase: Client,
  kind: 'technology' | 'location',
): Promise<string[]> {
  const { data, error } = await supabase
    .from('finder_vocab_seen')
    .select('value')
    .eq('kind', kind)
    .order('hits', { ascending: false })
    .limit(4000);

  if (error) {
    console.warn(`finder: learned vocab read failed: ${error.message}`);
    return [];
  }
  return (data ?? []).map((r) => r.value);
}

// ─── The credit ledger ───────────────────────────────────────────────────────

/**
 * The running total for one request, threaded through every function that can
 * bill and incremented at each call site.
 *
 * Never inferred afterwards from what came back, which is the point: the number
 * reported to the browser and the number written to the ledger are the same
 * variable, so the figure in the header and the figure actually spent cannot
 * drift apart.
 */
export type Spend = { credits: number };

export const newSpend = (): Spend => ({ credits: 0 });

/**
 * Record what was spent.
 *
 * A zero is never written: a cache hit is not a purchase, and rows of zeroes
 * would make the ledger read as activity rather than as spend. The whole thing
 * is best-effort, because it runs *after* the credit is gone and immediately
 * before the reply that reports it — a failure here would turn a purchase
 * somebody already paid for into a 500.
 */
export async function recordSpend(
  supabase: Client,
  action: string,
  credits: number,
): Promise<void> {
  if (credits <= 0) return;
  await quietRpc(supabase, 'finder_record_credits', { action, credits });
}

// ─── Company resolution, 24 hours ────────────────────────────────────────────

const RESOLVE_TTL_HOURS = 24;

export type ResolveCacheHit = { org: ApolloRecord | null; choices: ApolloRecord[] | null };

export async function readResolve(supabase: Client, key: string): Promise<ResolveCacheHit | null> {
  if (!key) return null;
  const cutoff = new Date(Date.now() - RESOLVE_TTL_HOURS * 3_600_000).toISOString();

  const { data, error } = await supabase
    .from('finder_org_resolve')
    .select('org, choices')
    .eq('cache_key', key)
    .gt('updated_at', cutoff)
    .maybeSingle();

  if (error || !data) return null;
  return {
    org: data.org && typeof data.org === 'object' ? (data.org as ApolloRecord) : null,
    choices: Array.isArray(data.choices) ? (data.choices as ApolloRecord[]) : null,
  };
}

/**
 * Written under every key a later question might arrive by: the query that was
 * searched, the resolved company's own domain, and its normalised name. A
 * question naming the same company a different way then still hits.
 */
export async function writeResolve(
  supabase: Client,
  keys: readonly string[],
  org: ApolloRecord | null,
  choices: readonly ApolloRecord[] | null,
): Promise<void> {
  const clean = [...new Set(keys)].filter(Boolean);
  if (clean.length === 0) return;
  await quietRpc(supabase, 'finder_cache_org_resolve', { keys: clean, org, choices });
}
