import { describe, expect, it } from 'vitest';
import {
  fetchNseQuote,
  figureAt,
  nseHeaders,
  nseSession,
  NSE_PATHS,
  parseNseDate,
  parseNseQuote,
  readPath,
  textAt,
  toFigure,
} from './nse';

const ASOF = '2026-08-21';

/** A quote response in the shape the path map expects. */
function quote(over: Record<string, unknown> = {}) {
  return {
    info: { companyName: 'Example Logistics Limited', isin: 'INE000A01001', industry: 'Logistics' },
    metadata: { lastUpdateTime: '22-Aug-2026 15:30:00' },
    priceInfo: { lastPrice: 1_234.5 },
    industryInfo: { sector: 'Services' },
    marketDeptOrderBook: { tradeInfo: { totalMarketCap: 45_000 } },
    ...over,
  };
}

describe('toFigure', () => {
  it('reads the messy shapes a public site writes', () => {
    expect(toFigure('1,23,456.50')).toBe(123456.5);
    expect(toFigure('₹45,000')).toBe(45000);
    expect(toFigure('(2,000)')).toBe(-2000);
    expect(toFigure(45_000)).toBe(45000);
  });

  it('treats a blank as unknown, not as zero', () => {
    /*
     * The one place this inverts parseAmount, which is right for a ledger and
     * wrong here. A blank in a ledger means nothing was posted; a blank in a
     * comparables table means we do not know, and a zero would claim the company
     * earned nothing.
     */
    expect(toFigure('')).toBeNull();
    expect(toFigure('   ')).toBeNull();
    expect(toFigure('-')).toBeNull();
    expect(toFigure('—')).toBeNull();
    expect(toFigure('NA')).toBeNull();
    expect(toFigure('n/a')).toBeNull();
    expect(toFigure('nil')).toBeNull();
    expect(toFigure(null)).toBeNull();
    expect(toFigure(undefined)).toBeNull();
  });

  it('returns null rather than throwing on nonsense', () => {
    expect(toFigure('lots')).toBeNull();
    expect(toFigure({})).toBeNull();
    expect(toFigure(Number.NaN)).toBeNull();
    expect(toFigure(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('keeps a real zero', () => {
    expect(toFigure(0)).toBe(0);
    expect(toFigure('0')).toBe(0);
  });
});

describe('readPath', () => {
  it('walks a dotted path', () => {
    expect(readPath({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1);
  });

  it('is undefined rather than throwing when the path is not there', () => {
    expect(readPath({ a: 1 }, 'a.b.c')).toBeUndefined();
    expect(readPath(null, 'a')).toBeUndefined();
  });
});

describe('figureAt', () => {
  it('applies the scale, which is the difference between 44x and 4,400x', () => {
    // NSE reports total market cap in lakhs on this path. 45,000 lakh is
    // ₹450 crore, and a hundred-fold error here reads as a slightly expensive
    // multiple rather than as an obviously wrong one.
    const found = figureAt(quote(), NSE_PATHS.marketCap);
    expect(found?.value).toBe(45_000 * 100_000);
    expect(found?.path).toBe('marketDeptOrderBook.tradeInfo.totalMarketCap');
  });

  it('falls through to the next path, without its scale', () => {
    const found = figureAt(
      { securityInfo: { totalMarketCap: 4_500_000_000 } },
      NSE_PATHS.marketCap,
    );
    expect(found?.value).toBe(4_500_000_000);
    expect(found?.path).toBe('securityInfo.totalMarketCap');
  });

  it('is null when no path matches', () => {
    expect(figureAt({}, NSE_PATHS.marketCap)).toBeNull();
  });
});

describe('textAt', () => {
  it('takes the first non-empty string', () => {
    expect(textAt(quote(), NSE_PATHS.companyName)).toBe('Example Logistics Limited');
    expect(textAt({ metadata: { companyName: 'Fallback Ltd' } }, NSE_PATHS.companyName)).toBe(
      'Fallback Ltd',
    );
  });

  it('skips an empty string rather than returning it', () => {
    expect(
      textAt({ info: { companyName: '  ' }, metadata: { companyName: 'Real Ltd' } }, NSE_PATHS.companyName),
    ).toBe('Real Ltd');
  });
});

describe('parseNseDate', () => {
  it('reads the shape NSE writes', () => {
    expect(parseNseDate('22-Aug-2026 15:30:00')).toBe('2026-08-22');
    expect(parseNseDate('1-Jan-2026')).toBe('2026-01-01');
  });

  it('is null for anything else', () => {
    expect(parseNseDate('2026-08-22')).toBeNull();
    expect(parseNseDate('22-XXX-2026')).toBeNull();
    expect(parseNseDate(42)).toBeNull();
  });
});

describe('parseNseQuote', () => {
  it('reads a company and a market capitalisation', () => {
    const harvest = parseNseQuote(quote(), 'example', { asOf: ASOF });

    expect(harvest.companies).toEqual([
      {
        name: 'Example Logistics Limited',
        nse_symbol: 'EXAMPLE',
        isin: 'INE000A01001',
        country: 'IN',
        listing_status: 'listed',
        industry: 'Logistics',
        sector: 'Services',
        source: 'nse',
        source_url: 'https://www.nseindia.com/api/quote-equity?symbol=EXAMPLE',
      },
    ]);

    expect(harvest.quotes).toEqual([
      {
        match: { by: 'nse_symbol', value: 'EXAMPLE' },
        as_of: '2026-08-22',
        close_price: 1_234.5,
        shares_outstanding: null,
        market_cap: 4_500_000_000,
        currency: 'INR',
        source: 'nse',
        source_url: 'https://www.nseindia.com/api/quote-equity?symbol=EXAMPLE',
      },
    ]);
    expect(harvest.skipped).toEqual([]);
  });

  it('prefers the quote timestamp over the fallback date', () => {
    // A quote stamped with the day the ingest ran, when it is actually last
    // Friday's close, is a figure that looks current and is not.
    expect(parseNseQuote(quote(), 'X', { asOf: ASOF }).quotes[0].as_of).toBe('2026-08-22');
  });

  it('falls back to the date it was given, not to today, when the timestamp is unreadable', () => {
    const harvest = parseNseQuote(quote({ metadata: { lastUpdateTime: 'rubbish' } }), 'X', {
      asOf: ASOF,
    });
    expect(harvest.quotes[0].as_of).toBe(ASOF);
  });

  it('keeps the company even when the market cap cannot be read, and says which paths it tried', () => {
    /*
     * Deliberate. The symbol, name and ISIN are worth having in the registry
     * either way, and an unlisted-looking row with no multiple is something a
     * reader can see. What it must never do is return a zero.
     */
    const harvest = parseNseQuote(quote({ marketDeptOrderBook: {} }), 'X', { asOf: ASOF });
    expect(harvest.companies).toHaveLength(1);
    expect(harvest.quotes).toHaveLength(0);
    expect(harvest.skipped[0].reason).toContain('marketDeptOrderBook.tradeInfo.totalMarketCap');
    expect(harvest.skipped[0].reason).toContain('securityInfo.totalMarketCap');
  });

  it('refuses the whole response when there is no name, naming the paths', () => {
    // How a renamed key announces itself. Confirming the map is: read this, fix
    // one constant.
    const harvest = parseNseQuote({}, 'X', { asOf: ASOF });
    expect(harvest.companies).toEqual([]);
    expect(harvest.skipped[0].reason).toContain('info.companyName');
    expect(harvest.skipped[0].reason).toContain('metadata.companyName');
  });

  it('uppercases the symbol, since it is an identifier', () => {
    expect(parseNseQuote(quote(), 'example', { asOf: ASOF }).companies[0].nse_symbol).toBe('EXAMPLE');
  });
});

describe('nseHeaders', () => {
  it('sends a Referer from NSE, without which cookies are not enough', () => {
    expect(nseHeaders().Referer).toBe('https://www.nseindia.com/get-quotes/equity');
  });

  it('only sets Cookie when there is one', () => {
    expect(nseHeaders().Cookie).toBeUndefined();
    expect(nseHeaders('a=1').Cookie).toBe('a=1');
  });
});

describe('nseSession', () => {
  function response(over: Partial<{ ok: boolean; status: number; setCookie: string | null }> = {}) {
    const { ok = true, status = 200, setCookie = null } = over;
    return {
      ok,
      status,
      text: async () => '',
      json: async () => ({}),
      headers: { get: (name: string) => (name.toLowerCase() === 'set-cookie' ? setCookie : null) },
    };
  }

  it('keeps the name=value pairs and drops the attributes', () => {
    // Sending Path or HttpOnly back is not just useless, it makes the header
    // malformed and the next request is refused.
    const cookie = nseSession(async () =>
      response({ setCookie: 'nsit=abc; Path=/; HttpOnly, bm_sv=def; Path=/; Secure' }),
    );
    return expect(cookie).resolves.toBe('nsit=abc; bm_sv=def');
  });

  it('warms the quote page as well as the home page', async () => {
    // Two requests, and the second is not optional: the home page sets the
    // bot-protection cookies, the quote page is what NSE expects to have been
    // visited before its API is called. Home alone yields a jar that looks
    // complete and is refused.
    const urls: string[] = [];
    await nseSession(async (url) => {
      urls.push(url);
      return response({ setCookie: 'a=1' });
    }, 'TCS');

    expect(urls).toEqual([
      'https://www.nseindia.com',
      'https://www.nseindia.com/get-quotes/equity?symbol=TCS',
    ]);
  });

  it('merges cookies from both requests, later winning', async () => {
    const cookie = await nseSession(async (url) =>
      response({ setCookie: url.includes('get-quotes') ? 'b=2, a=9' : 'a=1' }),
    );
    expect(cookie).toBe('a=9; b=2');
  });

  it('sends the home cookies when warming the quote page', async () => {
    const sent: (string | undefined)[] = [];
    await nseSession(async (url, init) => {
      sent.push((init?.headers as Record<string, string>).Cookie);
      return response({ setCookie: url.includes('get-quotes') ? null : 'a=1' });
    });
    expect(sent).toEqual([undefined, 'a=1']);
  });

  it('still returns the home cookies when the quote page fails', async () => {
    const cookie = await nseSession(async (url) =>
      url.includes('get-quotes')
        ? response({ ok: false, status: 500 })
        : response({ setCookie: 'a=1' }),
    );
    expect(cookie).toBe('a=1');
  });

  it('is null when the handshake yields no cookies, which is a real outcome', async () => {
    // From a blocked address range the home page answers 200 with a challenge
    // and no Set-Cookie. The caller has to be able to tell that from a network
    // failure and say so in the log.
    await expect(nseSession(async () => response({ setCookie: null }))).resolves.toBeNull();
  });

  it('is null on a non-200', async () => {
    await expect(nseSession(async () => response({ ok: false, status: 503 }))).resolves.toBeNull();
  });
});

describe('fetchNseQuote', () => {
  function ok(json: unknown) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(json),
      json: async () => json,
      headers: { get: () => null },
    };
  }

  it('merges the two endpoints before parsing', async () => {
    // The plain quote carries the name; trade_info carries the capitalisation.
    // Merging first is what lets the path map be corrected in one place when
    // NSE moves a key between them.
    const harvest = await fetchNseQuote(
      async (url) =>
        ok(
          url.includes('trade_info')
            ? { marketDeptOrderBook: { tradeInfo: { totalMarketCap: 45_000 } } }
            : { info: { companyName: 'Example Logistics Limited' }, priceInfo: { lastPrice: 10 } },
        ),
      'example',
      { cookie: 'a=1', asOf: ASOF },
    );

    expect(harvest.companies[0].name).toBe('Example Logistics Limited');
    expect(harvest.quotes[0].market_cap).toBe(4_500_000_000);
  });

  it('sends the cookie on both requests', async () => {
    const seen: string[] = [];
    await fetchNseQuote(
      async (url, init) => {
        seen.push((init?.headers as Record<string, string>).Cookie);
        return ok(quote());
      },
      'X',
      { cookie: 'nsit=abc', asOf: ASOF },
    );
    expect(seen).toEqual(['nsit=abc', 'nsit=abc']);
  });

  it('explains a refusal rather than passing on the number', async () => {
    for (const status of [401, 403]) {
      const harvest = await fetchNseQuote(
        async () => ({ ok: false, status, text: async () => '', json: async () => ({}), headers: { get: () => null } }),
        'X',
        { cookie: 'a=1', asOf: ASOF },
      );
      expect(harvest.skipped[0].reason).toContain('session cookie is missing, stale, or the address is blocked');
    }
  });

  it('carries on without trade_info when only that request fails', async () => {
    const harvest = await fetchNseQuote(
      async (url) =>
        url.includes('trade_info')
          ? { ok: false, status: 500, text: async () => '', json: async () => ({}), headers: { get: () => null } }
          : ok({ info: { companyName: 'Example Logistics Limited' } }),
      'X',
      { cookie: 'a=1', asOf: ASOF },
    );
    expect(harvest.companies).toHaveLength(1);
    expect(harvest.quotes).toHaveLength(0);
    expect(harvest.skipped[0].reason).toContain('No market capitalisation');
  });
});
