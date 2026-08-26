import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { intOrNone, readRequest, runCount, runSearch } from './search';

/**
 * The grid pipeline, and the four claims it must never make.
 *
 * That a search failed means nobody matched. That a filter was applied when the
 * data to apply it never arrived. That the page is the end of the list when only
 * our own checks made it short. That a total describes the rows on screen when
 * it counted a looser match. Each of these shipped, each looked like ordinary
 * behaviour, and each is a test below.
 */

type Reply = Record<string, unknown>;
let queue: (Reply | { status: number })[] = [];
let rpcCalls: { fn: string; p: unknown }[] = [];

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

/**
 * Just enough Supabase to run the pipeline: every read comes back empty, so
 * nothing is ever served from cache and the Apollo path is always exercised.
 */
function fakeSupabase(): SupabaseClient<Database> {
  rpcCalls = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'in', 'gt', 'eq', 'order', 'limit']) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = async () => ({ data: null, error: null });
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });

  return {
    from: () => builder,
    rpc: async (fn: string, args: { p?: unknown }) => {
      rpcCalls.push({ fn, p: args?.p });
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient<Database>;
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a search that did not happen', () => {
  /*
   * The grid once drew this identically to an empty result: "No matches. Try
   * widening the filters" — advice that cannot help, about a search that never
   * ran.
   */
  it('says the search failed rather than that nobody matched', async () => {
    vi.useFakeTimers();
    stubApollo(Array.from({ length: 8 }, () => ({ status: 500 })));

    const promise = runSearch(fakeSupabase(), 'k', readRequest({ entity: 'people' }));
    await vi.runAllTimersAsync();
    const out = await promise;
    vi.useRealTimers();

    expect(out.search_failed).toBe(true);
    expect(out.error).toMatch(/nothing was found and nothing was ruled out/);
    expect(out.results).toEqual([]);
  });

  /*
   * A non-numeric value once threw deep enough that the catch reported it as a
   * transient outage — a validation bug dressed as one, and worst on a request
   * that fails identically every retry.
   */
  it('coerces a filter value that is not a number instead of failing as an outage', async () => {
    stubApollo([{ people: [] }]);
    const out = await runSearch(
      fakeSupabase(),
      'k',
      readRequest({ entity: 'people', filters: { employee_min: '1,000' } }),
    );
    expect(out.search_failed).toBeUndefined();
  });

  it('reads a comma-formatted number the way somebody typed it', () => {
    expect(intOrNone('1,000')).toBe(1000);
    expect(intOrNone('')).toBeNull();
    expect(intOrNone('abc')).toBeNull();
    expect(intOrNone(0)).toBe(0);
  });
});

describe('an employer filter with the employer lookup switched off', () => {
  /*
   * Asking for an industry AND no company detail is a contradiction: the free
   * people search returns no industry to check. The filter that was typed wins.
   */
  it('turns the lookup back on and says so, rather than answering a different question', async () => {
    stubApollo([{ people: [] }, { organizations: [] }]);

    const out = await runSearch(
      fakeSupabase(),
      'k',
      readRequest({
        entity: 'people',
        filters: { industries: ['healthcare'], company_detail: false },
      }),
    );

    expect(out.company_detail).toBe(true);
    expect(out.industry_forced_company_detail).toBe(true);
  });

  it('leaves it off when nothing asked for the employer', async () => {
    stubApollo([{ people: [] }]);
    const out = await runSearch(
      fakeSupabase(),
      'k',
      readRequest({ entity: 'people', filters: { titles: ['CMO'], company_detail: false } }),
    );
    expect(out.company_detail).toBe(false);
    expect(out.industry_forced_company_detail).toBeUndefined();
  });
});

describe('a page our own checks made short', () => {
  /*
   * Reading the filtered count here is what hid "Load more" the moment any row
   * was removed, stranding a reader on 23 of a company's 355 people.
   */
  it('keeps Load more visible, because paging is a fact about Apollo', async () => {
    stubApollo([
      {
        pagination: { total_entries: 355, total_pages: 15 },
        people: Array.from({ length: 24 }, (_, i) => ({
          id: `p${i}`,
          title: i === 0 ? 'CMO' : 'Marketing Manager',
          organization: { id: 'o1', primary_domain: 'acme.com' },
        })),
      },
    ]);

    const out = await runSearch(
      fakeSupabase(),
      'k',
      readRequest({
        entity: 'people',
        filters: { titles: ['CMO'], include_similar_titles: false, company_detail: false },
      }),
    );

    expect(out.results).toHaveLength(1);
    expect(out.has_more).toBe(true);
  });

  /*
   * Apollo's total counted the looser match it actually ran, so it overstates
   * the answer by whatever proportion the page just removed.
   */
  it('blanks the total once anything was rejected', async () => {
    stubApollo([
      {
        pagination: { total_entries: 355, total_pages: 15 },
        people: [
          { id: 'a', title: 'CMO', organization: { id: 'o1' } },
          { id: 'b', title: 'Marketing Manager', organization: { id: 'o1' } },
        ],
      },
    ]);

    const out = await runSearch(
      fakeSupabase(),
      'k',
      readRequest({
        entity: 'people',
        filters: { titles: ['CMO'], include_similar_titles: false, company_detail: false },
      }),
    );

    expect(out.total).toBeNull();
    expect(out.rejected).toEqual({ title: 1 });
    expect(out.rejected_labels?.title).toBe('the wrong title');
  });

  /*
   * The verify pass tallies a row under EVERY reason it fails, so summing the
   * reasons double-counts. The total has to come from real row counts.
   */
  it('counts rejected rows, not rejected reasons', async () => {
    stubApollo([
      {
        organizations: [
          {
            id: 'o1',
            name: 'Wrong on two counts',
            estimated_num_employees: 5,
            annual_revenue: 1000,
          },
        ],
      },
    ]);

    const out = await runSearch(
      fakeSupabase(),
      'k',
      readRequest({
        entity: 'companies',
        filters: { employee_min: 100, revenue_min: 1_000_000 },
      }),
    );

    // One row, two reasons. Summing the reasons would report two rows removed.
    expect(out.rejected).toEqual({ employees: 1, revenue: 1 });
    expect(Object.values(out.rejected ?? {}).reduce((a, b) => a + b, 0)).toBe(2);
    expect(out.rejected_total).toBe(1);
  });

  /*
   * The industry is enforced inside the company search itself, before the
   * shared verify pass sees the row — so its count arrives by a different route
   * and is already one-to-one with a removed row.
   */
  it('folds in the rows the company search removed before the verify pass ran', async () => {
    stubApollo([{ organizations: [{ id: 'o1', name: 'A bank', industry: 'banking' }] }]);

    const out = await runSearch(
      fakeSupabase(),
      'k',
      readRequest({ entity: 'companies', filters: { industries: ['healthcare'] } }),
    );

    expect(out.rejected).toEqual({ industry: 1 });
    expect(out.rejected_total).toBe(1);
    expect(out.rejected_labels?.industry).toBe('outside the industry');
  });
});

describe('codes Apollo would reject outright', () => {
  /*
   * Real NAICS codes are six digits, so pasting one from any government source
   * is rejected by Apollo's own schema. Previously that happened without a word,
   * and an empty page read as "no such companies".
   */
  it('drops a six-digit NAICS code and names it with the rule', async () => {
    stubApollo([{ organizations: [] }]);

    const out = await runSearch(
      fakeSupabase(),
      'k',
      readRequest({ entity: 'companies', filters: { naics_codes: ['541511', '5415'] } }),
    );

    expect(out.invalid_codes?.naics.codes).toEqual(['541511']);
    expect(out.invalid_codes?.naics.hint).toMatch(/541511 becomes 54151/);
  });

  it('reports them even on a page that otherwise worked', async () => {
    stubApollo([{ organizations: [{ id: 'o1', name: 'Fine' }] }]);
    const out = await runSearch(
      fakeSupabase(),
      'k',
      readRequest({ entity: 'companies', filters: { naics_codes: ['541511'] } }),
    );
    expect(out.results).toHaveLength(1);
    expect(out.invalid_codes).toBeDefined();
  });
});

describe('the ledger', () => {
  it('bills the company tab once for a page that returned something', async () => {
    stubApollo([{ organizations: [{ id: 'o1', name: 'Acme' }] }]);
    const out = await runSearch(fakeSupabase(), 'k', readRequest({ entity: 'companies' }));

    expect(out.credits).toBe(1);
    const ledger = rpcCalls.find((c) => c.fn === 'finder_record_credits');
    // The number reported and the number written are the same variable.
    expect((ledger?.p as { credits: number }).credits).toBe(1);
  });

  it('bills nothing for a company page that came back empty', async () => {
    stubApollo([{ organizations: [] }]);
    const out = await runSearch(fakeSupabase(), 'k', readRequest({ entity: 'companies' }));
    expect(out.credits).toBeUndefined();
    expect(rpcCalls.find((c) => c.fn === 'finder_record_credits')).toBeUndefined();
  });

  it('bills nothing at all for a plain people search', async () => {
    stubApollo([{ people: [{ id: 'a' }] }]);
    const out = await runSearch(
      fakeSupabase(),
      'k',
      readRequest({ entity: 'people', filters: { company_detail: false } }),
    );
    expect(out.credits).toBeUndefined();
  });
});

describe('the free count', () => {
  /*
   * Three refusals, each with a reason. A silent null would read as "no
   * matches", which is the one thing this endpoint must not imply.
   */
  it('refuses the Companies tab, because that search bills per call', async () => {
    const out = await runCount('k', 'companies', {});
    expect(out.count).toBeNull();
    expect(out.reason).toMatch(/costs a credit/);
  });

  it('refuses to resolve a typed company name, which is a paid search', async () => {
    const out = await runCount('k', 'people', { company_domains: ['Acme Corporation'] });
    expect(out.count).toBeNull();
    expect(out.reason).toMatch(/costs a credit/);
  });

  /*
   * A domain is not refused up front the way a name is — it costs nothing to
   * send. But once the domain is enforced in code, Apollo's own total describes
   * the looser search it actually ran, so there is no honest number to report
   * and the endpoint says that rather than passing the inflated one on.
   */
  it('sends a domain freely, then declines to report a total it cannot stand behind', async () => {
    stubApollo([{ pagination: { total_entries: 412, total_pages: 20 }, people: [] }]);
    const out = await runCount('k', 'people', { company_domains: ['acme.com'] });

    expect(out.count).toBeNull();
    expect(out.reason).toMatch(/does not report a total/);
    // The call did go out: this is a refusal to quote a figure, not a refusal
    // to look, and the two read very differently on screen.
    expect(queue).toHaveLength(0);
  });

  it('reports a plain total when nothing was re-checked in code', async () => {
    stubApollo([{ pagination: { total_entries: 412, total_pages: 20 }, people: [] }]);
    const out = await runCount('k', 'people', { seniorities: ['c_suite'] });

    expect(out.count).toBe(412);
    expect(out.approx).toBe(false);
  });

  /*
   * "about", because Apollo's total counts what IT matched and the page will
   * show that many or fewer. Saying "2,400 matches" when 300 will appear is the
   * exact claim this tool exists not to make.
   */
  it('marks the figure approximate whenever a re-checked filter is set', async () => {
    stubApollo([{ pagination: { total_entries: 2400, total_pages: 100 }, people: [] }]);
    const out = await runCount('k', 'people', { industries: ['healthcare'] });
    expect(out.count).toBe(2400);
    expect(out.approx).toBe(true);
  });

  it('never forwards the employer lookup, which is the part that costs', async () => {
    stubApollo([{ pagination: { total_entries: 10, total_pages: 1 }, people: [] }]);
    const out = await runCount('k', 'people', { titles: ['CMO'], company_detail: true });
    // One call: the free search. A second would be the paid employer lookup.
    expect(out.count).toBe(10);
    expect(queue).toHaveLength(0);
  });

  it('says it could not reach Apollo rather than reporting zero', async () => {
    vi.useFakeTimers();
    stubApollo(Array.from({ length: 8 }, () => ({ status: 500 })));
    const promise = runCount('k', 'people', { titles: ['CMO'] });
    await vi.runAllTimersAsync();
    const out = await promise;
    vi.useRealTimers();

    expect(out.count).toBeNull();
    expect(out.reason).toMatch(/Could not reach Apollo/);
  });
});
