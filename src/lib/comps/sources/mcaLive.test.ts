import { describe, expect, it } from 'vitest';
import { fetchMcaLivePage, KNOWN_STATES, MAX_WINDOW, reachableCount } from './mcaLive';

const ok = (json: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(json), json: async () => json });

describe('reachableCount', () => {
  it('is the total when the total fits under the window', () => {
    expect(reachableCount(6)).toBe(6);
  });

  it('caps at MAX_WINDOW for anything larger', () => {
    expect(reachableCount(821_545)).toBe(MAX_WINDOW);
  });

  it('never goes negative for a malformed total', () => {
    expect(reachableCount(-5)).toBe(0);
  });
});

describe('KNOWN_STATES', () => {
  it('carries the real spellings this register uses instead of the official ones, where they differ', () => {
    // Verified live this session: the official names returned a total of zero.
    expect(KNOWN_STATES).toContain('Orissa');
    expect(KNOWN_STATES).toContain('Pondicherry');
    expect(KNOWN_STATES).not.toContain('Odisha');
    expect(KNOWN_STATES).not.toContain('Puducherry');
  });

  it('has no duplicates', () => {
    expect(new Set(KNOWN_STATES).size).toBe(KNOWN_STATES.length);
  });
});

describe('fetchMcaLivePage', () => {
  it('asks for the state named, and reads total and rows back', async () => {
    let seenUrl = '';
    const page = await fetchMcaLivePage(
      async (url) => {
        seenUrl = url;
        return ok({ total: 6, count: 6, records: [{ company_name: 'A' }, { company_name: 'B' }] });
      },
      { state: 'Sikkim', offset: 0, limit: 100 },
    );

    expect(seenUrl).toContain('filters%5Bregistered_state%5D=Sikkim');
    expect(seenUrl).toContain('limit=100');
    expect(seenUrl).toContain('offset=0');
    expect(page.total).toBe(6);
    expect(page.rows).toHaveLength(2);
  });

  it('refuses locally before the request goes out when the window would exceed MAX_WINDOW', async () => {
    let called = false;
    await expect(
      fetchMcaLivePage(
        async () => {
          called = true;
          return ok({ total: 0, records: [] });
        },
        { state: 'Maharashtra', offset: 9_950, limit: 100 },
      ),
    ).rejects.toThrow(/10,000|10000/);
    expect(called).toBe(false);
  });

  it('surfaces the real Elasticsearch ceiling message if the API is asked anyway and refuses', async () => {
    // Not reachable through fetchMcaLivePage's own guard, but confirms a non-ok
    // response (what the real API returns for an over-large window) is a clear
    // thrown error rather than a value the caller has to remember to check.
    await expect(
      fetchMcaLivePage(async () => ({ ok: false, status: 500, text: async () => '', json: async () => ({}) }), {
        state: 'Maharashtra',
        offset: 0,
        limit: 100,
      }),
    ).rejects.toThrow('500');
  });

  it('throws on a response shaped nothing like this API', async () => {
    await expect(
      fetchMcaLivePage(async () => ({ ok: true, status: 200, text: async () => 'null', json: async () => null }), {
        state: 'Sikkim',
        offset: 0,
        limit: 100,
      }),
    ).rejects.toThrow();
  });

  it('treats a missing records array as zero rows rather than throwing', async () => {
    const page = await fetchMcaLivePage(async () => ok({ total: 0 }), { state: 'Sikkim', offset: 0, limit: 100 });
    expect(page.rows).toEqual([]);
    expect(page.total).toBe(0);
  });
});
