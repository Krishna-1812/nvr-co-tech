import { describe, expect, it } from 'vitest';
import {
  bareCik,
  companyFactsUrl,
  factsForTag,
  fetchCompanyFacts,
  fetchCompanyProfile,
  fetchTickerUniverse,
  isAnnual,
  isInstant,
  latestFiled,
  latestSharesOutstanding,
  monthsBetween,
  padCik,
  parseCompanyFacts,
  parseSubmissions,
  parseTickerUniverse,
  parseYahooChart,
  submissionsUrl,
  tickerUniverseUrl,
} from './edgar';
import type { Fact } from './edgar';

/**
 * A duration fact covering the twelve months ending on `end`.
 *
 * The start is computed rather than written, because a hardcoded October start
 * only makes a year of a September year-end — with a March one it silently
 * produced a six-month period that `isAnnual` correctly refused, and every
 * assertion built on it failed for the right reason against a wrong fixture.
 */
function year(end: string, val: number, over: Partial<Fact> = {}): Fact {
  const [y, m, d] = end.split('-').map(Number);
  const start = new Date(Date.UTC(y - 1, m - 1, d + 1)).toISOString().slice(0, 10);
  const endYear = y;
  return {
    start,
    end,
    val,
    form: '10-K',
    fp: 'FY',
    fy: endYear,
    filed: `${endYear}-11-15`,
    accn: `acc-${end}`,
    ...over,
  };
}

/** Build a companyfacts response around a set of tags. */
function facts(tags: Record<string, Fact[]>, over: Record<string, unknown> = {}) {
  const gaap: Record<string, unknown> = {};
  for (const [tag, list] of Object.entries(tags)) {
    gaap[tag] = { units: { USD: list } };
  }
  return { cik: 320193, entityName: 'Example Inc.', facts: { 'us-gaap': gaap }, ...over };
}

describe('CIK handling', () => {
  it('pads for a URL and strips for storage', () => {
    expect(padCik('320193')).toBe('0000320193');
    expect(padCik('CIK0000320193')).toBe('0000320193');
    expect(bareCik('0000320193')).toBe('320193');
    expect(companyFactsUrl('320193')).toBe(
      'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json',
    );
  });

  it('does not turn an all-zero CIK into an empty string', () => {
    expect(bareCik('0000000000')).toBe('0');
  });
});

describe('monthsBetween', () => {
  it('counts a financial year as twelve', () => {
    expect(monthsBetween('2025-10-01', '2026-09-28')).toBe(12);
  });

  it('counts a quarter as three', () => {
    expect(monthsBetween('2026-01-01', '2026-03-31')).toBe(3);
  });

  it('is null when the end is not after the start', () => {
    expect(monthsBetween('2026-03-31', '2026-01-01')).toBeNull();
    expect(monthsBetween('2026-03-31', '2026-03-31')).toBeNull();
    expect(monthsBetween('rubbish', '2026-03-31')).toBeNull();
  });
});

describe('isAnnual', () => {
  it('accepts a twelve-month period from a 10-K', () => {
    expect(isAnnual(year('2026-09-28', 100))).toBe(true);
  });

  it('accepts a 53-week retailer year', () => {
    // 371 days. Requiring exactly twelve months would have dropped a whole
    // sector's most recent year.
    expect(isAnnual({ start: '2025-02-02', end: '2026-02-07', val: 1, form: '10-K' })).toBe(true);
  });

  it('accepts a foreign private issuer on 20-F or 40-F', () => {
    expect(isAnnual(year('2026-03-31', 1, { form: '20-F' }))).toBe(true);
    expect(isAnnual(year('2026-03-31', 1, { form: '40-F' }))).toBe(true);
  });

  it('rejects a quarter, however it is labelled', () => {
    // The error that understates revenue by three quarters and puts the
    // multiple out by four times.
    expect(isAnnual({ start: '2026-01-01', end: '2026-03-31', val: 1, form: '10-Q' })).toBe(false);
    expect(isAnnual({ start: '2026-01-01', end: '2026-03-31', val: 1, form: '10-K' })).toBe(false);
  });

  it('rejects a twelve-month cumulative from a 10-Q', () => {
    // The duration alone would have let this through. Both signals are needed.
    expect(isAnnual({ start: '2025-04-01', end: '2026-03-31', val: 1, form: '10-Q' })).toBe(false);
  });

  it('rejects an instant fact and a fact with no form', () => {
    expect(isAnnual({ end: '2026-03-31', val: 1, form: '10-K' })).toBe(false);
    expect(isAnnual({ start: '2025-04-01', end: '2026-03-31', val: 1 })).toBe(false);
  });
});

describe('isInstant', () => {
  it('is a fact with an end and no start', () => {
    expect(isInstant({ end: '2026-03-31', val: 1 })).toBe(true);
    expect(isInstant({ start: '2025-04-01', end: '2026-03-31', val: 1 })).toBe(false);
  });
});

describe('factsForTag', () => {
  it('takes a three-letter currency unit and reports which', () => {
    const found = factsForTag({ Revenues: { units: { USD: [year('2026-03-31', 100)] } } }, 'Revenues');
    expect(found?.currency).toBe('USD');
    expect(found?.facts).toHaveLength(1);
  });

  it('refuses a per-share or share-count unit', () => {
    // Either would produce a multiple out by the share count.
    expect(
      factsForTag({ X: { units: { 'USD/shares': [year('2026-03-31', 5)] } } }, 'X'),
    ).toBeNull();
    expect(factsForTag({ X: { units: { shares: [year('2026-03-31', 5)] } } }, 'X')).toBeNull();
  });

  it('is null for a missing tag or a malformed entry', () => {
    expect(factsForTag({}, 'Revenues')).toBeNull();
    expect(factsForTag({ Revenues: 'nope' }, 'Revenues')).toBeNull();
    expect(factsForTag(null, 'Revenues')).toBeNull();
  });

  it('drops facts with no numeric value rather than reading them as zero', () => {
    const found = factsForTag(
      { X: { units: { USD: [{ end: '2026-03-31', val: 'lots' }, year('2026-03-31', 7)] } } },
      'X',
    );
    expect(found?.facts).toHaveLength(1);
    expect(found?.facts[0].val).toBe(7);
  });
});

describe('latestFiled', () => {
  it('prefers the most recent filing, because a restatement is truer', () => {
    const chosen = latestFiled([
      year('2026-03-31', 100, { filed: '2026-05-01', accn: 'a' }),
      year('2026-03-31', 110, { filed: '2026-11-01', accn: 'b' }),
    ]);
    expect(chosen?.val).toBe(110);
  });

  it('breaks a tie on accession, so two runs of the same ingest agree', () => {
    const forwards = latestFiled([
      year('2026-03-31', 100, { filed: '2026-05-01', accn: 'a' }),
      year('2026-03-31', 200, { filed: '2026-05-01', accn: 'b' }),
    ]);
    const backwards = latestFiled([
      year('2026-03-31', 200, { filed: '2026-05-01', accn: 'b' }),
      year('2026-03-31', 100, { filed: '2026-05-01', accn: 'a' }),
    ]);
    expect(forwards?.val).toBe(200);
    expect(backwards?.val).toBe(200);
  });

  it('is null for nothing', () => {
    expect(latestFiled([])).toBeNull();
  });
});

describe('parseCompanyFacts', () => {
  it('reads a company and its annual revenue', () => {
    const harvest = parseCompanyFacts(
      facts({ Revenues: [year('2026-03-31', 1_000), year('2025-03-31', 800)] }),
    );

    expect(harvest.companies).toEqual([
      {
        name: 'Example Inc.',
        cik: '320193',
        country: 'US',
        listing_status: 'unknown',
        source: 'sec_edgar',
        source_url: 'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json',
      },
    ]);
    expect(harvest.financials.map((f) => [f.period_end, f.revenue])).toEqual([
      ['2026-03-31', 1_000],
      ['2025-03-31', 800],
    ]);
  });

  it('does not claim a filer is listed', () => {
    // A registrant may have registered only debt. The exchange settles it.
    expect(parseCompanyFacts(facts({ Revenues: [year('2026-03-31', 1)] })).companies[0].listing_status).toBe(
      'unknown',
    );
  });

  it('walks the tag preference list and reports which tag it used', () => {
    const harvest = parseCompanyFacts(
      facts({ SalesRevenueNet: [year('2026-03-31', 500)] }),
    );
    expect(harvest.financials[0].revenue).toBe(500);
    expect(harvest.financials[0].revenueTagUsed).toBe('SalesRevenueNet');
  });

  it('prefers the earlier tag in the list when both are present', () => {
    const harvest = parseCompanyFacts(
      facts({
        SalesRevenueNet: [year('2026-03-31', 500)],
        RevenueFromContractWithCustomerExcludingAssessedTax: [year('2026-03-31', 900)],
      }),
    );
    expect(harvest.financials[0].revenue).toBe(900);
    expect(harvest.financials[0].revenueTagUsed).toBe(
      'RevenueFromContractWithCustomerExcludingAssessedTax',
    );
  });

  it('ignores quarterly facts entirely', () => {
    const harvest = parseCompanyFacts(
      facts({
        Revenues: [
          year('2026-03-31', 1_000),
          { start: '2026-01-01', end: '2026-03-31', val: 250, form: '10-Q', filed: '2026-04-30' },
        ],
      }),
    );
    // One period, and the annual figure — not the quarter that shares its end.
    expect(harvest.financials).toHaveLength(1);
    expect(harvest.financials[0].revenue).toBe(1_000);
  });

  it('derives EBITDA from operating income plus depreciation', () => {
    const harvest = parseCompanyFacts(
      facts({
        Revenues: [year('2026-03-31', 1_000)],
        OperatingIncomeLoss: [year('2026-03-31', 150)],
        DepreciationDepletionAndAmortization: [year('2026-03-31', 50)],
      }),
    );
    expect(harvest.financials[0].ebit).toBe(150);
    expect(harvest.financials[0].ebitda).toBe(200);
  });

  it('leaves EBITDA null rather than relabelling operating income', () => {
    /*
     * The whole reason EBITDA is derived here. Operating income quietly
     * presented as EBITDA understates every EV/EBITDA multiple built on it, and
     * a peer whose EBITDA is unknown belongs out of that column and still in
     * EV/Revenue.
     */
    const harvest = parseCompanyFacts(
      facts({ Revenues: [year('2026-03-31', 1_000)], OperatingIncomeLoss: [year('2026-03-31', 150)] }),
    );
    expect(harvest.financials[0].ebit).toBe(150);
    expect(harvest.financials[0].ebitda).toBeNull();
  });

  it('matches an instant fact only on the exact date', () => {
    // A balance sheet three days either side is a different balance sheet, and
    // the nearest-match version of this pairs a year's revenue with a quarter's
    // cash.
    const harvest = parseCompanyFacts(
      facts({
        Revenues: [year('2026-03-31', 1_000)],
        Assets: [{ end: '2026-03-31', val: 5_000, filed: '2026-05-01' }],
        CashAndCashEquivalentsAtCarryingValue: [{ end: '2026-03-28', val: 700, filed: '2026-05-01' }],
      }),
    );
    expect(harvest.financials[0].total_assets).toBe(5_000);
    expect(harvest.financials[0].cash).toBeNull();
  });

  it('leaves debt null rather than assembling a plausible total', () => {
    const harvest = parseCompanyFacts(facts({ Revenues: [year('2026-03-31', 1_000)] }));
    expect(harvest.financials[0].total_debt).toBeNull();
  });

  it('caps the history it returns', () => {
    const years = [2026, 2025, 2024, 2023, 2022].map((y) => year(`${y}-03-31`, y));
    expect(parseCompanyFacts(facts({ Revenues: years }), { years: 2 }).financials).toHaveLength(2);
  });

  it('marks every figure as consolidated and audited, because EDGAR is', () => {
    const f = parseCompanyFacts(facts({ Revenues: [year('2026-03-31', 1)] })).financials[0];
    expect(f.basis).toBe('consolidated');
    expect(f.is_audited).toBe(true);
    expect(f.currency).toBe('USD');
    expect(f.match).toEqual({ by: 'cik', value: '320193' });
  });

  it('reads an IFRS taxonomy as well as us-gaap', () => {
    const harvest = parseCompanyFacts({
      cik: 1,
      entityName: 'Foreign Plc',
      facts: { 'ifrs-full': { Revenues: { units: { EUR: [year('2026-03-31', 42)] } } } },
    });
    expect(harvest.financials[0].revenue).toBe(42);
    expect(harvest.financials[0].currency).toBe('EUR');
  });

  it('refuses a response that is not the shape it claims', () => {
    expect(parseCompanyFacts(null).skipped[0].reason).toContain('not a JSON object');
    expect(parseCompanyFacts({ cik: 1 }).skipped[0].reason).toContain('no cik or no entityName');
    expect(parseCompanyFacts({ cik: 1, entityName: 'X' }).skipped[0].reason).toContain('no facts object');
    expect(
      parseCompanyFacts({ cik: 1, entityName: 'X', facts: { dei: {} } }).skipped[0].reason,
    ).toContain('No us-gaap or ifrs-full');
  });

  it('names the tags it tried when there is no annual revenue', () => {
    const harvest = parseCompanyFacts(facts({ Assets: [{ end: '2026-03-31', val: 1 }] }));
    expect(harvest.companies).toHaveLength(1); // The company is still worth having.
    expect(harvest.skipped[0].reason).toContain('RevenueFromContractWithCustomerExcludingAssessedTax');
  });
});

describe('fetchCompanyFacts', () => {
  const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json });

  it('sends the User-Agent EDGAR requires, on both requests', async () => {
    const seen: { url: string; init?: RequestInit }[] = [];
    await fetchCompanyFacts(
      async (url, init) => {
        seen.push({ url, init });
        return url.includes('/submissions/')
          ? ok({}) // No profile fields — irrelevant to what this test checks.
          : ok(facts({ Revenues: [year('2026-03-31', 1)] }));
      },
      '320193',
      'Someone someone@example.com',
    );

    expect(seen).toHaveLength(2);
    expect(seen[0].url).toBe('https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json');
    expect(seen[1].url).toBe('https://data.sec.gov/submissions/CIK0000320193.json');
    for (const { init } of seen) {
      expect((init?.headers as Record<string, string>)['User-Agent']).toBe('Someone someone@example.com');
    }
  });

  it('explains a 403 rather than passing on the number', async () => {
    const harvest = await fetchCompanyFacts(
      async () => ({ ok: false, status: 403, json: async () => ({}) }),
      '320193',
      'ua',
    );
    expect(harvest.skipped[0].reason).toContain('User-Agent naming a real contact');
  });

  it('reports any other status plainly', async () => {
    const harvest = await fetchCompanyFacts(
      async () => ({ ok: false, status: 404, json: async () => ({}) }),
      '320193',
      'ua',
    );
    expect(harvest.skipped[0].reason).toBe('EDGAR answered 404');
    expect(harvest.skipped[0].at).toBe('320193');
  });

  it('merges a listed profile into the company it just wrote', async () => {
    const harvest = await fetchCompanyFacts(
      async (url) =>
        url.includes('/submissions/')
          ? ok({ sic: '3571', sicDescription: 'Electronic Computers', tickers: ['AAPL'], exchanges: ['Nasdaq'] })
          : ok(facts({ Revenues: [year('2026-03-31', 1)] })),
      '320193',
      'ua',
    );

    expect(harvest.companies[0]).toMatchObject({
      sic_code: '3571',
      industry: 'Electronic Computers',
      listing_status: 'listed',
    });
  });

  it('leaves listing status unknown for a filer with no exchange', async () => {
    // PACCAR Financial Corp's real shape: it files only because it registers
    // public debt, never because it is listed.
    const harvest = await fetchCompanyFacts(
      async (url) =>
        url.includes('/submissions/')
          ? ok({ sic: '6153', sicDescription: 'Short-Term Business Credit Institutions', tickers: [], exchanges: [] })
          : ok(facts({ Revenues: [year('2026-03-31', 1)] })),
      '320193',
      'ua',
    );

    expect(harvest.companies[0]).toMatchObject({
      sic_code: '6153',
      industry: 'Short-Term Business Credit Institutions',
      listing_status: 'unknown',
    });
  });

  it('prefers the submissions name over a stale companyfacts entityName', async () => {
    // CIK 70858's real shape: companyfacts names it "BofA Finance LLC",
    // submissions — and the ticker BAC — say "BANK OF AMERICA CORP /DE/".
    const harvest = await fetchCompanyFacts(
      async (url) =>
        url.includes('/submissions/')
          ? ok({ name: 'BANK OF AMERICA CORP /DE/', sic: '6021', sicDescription: 'National Commercial Banks', exchanges: ['NYSE'] })
          : ok(facts({ Revenues: [year('2026-03-31', 1)] }, { entityName: 'BofA Finance LLC' })),
      '70858',
      'ua',
    );

    expect(harvest.companies[0]?.name).toBe('BANK OF AMERICA CORP /DE/');
  });

  it('keeps the figures when the profile fetch fails', async () => {
    const harvest = await fetchCompanyFacts(
      async (url) =>
        url.includes('/submissions/')
          ? { ok: false, status: 503, json: async () => ({}) }
          : ok(facts({ Revenues: [year('2026-03-31', 1)] })),
      '320193',
      'ua',
    );

    expect(harvest.companies[0]).toMatchObject({
      name: 'Example Inc.',
      listing_status: 'unknown',
    });
    expect(harvest.financials).toHaveLength(1);
  });

  /** companyfacts carrying both a revenue history and a dei share count. */
  const factsWithShares = (sharesList: { end: string; val: number; filed?: string }[]) => ({
    cik: 771497,
    entityName: 'ABM INDUSTRIES INC /DE/',
    facts: {
      'us-gaap': { Revenues: { units: { USD: [year('2026-10-31', 1_000)] } } },
      dei: { EntityCommonStockSharesOutstanding: { units: { shares: sharesList } } },
    },
  });

  it('derives a market cap for a listed filer with a ticker and shares', async () => {
    const seen: string[] = [];
    const harvest = await fetchCompanyFacts(
      async (url) => {
        seen.push(url);
        if (url.includes('/submissions/')) {
          return ok({ tickers: ['ABM'], exchanges: ['NYSE'], sicDescription: 'Services-To Dwellings' });
        }
        if (url.includes('finance.yahoo.com')) {
          return ok({
            chart: { result: [{ meta: { regularMarketPrice: 46.81, currency: 'USD', regularMarketTime: 1755734400 } }] },
          });
        }
        return ok(factsWithShares([{ end: '2026-06-04', val: 58_580_923 }]));
      },
      '771497',
      'ua',
    );

    expect(seen.some((u) => u.includes('finance.yahoo.com/v8/finance/chart/ABM'))).toBe(true);
    expect(harvest.quotes).toHaveLength(1);
    expect(harvest.quotes[0]).toMatchObject({
      match: { by: 'cik', value: '771497' },
      close_price: 46.81,
      shares_outstanding: 58_580_923,
      currency: 'USD',
      as_of: '2025-08-21',
      source: 'sec_edgar',
    });
    expect(harvest.quotes[0].market_cap).toBeCloseTo(58_580_923 * 46.81, 2);
    expect(harvest.companies[0]?.listing_status).toBe('listed');
  });

  it('asks for no price, and writes no quote, for an unlisted filer', async () => {
    const seen: string[] = [];
    const harvest = await fetchCompanyFacts(
      async (url) => {
        seen.push(url);
        if (url.includes('/submissions/')) return ok({ tickers: [], exchanges: [] });
        return ok(factsWithShares([{ end: '2026-06-04', val: 58_580_923 }]));
      },
      '771497',
      'ua',
    );

    expect(seen.some((u) => u.includes('finance.yahoo.com'))).toBe(false);
    expect(harvest.quotes).toHaveLength(0);
  });

  it('writes no quote when the share count is unknown', async () => {
    const harvest = await fetchCompanyFacts(
      async (url) =>
        url.includes('/submissions/')
          ? ok({ tickers: ['ABM'], exchanges: ['NYSE'] })
          : ok(facts({ Revenues: [year('2026-03-31', 1)] })), // no dei shares
      '771497',
      'ua',
    );
    expect(harvest.quotes).toHaveLength(0);
  });

  it('keeps the figures when the price fetch fails', async () => {
    const harvest = await fetchCompanyFacts(
      async (url) => {
        if (url.includes('/submissions/')) return ok({ tickers: ['ABM'], exchanges: ['NYSE'] });
        if (url.includes('finance.yahoo.com')) return { ok: false, status: 429, json: async () => ({}) };
        return ok(factsWithShares([{ end: '2026-06-04', val: 58_580_923 }]));
      },
      '771497',
      'ua',
    );
    expect(harvest.quotes).toHaveLength(0);
    expect(harvest.financials).toHaveLength(1);
    // The exchange said listed, so it stays listed even though the price failed.
    expect(harvest.companies[0]?.listing_status).toBe('listed');
  });
});

describe('parseSubmissions', () => {
  it('reads the sic, industry, name and listing status', () => {
    expect(
      parseSubmissions({
        name: 'Apple Inc.',
        sic: '3571',
        sicDescription: 'Electronic Computers',
        tickers: ['AAPL'],
        exchanges: ['Nasdaq'],
      }),
    ).toEqual({
      sicCode: '3571',
      industry: 'Electronic Computers',
      listed: true,
      name: 'Apple Inc.',
      ticker: 'AAPL',
    });
  });

  it('reports unlisted when exchanges is empty, not just absent tickers', () => {
    expect(
      parseSubmissions({
        name: 'PACCAR FINANCIAL CORP',
        sic: '6153',
        sicDescription: 'Short-Term Business Credit Institutions',
        tickers: [],
        exchanges: [],
      }),
    ).toEqual({
      sicCode: '6153',
      industry: 'Short-Term Business Credit Institutions',
      listed: false,
      name: 'PACCAR FINANCIAL CORP',
      ticker: null,
    });
  });

  it('is null for a response with no shape to read', () => {
    expect(parseSubmissions('not an object')).toBeNull();
    expect(parseSubmissions(null)).toBeNull();
  });

  it('is null-fielded rather than throwing on blank strings', () => {
    expect(parseSubmissions({ name: '  ', sic: '', sicDescription: '  ', exchanges: [''] })).toEqual({
      sicCode: null,
      industry: null,
      listed: false,
      name: null,
      ticker: null,
    });
  });

  it('reads the primary ticker, skipping blanks', () => {
    expect(parseSubmissions({ exchanges: ['NYSE'], tickers: ['', 'ABM'] })?.ticker).toBe('ABM');
    expect(parseSubmissions({ exchanges: ['NYSE'], tickers: [] })?.ticker).toBeNull();
  });
});

describe('latestSharesOutstanding', () => {
  const shares = (list: { end: string; val: number; filed?: string }[], taxonomy = 'dei') => ({
    facts: { [taxonomy]: { EntityCommonStockSharesOutstanding: { units: { shares: list } } } },
  });

  it('takes the newest period end', () => {
    const json = shares([
      { end: '2025-06-04', val: 60_000_000 },
      { end: '2026-06-04', val: 58_580_923 },
    ]);
    expect(latestSharesOutstanding(json)).toEqual({ shares: 58_580_923, at: '2026-06-04' });
  });

  it('breaks a same-date tie on the latest filing', () => {
    const json = shares([
      { end: '2026-06-04', val: 58_000_000, filed: '2026-06-10' },
      { end: '2026-06-04', val: 58_580_923, filed: '2026-07-01' },
    ]);
    expect(latestSharesOutstanding(json)?.shares).toBe(58_580_923);
  });

  it('falls back to the us-gaap tag when dei is absent', () => {
    const json = {
      facts: { 'us-gaap': { CommonStockSharesOutstanding: { units: { shares: [{ end: '2026-03-31', val: 1_000 }] } } } },
    };
    expect(latestSharesOutstanding(json)?.shares).toBe(1_000);
  });

  it('ignores non-positive counts and is null when there are none', () => {
    expect(latestSharesOutstanding(shares([{ end: '2026-03-31', val: 0 }]))).toBeNull();
    expect(latestSharesOutstanding({ facts: {} })).toBeNull();
    expect(latestSharesOutstanding('nope')).toBeNull();
  });
});

describe('parseYahooChart', () => {
  const chart = (meta: Record<string, unknown>) => ({ chart: { result: [{ meta }], error: null } });

  it('reads the last price, currency and date', () => {
    expect(
      parseYahooChart(chart({ regularMarketPrice: 46.81, currency: 'USD', regularMarketTime: 1755734400 })),
    ).toEqual({ price: 46.81, currency: 'USD', asOf: '2025-08-21' });
  });

  it('defaults the currency and tolerates a missing timestamp', () => {
    expect(parseYahooChart(chart({ regularMarketPrice: 10 }))).toEqual({
      price: 10,
      currency: 'USD',
      asOf: null,
    });
  });

  it('is null when the price is missing, non-positive or the shape is wrong', () => {
    expect(parseYahooChart(chart({ currency: 'USD' }))).toBeNull();
    expect(parseYahooChart(chart({ regularMarketPrice: 0 }))).toBeNull();
    expect(parseYahooChart({ chart: { result: [] } })).toBeNull();
    expect(parseYahooChart('nope')).toBeNull();
  });
});

describe('submissionsUrl', () => {
  it('zero-pads the same way companyFactsUrl does', () => {
    expect(submissionsUrl('320193')).toBe('https://data.sec.gov/submissions/CIK0000320193.json');
  });
});

describe('fetchCompanyProfile', () => {
  const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json });

  it('is null on a non-ok response, not a thrown error', async () => {
    const profile = await fetchCompanyProfile(
      async () => ({ ok: false, status: 403, json: async () => ({}) }),
      '320193',
      'ua',
    );
    expect(profile).toBeNull();
  });

  it('is null when the body is not valid JSON, not a thrown error', async () => {
    const profile = await fetchCompanyProfile(
      async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      }),
      '320193',
      'ua',
    );
    expect(profile).toBeNull();
  });

  it('sends the same User-Agent contract as the figures request', async () => {
    let seenHeaders: Record<string, string> | undefined;
    await fetchCompanyProfile(
      async (_url, init) => {
        seenHeaders = init?.headers as Record<string, string>;
        return ok({ exchanges: [] });
      },
      '320193',
      'Someone someone@example.com',
    );
    expect(seenHeaders?.['User-Agent']).toBe('Someone someone@example.com');
  });
});

describe('tickerUniverseUrl', () => {
  it('points at the real bulk file', () => {
    expect(tickerUniverseUrl()).toBe('https://www.sec.gov/files/company_tickers_exchange.json');
  });
});

describe('parseTickerUniverse', () => {
  /** The real shape, verified live this session: a compact fields/data pair. */
  const REAL_SHAPE = {
    fields: ['cik', 'name', 'ticker', 'exchange'],
    data: [
      [320193, 'Apple Inc.', 'AAPL', 'Nasdaq'],
      [1045810, 'NVIDIA CORP', 'NVDA', 'Nasdaq'],
      [70858, 'BANK OF AMERICA CORP /DE/', 'BAC', 'NYSE'],
    ],
  };

  it('reads the field order rather than assuming it', () => {
    const rows = parseTickerUniverse(REAL_SHAPE);
    expect(rows).toEqual([
      { cik: '320193', name: 'Apple Inc.', ticker: 'AAPL', exchange: 'Nasdaq' },
      { cik: '1045810', name: 'NVIDIA CORP', ticker: 'NVDA', exchange: 'Nasdaq' },
      { cik: '70858', name: 'BANK OF AMERICA CORP /DE/', ticker: 'BAC', exchange: 'NYSE' },
    ]);
  });

  it('still reads correctly if the field order in the file changes', () => {
    const reordered = {
      fields: ['exchange', 'ticker', 'name', 'cik'],
      data: [['NYSE', 'BAC', 'BANK OF AMERICA CORP /DE/', 70858]],
    };
    expect(parseTickerUniverse(reordered)).toEqual([
      { cik: '70858', name: 'BANK OF AMERICA CORP /DE/', ticker: 'BAC', exchange: 'NYSE' },
    ]);
  });

  it('reads a row with no exchange on record as null, not a missing field', () => {
    const rows = parseTickerUniverse({
      fields: ['cik', 'name', 'ticker', 'exchange'],
      data: [[1, 'Nobody Listed Inc.', 'NADA', null]],
    });
    expect(rows).toEqual([{ cik: '1', name: 'Nobody Listed Inc.', ticker: 'NADA', exchange: null }]);
  });

  it('returns nothing rather than throwing on a response that is not this shape', () => {
    expect(parseTickerUniverse(null)).toEqual([]);
    expect(parseTickerUniverse({})).toEqual([]);
    expect(parseTickerUniverse({ fields: ['cik'], data: 'not an array' })).toEqual([]);
    expect(parseTickerUniverse({ fields: ['name', 'ticker'], data: [['Only Name', 'ONLY']] })).toEqual([]);
  });

  it('skips a row missing a required field rather than failing the whole file', () => {
    const rows = parseTickerUniverse({
      fields: ['cik', 'name', 'ticker', 'exchange'],
      data: [
        [1, 'Good Co', 'GOOD', 'Nasdaq'],
        ['not-an-object-row'],
        [2, 'Also Good', 'ALSO', 'NYSE'],
      ],
    });
    expect(rows.map((r) => r.ticker)).toEqual(['GOOD', 'ALSO']);
  });
});

describe('fetchTickerUniverse', () => {
  const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json });

  it('sends the required User-Agent', async () => {
    let seenHeaders: Record<string, string> | undefined;
    await fetchTickerUniverse(async (_url, init) => {
      seenHeaders = init?.headers as Record<string, string>;
      return ok({ fields: ['cik', 'name', 'ticker', 'exchange'], data: [] });
    }, 'Someone someone@example.com');
    expect(seenHeaders?.['User-Agent']).toBe('Someone someone@example.com');
  });

  it('throws once on a failed fetch rather than returning an empty universe silently', async () => {
    await expect(
      fetchTickerUniverse(async () => ({ ok: false, status: 403, json: async () => ({}) }), 'ua'),
    ).rejects.toThrow('403');
  });

  it('parses a real response shape end to end', async () => {
    const rows = await fetchTickerUniverse(
      async () =>
        ok({
          fields: ['cik', 'name', 'ticker', 'exchange'],
          data: [[320193, 'Apple Inc.', 'AAPL', 'Nasdaq']],
        }),
      'ua',
    );
    expect(rows).toEqual([{ cik: '320193', name: 'Apple Inc.', ticker: 'AAPL', exchange: 'Nasdaq' }]);
  });
});
