import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import {
  bulkMatchPeople,
  enrichCompany,
  enrichCompanyById,
  getLeadership,
  matchPerson,
} from './apollo/client';
import type { ApolloRecord } from './apollo/types';
import {
  PERSON_SHAPE,
  orgProfile,
  personProfile,
  type CompanyProfile,
  type CompanyResult,
  type PersonResult,
} from './profile';
import { enrichedPersonRow } from './rows';
import type { Spend } from './store';

/**
 * The paid step.
 *
 * Everything else in this tool is either free or costs one credit for a whole
 * page. This is the part that costs a credit **per person**, so it is the part
 * that never happens on its own: search results are free and complete on their
 * own terms, and a reveal only ever runs on rows somebody explicitly asked for.
 *
 * Three rules run through all of it.
 *
 * **Never buy the same record twice.** Every reveal writes to a cache keyed by
 * Apollo person id and every reveal reads it first, whichever button did the
 * buying — so revealing somebody in the grid and then opening their profile is
 * one credit, not two.
 *
 * **Count what was fetched, never what was asked for.** The ledger and the
 * response both report the number of records that actually came back from
 * Apollo. Charging today for rows an earlier click paid for would make the
 * ledger climb every time somebody reopened the same selection.
 *
 * **Say which kind of nothing happened.** A miss is free and means Apollo has no
 * such record. A failure is also free and means nobody looked. Rendering those
 * identically is how an interface ends up making a claim about a vendor's
 * database out of a request that timed out.
 */

type Client = SupabaseClient<Database>;
type RpcName = Parameters<Client['rpc']>[0];

/**
 * The ceiling on one bulk reveal.
 *
 * This is the one place somebody can spend a lot in a single click, and the
 * whole platform shares one finite pool. Fifty is a couple of pages of results:
 * enough to be useful in one go, small enough that a slip costs an afternoon's
 * budget rather than the month's.
 */
export const BULK_CAP = 50;

/** A record bought this long ago is bought again. */
const PERSON_TTL_DAYS = 90;

// ─── The by-id cache ─────────────────────────────────────────────────────────

/**
 * Records already paid for, by Apollo person id.
 *
 * Gated on the shape stamp as well as the date, and the stamp is written by
 * `writePersonCache` — the same path that reads it here. That is the whole
 * lesson of the cache this replaces, which checked for a stamp applied by a
 * function that never touched these rows: every row failed the gate, the cache
 * returned nothing ever, and bulk enrich re-bought people it already owned while
 * honestly reporting "cached: 0".
 */
export async function readPersonCache(
  supabase: Client,
  ids: readonly string[],
): Promise<Record<string, ApolloRecord>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const out: Record<string, ApolloRecord> = {};
  if (unique.length === 0) return out;

  const cutoff = new Date(Date.now() - PERSON_TTL_DAYS * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('finder_person_enrichment')
    .select('apollo_id, payload, shape')
    .in('apollo_id', unique)
    .eq('shape', PERSON_SHAPE)
    .gt('updated_at', cutoff);

  if (error) {
    // A cache that cannot be read costs money, never correctness: the caller
    // simply buys what it would have found here.
    console.warn(`finder: person cache read failed: ${error.message}`);
    return out;
  }

  for (const row of data ?? []) {
    if (row.payload && typeof row.payload === 'object') {
      out[row.apollo_id] = row.payload as ApolloRecord;
    }
  }
  return out;
}

export async function writePersonCache(
  supabase: Client,
  records: Readonly<Record<string, ApolloRecord>>,
): Promise<void> {
  const rows = Object.entries(records)
    .filter(([id, payload]) => id && payload && typeof payload === 'object')
    .map(([apollo_id, payload]) => ({ apollo_id, payload, shape: PERSON_SHAPE }));

  if (rows.length === 0) return;

  try {
    const { error } = await supabase.rpc('finder_cache_person' as RpcName, {
      p: { rows },
    } as never);
    if (error) console.warn(`finder: person cache write failed: ${error.message}`);
  } catch (error) {
    console.warn(
      `finder: person cache write threw: ${error instanceof Error ? error.message : 'unknown'}`,
    );
  }
}

// ─── One person ──────────────────────────────────────────────────────────────

export type PersonRequest = {
  supabase: Client;
  apiKey: string;
  name?: string;
  domain?: string;
  apolloId?: string;
  email?: string;
  spend: Spend;
};

/**
 * Build what Apollo should be asked to match on.
 *
 * Exported because the decisions in it are the interesting part of this file and
 * they are worth testing directly rather than through a fetch.
 *
 * The masked-surname handling is the subtle one. Apollo withholds surnames on
 * the free search as asterisks — "Vivek Sh***a" — and sending that as an
 * identifying detail asks Apollo to match somebody whose surname is punctuation.
 * At best it is ignored; at worst it is weighed and the match fails, which costs
 * nothing and is indistinguishable from Apollo genuinely not holding the person.
 * So only the unmasked tokens go, as `first_name`, which is Apollo's own field
 * for exactly this — and they are dropped entirely when an id is present,
 * because the id is already exact and a partial name can only dilute it.
 */
export function matchPayload(req: {
  name?: string;
  domain?: string;
  apolloId?: string;
  email?: string;
}): Record<string, unknown> | null {
  const payload: Record<string, unknown> = {};
  const apolloId = (req.apolloId ?? '').trim();
  let name = (req.name ?? '').trim();

  if (apolloId) payload.id = apolloId;

  if (name.includes('*')) {
    const clean = name
      .split(/\s+/)
      .filter((t) => !t.includes('*'))
      .join(' ');
    name = '';
    if (clean && !apolloId) payload.first_name = clean;
  }
  if (name) payload.name = name;

  const email = (req.email ?? '').trim();
  if (email) payload.email = email;

  const domain = (req.domain ?? '').trim();
  if (domain) {
    /*
     * `organization_domain` on a search row can carry a full website URL, and
     * people/match will not match "https://acme.com".
     *
     * The `i` flag is a deliberate correction rather than a port: the original
     * stripped the scheme case-sensitively and lowercased afterwards, so an
     * uppercase "HTTPS://" survived into the payload and the match failed for
     * free and in silence — the worst shape a bug can take here.
     */
    payload.domain = domain.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

/**
 * One person, revealed.
 *
 * Costs one credit on a match. A miss and a failure are both free, and are
 * reported as different things.
 *
 * ── One deliberate departure ───────────────────────────────────────────────
 *
 * A lookup by EMAIL always pays, even for somebody already in the cache. The
 * cache is keyed by Apollo person id, and finding a row by the address inside
 * its stored record means either a scan of the whole table or a pattern match —
 * and `_` is both a wildcard and an extremely common character in an email
 * address, so a pattern match could return a different person's paid record.
 * Paying twice is the cheaper mistake. Every path the interface actually offers
 * carries an Apollo id, so this affects nothing a button can reach.
 */
export async function enrichPerson(req: PersonRequest): Promise<PersonResult> {
  const apolloId = (req.apolloId ?? '').trim();

  if (apolloId) {
    const cached = (await readPersonCache(req.supabase, [apolloId]))[apolloId];
    if (cached) return personProfile(cached, String(cached.email ?? ''));
  }

  const payload = matchPayload(req);
  if (!payload) return { matched: false };

  let person: ApolloRecord | null;
  try {
    person = await matchPerson(payload, req.apiKey);
  } catch (error) {
    // An id and a domain in the log line, never a name or an address.
    console.warn(
      `finder: person enrich failed apollo_id=${apolloId || '(none)'} domain=${String(payload.domain ?? '(none)')}: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return { matched: false, lookup_failed: true };
  }

  if (!person) return { matched: false };

  // A match is what Apollo bills for; a miss costs nothing.
  req.spend.credits += 1;

  // Keyed by the id Apollo returned when there is one, so a person found by
  // name lands in the same cache the next click by id will read.
  const id = String(person.id ?? apolloId ?? '').trim();
  if (id) await writePersonCache(req.supabase, { [id]: person });

  return personProfile(person, String(person.email ?? req.email ?? ''));
}

// ─── One company ─────────────────────────────────────────────────────────────

export type CompanyRequest = {
  apiKey: string;
  domain?: string;
  apolloId?: string;
  spend: Spend;
};

/**
 * One company, in full, plus the people Apollo lists at the top of it.
 *
 * The id is tried first because it is exact, and then the domain — **not one or
 * the other.** `organizations/enrich` is documented as domain-keyed and does not
 * officially accept an id, so the id form legitimately comes back empty for a
 * company that enriches perfectly well by domain. Written as "id if we have one,
 * else domain", this answered "Apollo has no full profile for that company" for
 * every company ever asked about, because an id was always known and the domain
 * path was never reached.
 */
export async function enrichCompanyProfile(req: CompanyRequest): Promise<CompanyResult> {
  const apolloId = (req.apolloId ?? '').trim();
  const domain = (req.domain ?? '').trim();
  const failure = { failed: false };

  let org: ApolloRecord = {};
  if (apolloId) org = await enrichCompanyById(apolloId, req.apiKey, failure);
  if (!(org.id || org.name) && domain) org = await enrichCompany(domain, req.apiKey, failure);

  if (!(org.id || org.name)) {
    // "Nobody answered" and "Apollo has nothing" are the same empty object from
    // the client, which is why the out-parameter above exists.
    return failure.failed ? { matched: false, lookup_failed: true } : { matched: false };
  }

  req.spend.credits += 1;

  const profile: { matched: true } & CompanyProfile = { matched: true, ...orgProfile(org) };

  const orgId = String(org.id ?? '').trim();
  if (orgId) {
    try {
      // Free: this is the people search, which bills nothing. A company profile
      // without a single name on it is a page of figures nobody can act on.
      profile.leadership = await getLeadership(orgId, req.apiKey, 8);
    } catch (error) {
      console.warn(
        `finder: leadership lookup failed org_id=${orgId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      profile.leadership = [];
    }
  }

  return profile;
}

// ─── Many people at once ─────────────────────────────────────────────────────

export type BulkResult = {
  /** The revealed rows, in the flat grid shape, keyed by Apollo person id. */
  profiles: Record<string, Record<string, unknown>>;
  /** Records bought on this click. This is what the ledger records. */
  fetched: number;
  /** Records an earlier click already paid for. */
  cached: number;
  /** True only when ids were actually dropped, never merely when the cap was met. */
  capped: boolean;
  /** Ids nobody could look up. Neither revealed nor ruled out, and free to retry. */
  unreachable: number;
  error?: string;
};

/**
 * Reveal a chosen set of people in one batch.
 *
 * `capped` is true only when rows were genuinely dropped. Comparing the
 * truncated length against the cap reported "only the first 50 were enriched"
 * for a selection of exactly fifty, where nothing had been left out.
 *
 * `unreachable` is not folded into either count. The reveal runs in chunks of
 * ten and a chunk can fail on its own, so without this a fifty-person reveal
 * that lost a chunk reported forty profiles and the other ten read as ten people
 * Apollo has nothing on. They are the opposite: the ones worth asking for again,
 * and free to, because a chunk that failed was never billed.
 */
export async function bulkEnrich(req: {
  supabase: Client;
  apiKey: string;
  ids: readonly string[];
  spend: Spend;
}): Promise<BulkResult> {
  const raw = req.ids.map((i) => String(i ?? '').trim()).filter(Boolean);
  // Keeps the order somebody ticked them in, and de-duplicates.
  const unique = [...new Set(raw)];
  const ids = unique.slice(0, BULK_CAP);
  const capped = unique.length > BULK_CAP;

  if (ids.length === 0) {
    return { profiles: {}, fetched: 0, cached: 0, capped: false, unreachable: 0 };
  }

  const cached = await readPersonCache(req.supabase, ids);
  const missing = ids.filter((id) => !(id in cached));

  let fetched: Record<string, ApolloRecord> = {};
  const unreachable: string[] = [];

  if (missing.length > 0) {
    try {
      fetched = await bulkMatchPeople(missing, req.apiKey, unreachable);
      if (Object.keys(fetched).length > 0) await writePersonCache(req.supabase, fetched);
    } catch (error) {
      console.warn(
        `finder: bulk enrich failed for ${missing.length} ids: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      unreachable.push(...missing);
      if (Object.keys(cached).length === 0) {
        return {
          profiles: {},
          fetched: 0,
          cached: 0,
          capped,
          unreachable: missing.length,
          error:
            'Apollo did not answer, so nobody was revealed and no credits were spent. Try again in a moment.',
        };
      }
    }
  }

  const merged: Record<string, ApolloRecord> = { ...cached, ...fetched };
  const profiles: Record<string, Record<string, unknown>> = {};
  for (const [id, record] of Object.entries(merged)) profiles[id] = enrichedPersonRow(record);

  const fetchedCount = Object.keys(fetched).length;
  req.spend.credits += fetchedCount;

  return {
    profiles,
    fetched: fetchedCount,
    cached: Object.keys(cached).length,
    capped,
    unreachable: unreachable.length,
  };
}
