import { describe, expect, it } from 'vitest';
import type { Fetcher } from '../sources/types';
import { ingestEdgarCiks, ingestMcaRows, ingestNseSymbols } from './passes';
import { makeRpcWriter, MemoryWriter } from './writers';
import type { Clock } from './types';

const NOWAIT: Clock = { now: () => 0, sleep: async () => undefined };

function response(json: unknown, over: Partial<{ ok: boolean; status: number; setCookie: string | null }> = {}) {
  const { ok = true, status = 200, setCookie = null } = over;
  return {
    ok,
    status,
    text: async () => JSON.stringify(json),
    json: async () => json,
    headers: { get: (name: string) => (name.toLowerCase() === 'set-cookie' ? setCookie : null) },
  };
}

describe('ingestNseSymbols', () => {
  const quote = {
    info: { companyName: 'Example Logistics Limited', isin: 'INE000A01001' },
    marketDeptOrderBook: { tradeInfo: { totalMarketCap: 45_000 } },
    priceInfo: { lastPrice: 100 },
    metadata: { lastUpdateTime: '22-Aug-2026 15:30:00' },
  };

  const fetcher: Fetcher = async (url) => {
    if (!url.includes('/api/')) return response({}, { setCookie: 'nsit=abc; Path=/' });
    return response(quote);
  };

  it('shakes hands once for the whole pass, not once per symbol', async () => {
    /*
     * The cookie is a cookie. The handshake is two requests — home page then
     * quote page — and it happens once however many symbols follow. Per symbol
     * it would triple the request count against the tightest rate limit of any
     * source here.
     */
    const urls: string[] = [];
    const counting: Fetcher = async (url) => {
      urls.push(url);
      return fetcher(url);
    };

    await ingestNseSymbols(counting, ['A', 'B', 'C'], {
      writer: new MemoryWriter(),
      clock: NOWAIT,
      asOf: '2026-08-21',
    });

    expect(urls.filter((u) => !u.includes('/api/'))).toHaveLength(2);
    expect(urls.filter((u) => u.includes('/api/'))).toHaveLength(6); // two per symbol
  });

  it('writes a company and a quote per symbol', async () => {
    const writer = new MemoryWriter();
    const report = await ingestNseSymbols(fetcher, ['A', 'B'], {
      writer,
      clock: NOWAIT,
      asOf: '2026-08-21',
    });

    expect(report.companiesWritten).toBe(2);
    expect(report.quotesWritten).toBe(2);
    expect(writer.quotes[0].record.market_cap).toBe(4_500_000_000);
  });

  it('attempts nothing when the handshake yields no cookies, and says why', async () => {
    /*
     * The most likely failure in production: these run from bom1, which is a
     * datacentre, and NSE challenges datacentre ranges however polite the client
     * is. One skip beats a thousand refused requests.
     */
    const report = await ingestNseSymbols(
      async () => response({}, { setCookie: null }),
      Array.from({ length: 500 }, (_, i) => `S${i}`),
      { writer: new MemoryWriter(), clock: NOWAIT, asOf: '2026-08-21' },
    );

    expect(report.requests).toBe(1);
    expect(report.requested).toBe(500);
    expect(report.companiesWritten).toBe(0);
    expect(report.skipped[0].reason).toContain('no cookies from the home page');
    expect(report.tally).toHaveLength(1);
  });
});

describe('ingestEdgarCiks', () => {
  function facts(cik: number, end: string, revenue: number) {
    const [y, m, d] = end.split('-').map(Number);
    const start = new Date(Date.UTC(y - 1, m - 1, d + 1)).toISOString().slice(0, 10);
    return {
      cik,
      entityName: `Filer ${cik}`,
      facts: {
        'us-gaap': {
          Revenues: {
            units: {
              USD: [{ start, end, val: revenue, form: '10-K', filed: `${y}-11-01`, accn: 'a' }],
            },
          },
        },
      },
    };
  }

  it('writes a company and its annual history', async () => {
    const writer = new MemoryWriter();
    const report = await ingestEdgarCiks(
      async (url) => response(facts(Number(/CIK(\d+)/.exec(url)?.[1] ?? '0'), '2026-03-31', 1_000)),
      ['320193', '789019'],
      { writer, clock: NOWAIT },
    );

    expect(report.companiesWritten).toBe(2);
    expect(report.financialsWritten).toBe(2);
    expect(writer.financials[0].record.revenue).toBe(1_000);
  });

  it('sends the User-Agent from the adapter, not from the caller', async () => {
    // EDGAR requires it to name a real contact, and a caller free to pass
    // anything would eventually pass nothing.
    let sent: string | undefined;
    await ingestEdgarCiks(
      async (url, init) => {
        sent = (init?.headers as Record<string, string>)['User-Agent'];
        return response(facts(1, '2026-03-31', 1));
      },
      ['1'],
      { writer: new MemoryWriter(), clock: NOWAIT },
    );
    expect(sent).toContain('@');
  });

  it('records a 403 as a skip that names the cause', async () => {
    const report = await ingestEdgarCiks(async () => response({}, { ok: false, status: 403 }), ['1'], {
      writer: new MemoryWriter(),
      clock: NOWAIT,
    });
    expect(report.skipped[0].reason).toContain('User-Agent naming a real contact');
    // A refusal the adapter understood is a skip, not a failure.
    expect(report.failed).toBe(0);
  });
});

describe('ingestMcaRows', () => {
  const ROW = {
    CIN: 'U72200KA2013PTC097389',
    COMPANY_NAME: 'Example Software Private Limited',
    COMPANY_STATUS: 'ACTIVE',
    DATE_OF_REGISTRATION: '18-05-2013',
  };

  it('numbers rows across batches, so a skip can be found in the file', async () => {
    const report = await ingestMcaRows(
      [
        [ROW, { ...ROW, CIN: 'rubbish' }],
        [{ ...ROW, CIN: 'U72200KA2014PTC097390' }, { ...ROW, COMPANY_NAME: '' }],
      ],
      { writer: new MemoryWriter() },
    );

    expect(report.companiesWritten).toBe(2);
    expect(report.skipped).toHaveLength(2);
    // Second batch starts at row 3, so the nameless row is row 4.
    expect(report.skipped[0].at).toBe('row 2');
  });

  it('groups the skips, which is what makes a bulk report readable', async () => {
    const struck = { ...ROW, COMPANY_STATUS: 'STRIKE OFF' };
    const report = await ingestMcaRows([[ROW, struck, struck, struck]], {
      writer: new MemoryWriter(),
    });

    expect(report.companiesWritten).toBe(1);
    expect(report.tally).toEqual([
      { reason: 'Company status is STRIKE OFF, so it cannot be a comparable', count: 3 },
    ]);
  });
});

describe('makeRpcWriter', () => {
  it('calls the functions in migration 0028 with the payloads they expect', async () => {
    const calls: { fn: string; payload: Record<string, unknown> }[] = [];
    const writer = makeRpcWriter({
      rpc: async (fn, payload) => {
        calls.push({ fn, payload });
        return fn === 'upsert_company' ? 'new-id' : null;
      },
      findCompany: async () => null,
    });

    const id = await writer.upsertCompany({ name: 'Example Ltd', source: 'nse' });
    expect(id).toBe('new-id');

    await writer.recordFinancials(
      {
        match: { by: 'nse_symbol', value: 'EX' },
        period_end: '2026-03-31',
        basis: 'consolidated',
        currency: 'INR',
        source: 'nse',
      },
      'new-id',
    );

    expect(calls[0].fn).toBe('upsert_company');
    expect(calls[1].fn).toBe('record_financials');
    // `match` is how the adapter named the company and is not a column.
    expect(calls[1].payload.match).toBeUndefined();
    expect(calls[1].payload.company_id).toBe('new-id');
  });

  it('throws when upsert_company gives back no id, rather than carrying on', async () => {
    // A write that quietly did nothing would leave a report claiming rows that
    // are not there, which is worse than a run that stops.
    const writer = makeRpcWriter({ rpc: async () => null, findCompany: async () => null });
    await expect(writer.upsertCompany({ name: 'Example Ltd', source: 'nse' })).rejects.toThrow(
      'upsert_company returned no id for Example Ltd',
    );
  });

  it('maps the lookup ledger to snake_case, because that is what the function reads', async () => {
    const calls: Record<string, unknown>[] = [];
    const writer = makeRpcWriter({
      rpc: async (_fn, payload) => {
        calls.push(payload);
        return null;
      },
      findCompany: async () => null,
    });

    await writer.recordLookup({
      provider: 'filesure',
      kind: 'company_unlock',
      subject: 'U72200KA2013PTC097389',
      costPaise: 33_000,
      cacheHit: false,
      outcome: 'miss',
    });

    expect(calls[0]).toMatchObject({ cost_paise: 33_000, cache_hit: false, outcome: 'miss' });
  });

  it('resolves through the column name the match names', async () => {
    const asked: [string, string][] = [];
    const writer = makeRpcWriter({
      rpc: async () => null,
      findCompany: async (column, value) => {
        asked.push([column, value]);
        return 'found';
      },
    });

    await writer.resolve({ by: 'nse_symbol', value: 'EXAMPLE' });
    expect(asked).toEqual([['nse_symbol', 'EXAMPLE']]);
  });
});

describe('MemoryWriter', () => {
  it('gives the same id to the same company twice, as the real function would', async () => {
    // A counter would have hidden a double-insert bug rather than reproducing it.
    const writer = new MemoryWriter();
    const a = await writer.upsertCompany({ name: 'X', cin: 'U1', source: 'mca_master' });
    const b = await writer.upsertCompany({ name: 'X', cin: 'U1', source: 'mca_master' });
    expect(a).toBe(b);
  });

  it('falls back to the name when a company has no identifier', async () => {
    const writer = new MemoryWriter();
    expect(await writer.upsertCompany({ name: 'No Identifiers Ltd', source: 'nse' })).toBe(
      'mem-NO IDENTIFIERS LTD',
    );
  });
});
