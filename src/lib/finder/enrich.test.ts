import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { bulkEnrich, enrichCompanyProfile, enrichPerson, matchPayload } from './enrich';
import { PERSON_SHAPE, personProfile } from './profile';
import { enrichedPersonRow } from './rows';
import { newSpend } from './store';

/**
 * The paid step, and the five ways it can quietly cost somebody money.
 *
 * Buying a record twice. Charging today for one bought last week. Reporting a
 * failed lookup as an empty database. Reporting a cap that did not bite. Sending
 * a masked surname to a matcher that will weigh it and miss. Every one of these
 * shipped in the tool this is ported from, and every one is a test below.
 */

type Reply = Record<string, unknown>;
let queue: (Reply | { status: number })[] = [];
let rpcCalls: { fn: string; p: unknown }[] = [];
let cacheRows: { apollo_id: string; payload: Reply; shape: number }[] = [];

function stubApollo(replies: (Reply | { status: number })[]) {
  queue = [...replies];
  vi.stubGlobal('fetch', async () => {
    const next = queue.shift() ?? {};
    if ('status' in next && typeof next.status === 'number' && Object.keys(next).length === 1) {
      return new Response('{}', { status: next.status });
    }
    return new Response(JSON.stringify(next), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

/** Supabase with a real, inspectable person cache and nothing else. */
function fakeSupabase(): SupabaseClient<Database> {
  rpcCalls = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'in', 'gt', 'eq', 'order', 'limit', 'delete']) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = async () => ({ data: null, error: null });
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: cacheRows, error: null });

  return {
    from: () => builder,
    rpc: async (fn: string, args: { p?: unknown }) => {
      rpcCalls.push({ fn, p: args?.p });
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient<Database>;
}

beforeEach(() => {
  cacheRows = [];
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('what a person lookup is asked to match on', () => {
  /*
   * Apollo withholds surnames on the free search as asterisks. Sending
   * "Vivek Sh***a" asks it to match somebody whose surname is punctuation: at
   * best ignored, at worst weighed, and the miss is free, silent and
   * indistinguishable from Apollo genuinely not holding the person.
   */
  it('never sends a masked surname', () => {
    const payload = matchPayload({ name: 'Vivek Sh***a', domain: 'acme.com' });
    expect(payload?.name).toBeUndefined();
    expect(payload?.first_name).toBe('Vivek');
  });

  it('drops the partial name entirely when an id is known, because the id is exact', () => {
    const payload = matchPayload({ name: 'Vivek Sh***a', apolloId: 'p1' });
    expect(payload).toEqual({ id: 'p1' });
  });

  it('sends a bare domain, because people/match will not match a full URL', () => {
    const payload = matchPayload({ name: 'Ada', domain: 'HTTPS://Acme.com/' });
    expect(payload?.domain).toBe('acme.com');
  });

  it('asks for nothing rather than everything when it has nothing to go on', () => {
    expect(matchPayload({})).toBeNull();
  });
});

describe('never buying the same person twice', () => {
  it('serves a cached record without touching Apollo or spending', async () => {
    cacheRows = [
      { apollo_id: 'p1', payload: { id: 'p1', name: 'Ada Lovelace' }, shape: PERSON_SHAPE },
    ];
    // No fetch stub at all: reaching Apollo here would throw rather than pass.
    const spend = newSpend();
    const out = await enrichPerson({
      supabase: fakeSupabase(),
      apiKey: 'k',
      apolloId: 'p1',
      spend,
    });

    expect(out.matched).toBe(true);
    expect(spend.credits).toBe(0);
  });

  it('writes what it buys under the id Apollo returned, so the next click is free', async () => {
    stubApollo([{ person: { id: 'p9', name: 'Ada Lovelace' } }]);
    const spend = newSpend();
    await enrichPerson({ supabase: fakeSupabase(), apiKey: 'k', name: 'Ada', spend });

    expect(spend.credits).toBe(1);
    const write = rpcCalls.find((c) => c.fn === 'finder_cache_person');
    const rows = (write?.p as { rows: { apollo_id: string; shape: number }[] }).rows;
    expect(rows[0].apollo_id).toBe('p9');
    // The stamp must be written by the path that reads it. Checking for one a
    // different function applied is how the original's cache returned nothing,
    // ever, while honestly reporting "cached: 0".
    expect(rows[0].shape).toBe(PERSON_SHAPE);
  });
});

describe('a miss and a failure are different facts', () => {
  it('reports an answer of nobody as a miss, with nothing spent', async () => {
    stubApollo([{ person: {} }]);
    const spend = newSpend();
    const out = await enrichPerson({ supabase: fakeSupabase(), apiKey: 'k', name: 'Nobody', spend });

    expect(out).toEqual({ matched: false });
    expect(out).not.toHaveProperty('lookup_failed');
    expect(spend.credits).toBe(0);
  });

  it('reports no answer as a failed lookup, not as an empty database', async () => {
    vi.useFakeTimers();
    stubApollo(Array.from({ length: 8 }, () => ({ status: 500 })));

    const spend = newSpend();
    const promise = enrichPerson({ supabase: fakeSupabase(), apiKey: 'k', name: 'Ada', spend });
    await vi.runAllTimersAsync();
    const out = await promise;
    vi.useRealTimers();

    expect(out).toEqual({ matched: false, lookup_failed: true });
    expect(spend.credits).toBe(0);
  });
});

describe('a company lookup tries the id AND then the domain', () => {
  /*
   * organizations/enrich is documented as domain-keyed and does not officially
   * accept an id, so the id form comes back empty for companies that enrich
   * perfectly well by domain. Written as "id if we have one, else domain", every
   * company profile ever asked for answered "Apollo has no full profile",
   * because an id was always known and the domain path was never reached.
   */
  it('falls through to the domain when the id form comes back empty', async () => {
    stubApollo([
      { organization: {} },
      { organization: { id: 'o1', name: 'Acme' } },
      { people: [] },
    ]);

    const spend = newSpend();
    const out = await enrichCompanyProfile({
      apiKey: 'k',
      apolloId: 'o1',
      domain: 'acme.com',
      spend,
    });

    expect(out.matched).toBe(true);
    expect(spend.credits).toBe(1);
  });

  it('says nobody looked when neither form answered', async () => {
    vi.useFakeTimers();
    stubApollo(Array.from({ length: 16 }, () => ({ status: 500 })));

    const spend = newSpend();
    const promise = enrichCompanyProfile({
      apiKey: 'k',
      apolloId: 'o1',
      domain: 'acme.com',
      spend,
    });
    await vi.runAllTimersAsync();
    const out = await promise;
    vi.useRealTimers();

    expect(out).toEqual({ matched: false, lookup_failed: true });
    expect(spend.credits).toBe(0);
  });
});

describe('a bulk reveal reports what it did, not what it was asked', () => {
  it('charges for what it fetched and not for what was already on file', async () => {
    cacheRows = [{ apollo_id: 'a', payload: { id: 'a', name: 'Ada' }, shape: PERSON_SHAPE }];
    stubApollo([{ matches: [{ id: 'b', name: 'Grace Hopper' }] }]);

    const spend = newSpend();
    const out = await bulkEnrich({
      supabase: fakeSupabase(),
      apiKey: 'k',
      ids: ['a', 'b'],
      spend,
    });

    expect(out.cached).toBe(1);
    expect(out.fetched).toBe(1);
    // Charging for the cached one would make the ledger climb every time
    // somebody reopened the same selection.
    expect(spend.credits).toBe(1);
    expect(Object.keys(out.profiles).sort()).toEqual(['a', 'b']);
  });

  it('does not claim rows were dropped when exactly the cap was ticked', async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `p${i}`);
    stubApollo(Array.from({ length: 5 }, () => ({ matches: [] })));

    const out = await bulkEnrich({
      supabase: fakeSupabase(),
      apiKey: 'k',
      ids,
      spend: newSpend(),
    });

    expect(out.capped).toBe(false);
  });

  it('does claim rows were dropped when they actually were', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `p${i}`);
    stubApollo(Array.from({ length: 5 }, () => ({ matches: [] })));

    const out = await bulkEnrich({
      supabase: fakeSupabase(),
      apiKey: 'k',
      ids,
      spend: newSpend(),
    });

    expect(out.capped).toBe(true);
  });

  /*
   * The reveal runs in chunks of ten and one chunk can fail alone. Without this
   * distinction a fifty-person reveal that lost a chunk reported forty profiles
   * and the other ten read as ten people Apollo has nothing on — when they are
   * exactly the ten worth asking for again, free, because a failed chunk was
   * never billed.
   */
  it('counts an unanswered chunk apart from a miss, and charges nothing for it', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `p${i}`);
    vi.useFakeTimers();
    stubApollo([
      { matches: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `Person ${i}` })) },
      ...Array.from({ length: 8 }, () => ({ status: 500 })),
    ]);

    const spend = newSpend();
    const promise = bulkEnrich({ supabase: fakeSupabase(), apiKey: 'k', ids, spend });
    await vi.runAllTimersAsync();
    const out = await promise;
    vi.useRealTimers();

    expect(out.fetched).toBe(10);
    expect(out.unreachable).toBe(1);
    expect(spend.credits).toBe(10);
    expect(out.error).toBeUndefined();
  });
});

describe('the shapes a paid record is read into', () => {
  it('keeps the real surname and marks the row as no longer masked', () => {
    const row = enrichedPersonRow({
      id: 'p1',
      first_name: 'Vivek',
      last_name: 'Sharma',
      title: 'Chief Marketing Officer',
      organization: { id: 'o1', name: 'Acme', estimated_num_employees: 400 },
    });

    expect(row.full_name).toBe('Vivek Sharma');
    expect(row.name_masked).toBe(false);
    // Free with the person: bulk_match returns the whole organisation record,
    // so the firmographics the free path pays for are already in this response.
    expect(row.organization_employees).toBe(400);
    expect(row.seniority_from_title).toBe('C-suite');
  });

  it('collects every address Apollo holds, each keeping its own status', () => {
    const profile = personProfile({
      id: 'p1',
      email: 'ada@acme.com',
      email_status: 'verified',
      contact_emails: [{ email: 'ada@acme.com', email_status: 'verified' }],
      personal_emails: ['ada@home.example'],
    });

    // The duplicate is folded, the personal one is kept and labelled.
    expect(profile.emails).toEqual([
      { email: 'ada@acme.com', status: 'verified', type: 'work' },
      { email: 'ada@home.example', status: null, type: 'personal' },
    ]);
  });

  it('prefers the dialable phone number over the scraped one', () => {
    const profile = personProfile({
      phone_numbers: [{ raw_number: '+91 (80) 4718-1000 x4', sanitized_number: '+918047181000' }],
    });
    expect(profile.phones[0].number).toBe('+918047181000');
  });

  it('separates the address asked with from the address Apollo answered with', () => {
    const profile = personProfile({ id: 'p1', email: 'new@acme.com' }, 'old@acme.com');
    expect(profile.email).toBe('old@acme.com');
    expect(profile.apollo_email).toBe('new@acme.com');
  });
});
