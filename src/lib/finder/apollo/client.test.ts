import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bulkMatchPeople,
  cleanDomain,
  employeeRangesFor,
  filterByIndustry,
  mergePeopleBuckets,
  searchCompanies,
  searchPeople,
  techUid,
} from './client';
import type { SearchMeta } from './types';

/**
 * The Apollo client, and the six ways it refuses to lie.
 *
 * Every test here is about a case where the obvious implementation reports
 * something false: an unreachable API as an empty result, a bucket of
 * already-paid-for colleagues as nobody, a company Apollo declined to classify
 * as a match, a page of 23 as the end of 355. None of these look like bugs from
 * the outside, which is exactly why they need tests: each one shipped once and
 * was reported as "the search is broken" rather than as what it was.
 *
 * The happy path is barely covered on purpose. A search that works is visible
 * the moment anybody uses it.
 */

type Handler = (url: string, body: Record<string, unknown>, call: number) => Response;

let calls: { url: string; body: Record<string, unknown> }[] = [];

function stubFetch(handler: Handler) {
  let n = 0;
  vi.stubGlobal('fetch', async (url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    calls.push({ url: String(url), body });
    return handler(String(url), body, n++);
  });
}

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  calls = [];
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('not reaching Apollo', () => {
  /*
   * The one that matters most. If every attempt is rate-limited, the retry loop
   * finishes having recorded no error at all, and a function that returned an
   * empty array there would be handing a caller a fact about the world it never
   * established.
   */
  it('throws when every attempt was rate limited, rather than returning nothing', async () => {
    vi.useFakeTimers();
    stubFetch(() => reply({ error: 'rate limited' }, 429));

    const promise = searchPeople({ titles: ['CMO'] }, 'k', { strict: true });
    const settled = expect(promise).rejects.toThrow(/rate limited/i);
    await vi.runAllTimersAsync();
    await settled;

    vi.useRealTimers();
  });

  it('re-raises under strict, and only swallows without it', async () => {
    vi.useFakeTimers();
    stubFetch(() => reply({ error: 'boom' }, 500));

    const strict = expect(searchPeople({}, 'k', { strict: true })).rejects.toThrow();
    await vi.runAllTimersAsync();
    await strict;

    const lenient = searchPeople({}, 'k');
    await vi.runAllTimersAsync();
    expect(await lenient).toEqual([]);

    vi.useRealTimers();
  });

  /*
   * A 404 means the wrong path prefix for this endpoint, which is not a data
   * answer. Apollo serves the same API under two prefixes and which one answers
   * has varied, so a 404 must move to the other base rather than burn retries.
   */
  it('falls back to the other base URL on a 404 instead of reading it as no data', async () => {
    stubFetch((url) =>
      url.includes('/api/v1/')
        ? reply({ error: 'not found' }, 404)
        : reply({ people: [{ id: 'p1', first_name: 'Ada', last_name: 'Lovelace' }] }),
    );

    const rows = await searchPeople({}, 'k', { strict: true });

    expect(rows).toHaveLength(1);
    expect(calls.map((c) => c.url)).toEqual([
      expect.stringContaining('api.apollo.io/api/v1/'),
      expect.stringContaining('api.apollo.io/v1/'),
    ]);
  });
});

describe('the two response buckets', () => {
  /*
   * `contacts` are people this team has already saved and paid for. Reading only
   * `people` returned strangers from a search of a client's own domain while
   * dropping the colleagues sitting in the account.
   */
  it('merges saved contacts in, and takes their person id rather than their contact id', () => {
    const merged = mergePeopleBuckets({
      people: [{ id: 'person-1' }],
      contacts: [{ id: 'contact-9', person_id: 'person-2' }],
    });

    expect(merged.map((p) => p.id)).toEqual(['person-1', 'person-2']);
    expect(merged[1].is_saved_contact).toBe(true);
  });

  it('does not offer the same person twice when they are in both buckets', () => {
    const merged = mergePeopleBuckets({
      people: [{ id: 'person-1' }],
      contacts: [{ id: 'contact-9', person_id: 'person-1' }],
    });
    expect(merged).toHaveLength(1);
  });

  /*
   * An `accounts` row's own `id` is an ACCOUNT id. Feeding it to
   * `organization_ids` matches nothing while looking exactly like "no such
   * company", and spends a credit doing it.
   */
  it('takes an account row organisation id, and its domain from the right field', async () => {
    stubFetch(() =>
      reply({
        organizations: [],
        accounts: [{ id: 'account-9', organization_id: 'org-2', name: 'Acme', domain: 'acme.com' }],
      }),
    );

    const [row] = await searchCompanies({}, 'k', { strict: true });

    expect(row.id).toBe('org-2');
    expect(row.primary_domain).toBe('acme.com');
  });

  it('skips an account row with no organisation id rather than guessing one', async () => {
    stubFetch(() => reply({ organizations: [], accounts: [{ id: 'account-9', name: 'Acme' }] }));
    expect(await searchCompanies({}, 'k', { strict: true })).toEqual([]);
  });
});

describe('the domain filter, which Apollo does not really apply', () => {
  const page = {
    people: [
      { id: 'a', organization: { primary_domain: 'acme.com' } },
      { id: 'b', organization: { primary_domain: 'other.com' } },
      { id: 'c', organization: { name: 'Acme, probably' } },
    ],
  };

  /*
   * The third arm is the whole point. Apollo's per-row field coverage is
   * plan-dependent, so dropping domain-less rows read "Apollo didn't say" as
   * "Apollo said no", and the commonest search on the page — everyone at this
   * one company — returned zero for a domain Apollo holds hundreds of people at.
   */
  it('keeps a row Apollo gave no domain for, and flags it rather than dropping it', async () => {
    stubFetch(() => reply(page));
    const meta: SearchMeta = {};

    const rows = await searchPeople({ company_domains: ['acme.com'] }, 'k', { strict: true, meta });

    expect(rows.map((r) => r.id)).toEqual(['a', 'c']);
    expect(rows[1].employer_unconfirmed).toBe(true);
    expect(meta.company_dropped).toBe(1);
    expect(meta.company_unconfirmed).toBe(1);
  });

  it('puts the confirmed rows before the unconfirmed ones', async () => {
    stubFetch(() =>
      reply({
        people: [
          { id: 'c', organization: { name: 'no domain' } },
          { id: 'a', organization: { primary_domain: 'acme.com' } },
        ],
      }),
    );
    const rows = await searchPeople({ company_domains: ['acme.com'] }, 'k', { strict: true });
    expect(rows.map((r) => r.id)).toEqual(['a', 'c']);
  });
});

describe("Apollo's own totals", () => {
  /*
   * Two different reasons the total stops describing the rows, and one thing
   * that must survive both.
   */
  it('blanks the row total once we have removed rows, because it counted a looser match', async () => {
    stubFetch(() =>
      reply({
        pagination: { total_entries: 4000, total_pages: 40 },
        people: [
          { id: 'a', organization: { primary_domain: 'acme.com' } },
          { id: 'b', organization: { primary_domain: 'other.com' } },
        ],
      }),
    );
    const meta: SearchMeta = {};
    await searchPeople({ company_domains: ['acme.com'] }, 'k', { strict: true, meta, perPage: 25 });

    expect(meta.total_entries).toBeNull();
    // Never invalidated: it describes Apollo's paging, not our filtering, and
    // reading it as invalid is what hid "Load more".
    expect(meta.total_pages).toBe(40);
  });

  /*
   * A page left short while the total claims there is far more to come is what
   * an IGNORED filter looks like. This is how "1 of 83,000,000 matches" once
   * reached the screen beside a single-company search.
   */
  it('blanks a total that claims millions while the page came back short', async () => {
    stubFetch(() =>
      reply({
        pagination: { total_entries: 83_000_000, total_pages: 1000 },
        people: [{ id: 'a', organization: { primary_domain: 'acme.com' } }],
      }),
    );
    const meta: SearchMeta = {};
    await searchPeople({ company_domains: ['acme.com'] }, 'k', { strict: true, meta, perPage: 25 });
    expect(meta.total_entries).toBeNull();
  });

  it('keeps the total on a genuinely short last page', async () => {
    stubFetch(() =>
      reply({
        pagination: { total_entries: 26, total_pages: 2 },
        people: [{ id: 'a', organization: { primary_domain: 'acme.com' } }],
      }),
    );
    const meta: SearchMeta = {};
    await searchPeople({ company_domains: ['acme.com'] }, 'k', {
      strict: true,
      meta,
      page: 2,
      perPage: 25,
    });
    expect(meta.total_entries).toBe(26);
  });

  /*
   * "Is there another page" is a question about Apollo. Answering it from how
   * many rows survived our own checks is what stranded a reader on 23 of 355.
   */
  it('counts what Apollo served, not what survived the filter', async () => {
    stubFetch(() =>
      reply({
        people: [
          { id: 'a', organization: { primary_domain: 'acme.com' } },
          { id: 'b', organization: { primary_domain: 'other.com' } },
          { id: 'c', organization: { primary_domain: 'other.com' } },
        ],
      }),
    );
    const meta: SearchMeta = {};
    const rows = await searchPeople({ company_domains: ['acme.com'] }, 'k', { strict: true, meta });

    expect(rows).toHaveLength(1);
    expect(meta.returned).toBe(3);
  });
});

describe('the industry check, because Apollo has no industry filter', () => {
  it('matches when the request is broader than the stored value, and the reverse', () => {
    const orgs = [
      { name: 'A', industry: 'mental health care' },
      { name: 'B', industries: [{ name: 'pharmaceuticals' }] },
    ];
    expect(filterByIndustry(orgs, ['healthcare']).kept).toHaveLength(2);
  });

  /*
   * A company Apollo declined to classify is exactly the row that produced "I
   * searched for Healthcare and got a venture firm". Failing closed is the safe
   * direction.
   */
  it('drops a company Apollo returned no classification for', () => {
    const result = filterByIndustry([{ name: 'Mystery Ltd' }], ['healthcare']);
    expect(result.kept).toEqual([]);
    expect(result.dropped).toBe(1);
  });

  it('never reads the name, keywords or description, which say what a company talks about', () => {
    const orgs = [
      { name: 'Healthcare Partners LLC', industry: 'venture capital & private equity' },
    ];
    expect(filterByIndustry(orgs, ['healthcare']).kept).toEqual([]);
  });

  it('leaves every row alone when nothing was asked for', () => {
    const orgs = [{ name: 'A' }, { name: 'B' }];
    expect(filterByIndustry(orgs, []).kept).toHaveLength(2);
  });
});

describe('headcount, which Apollo can only filter in buckets', () => {
  it('sends every overlapping bucket, which is why the real number is re-checked', () => {
    // The floor is 100 and "51,100" is still sent, so companies with 51 come back.
    expect(employeeRangesFor(100, 2000)).toEqual([
      '51,100',
      '101,200',
      '201,500',
      '501,1000',
      '1001,2000',
    ]);
  });

  it('treats a one-sided bound as a real request, reaching the outermost bucket', () => {
    expect(employeeRangesFor(1000, 1e9)).toContain('10001,');
    expect(employeeRangesFor(1, 50)).toEqual(['1,10', '11,20', '21,50']);
  });
});

describe('values Apollo takes in one spelling and returns in another', () => {
  it('converts a technology display name to the uid Apollo takes', () => {
    expect(techUid('Google Analytics')).toBe('google_analytics');
    expect(techUid('WordPress.org')).toBe('wordpress_org');
  });

  it('strips every trailing slash, not just one', () => {
    expect(cleanDomain('https://www.acme.com//')).toBe('acme.com');
  });
});

describe('bulk match, where a miss and an outage look identical', () => {
  it('reports an unanswered chunk as failed rather than as nobody on file', async () => {
    // Ten ids Apollo answers for, then ten it never answers for at all.
    stubFetch((_url, body) => {
      const details = body.details as { id: string }[];
      return details[0].id.startsWith('ok')
        ? reply({ matches: details.map((d) => ({ id: d.id })) })
        : reply({}, 500);
    });

    const ids = [
      ...Array.from({ length: 10 }, (_, i) => `ok${i}`),
      ...Array.from({ length: 10 }, (_, i) => `lost${i}`),
    ];

    const failed: string[] = [];
    vi.useFakeTimers();
    const promise = bulkMatchPeople(ids, 'k', failed);
    await vi.runAllTimersAsync();
    const matched = await promise;
    vi.useRealTimers();

    expect(Object.keys(matched)).toHaveLength(10);
    // Nothing was billed for these, so a retry is free — which is only useful if
    // the caller can tell them apart from "Apollo has no record".
    expect(failed).toHaveLength(10);
    // One failing chunk must not abort the others.
    expect(matched.ok0).toBeDefined();
  });

  it('de-duplicates ids before spending a call on them', async () => {
    stubFetch((_url, body) => {
      const details = body.details as { id: string }[];
      return reply({ matches: details.map((d) => ({ id: d.id })) });
    });

    await bulkMatchPeople(['a', 'a', 'a', 'b'], 'k');

    expect(calls).toHaveLength(1);
    expect(calls[0].body.details).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('treats an unreadable response shape as no answer, not as an empty answer', async () => {
    stubFetch(() => reply({ matches: 'not a list' }));
    const failed: string[] = [];
    expect(await bulkMatchPeople(['a'], 'k', failed)).toEqual({});
    expect(failed).toEqual(['a']);
  });
});

describe('funding bounds, which have an undocumented ceiling', () => {
  /*
   * A bound above 2^31-1 returns a hard 422, not a clamp, so "companies that
   * raised over $5 billion" crashed the whole search.
   */
  it('clamps a bound Apollo cannot represent, and says that it did', async () => {
    stubFetch(() => reply({ organizations: [] }));
    const meta: SearchMeta = {};
    await searchCompanies({ total_funding_min: 5_000_000_000 }, 'k', { strict: true, meta });

    expect(calls[0].body.total_funding_range).toEqual({ min: 2_147_483_647 });
    expect(meta.funding_value_clamped).toContain('total_funding_range');
  });
});

describe('filters that are set but empty', () => {
  it('keeps a zero bound, which is a real request, and skips an absent one', async () => {
    stubFetch(() => reply({ organizations: [] }));
    await searchCompanies({ revenue_min: 0 }, 'k', { strict: true });
    expect(calls[0].body.revenue_range).toEqual({ min: 0 });

    calls = [];
    await searchCompanies({}, 'k', { strict: true });
    expect(calls[0].body).not.toHaveProperty('revenue_range');
  });

  it('does not send a technology parameter that normalised away to nothing', async () => {
    stubFetch(() => reply({ organizations: [] }));
    await searchCompanies({ technologies: ['---'] }, 'k', { strict: true });
    expect(calls[0].body).not.toHaveProperty('currently_using_any_of_technology_uids');
  });
});
