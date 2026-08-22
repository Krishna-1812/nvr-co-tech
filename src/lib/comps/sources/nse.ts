/**
 * NSE India.
 *
 * ⚠️ **The field paths in `NSE_PATHS` are written against the shapes these
 * endpoints have been observed to return, and have NOT been confirmed against a
 * live response from this codebase.** They are the one part of this directory
 * that is a best reading rather than a documented contract, because NSE publishes
 * no API specification and reserves the right to move any key.
 *
 * That is designed around rather than glossed over. Every figure is looked up
 * through an ordered list of candidate paths, and when none of them match, the
 * adapter returns a `Skip` **naming every path it tried**. So confirming the map
 * is: run it against one real response, read the refusal, and correct one
 * constant. What it will never do is return a zero for a figure it could not
 * find — which is the failure that would have put a wrong multiple on a signed
 * schedule with nothing on screen to suggest it.
 *
 * ── The session handshake is real and non-optional ────────────────────────
 *
 * NSE will not answer an API request from a client that has not first been given
 * cookies by the site itself, and it challenges requests from datacentre address
 * ranges regardless. So: fetch the home page, keep the `Set-Cookie`, send it back
 * with a browser-shaped `User-Agent` and `Referer`. Without that the endpoints
 * return a bot-protection page rather than JSON, and the JSON parse fails with a
 * message about an unexpected `<`.
 *
 * ── Which is why nothing here runs inside a request ───────────────────────
 *
 * The Vercel functions for this app run in `bom1`, which is a datacentre. Fetching
 * NSE live, per page view, would be rate-limited at three requests a second
 * across every user of the platform and blocked outright sooner or later. So this
 * adapter belongs in a scheduled ingest that writes to our own registry, and the
 * screens read the registry. That is the right architecture anyway — owning the
 * data is the point, and a comparables schedule must not change because a source
 * was slow.
 *
 * ── The unit trap ─────────────────────────────────────────────────────────
 *
 * NSE reports total market capitalisation **in lakhs** on at least one endpoint,
 * and rupees on others. A hundred-fold error in a market cap is a hundred-fold
 * error in every multiple built from it, and it is not the sort of mistake that
 * looks wrong — 4,400× reads as an implausible multiple, but 44× reads as a
 * slightly expensive one. So the scale is stated per path in the map and applied
 * explicitly, never inferred from the magnitude.
 */

import { parseAmount } from '@/lib/recon/amount';
import type { CompanyRecord, Fetcher, Harvest, QuoteRecord, Skip } from './types';
import { emptyHarvest } from './types';

const SOURCE = 'nse' as const;

const HOME = 'https://www.nseindia.com';

/** Where a quote comes from. `section=trade_info` is what carries market cap. */
export function nseQuoteUrl(symbol: string): string {
  return `${HOME}/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
}

export function nseTradeInfoUrl(symbol: string): string {
  return `${HOME}/api/quote-equity?symbol=${encodeURIComponent(symbol)}&section=trade_info`;
}

/**
 * Browser-shaped headers.
 *
 * Not an attempt at deception — NSE serves a public website and this is a public
 * figure — but its bot protection rejects anything that does not look like a
 * browser, and a request without a `Referer` from its own domain is refused even
 * with valid cookies.
 *
 * `symbol`, when given, is what a real browser's Referer actually carries: a
 * person on `nseindia.com` looking at TCS has `get-quotes/equity?symbol=TCS`
 * in their address bar, and every request that page's script fires — the two
 * behind `fetchNseQuote` included — sends *that* URL back as Referer, not the
 * bare path. A live run from outside a datacentre address got past the cookie
 * handshake and was refused specifically on the quote request itself with a
 * generic Referer in place; a symbol-matched one is the next thing to try
 * before concluding NSE is unreachable outright.
 */
export function nseHeaders(cookie?: string, symbol?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-GB,en;q=0.9',
    Referer: symbol
      ? `${HOME}/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`
      : `${HOME}/get-quotes/equity`,
  };
  if (cookie) headers.Cookie = cookie;
  return headers;
}

/** The name=value pairs out of one or more Set-Cookie headers. */
export function cookiePairs(raw: string | null | undefined): Map<string, string> {
  const jar = new Map<string, string>();
  if (!raw) return jar;

  // One header may carry several cookies. Only the name=value pairs are wanted;
  // the attributes (Path, Expires, HttpOnly) must not be sent back — a header
  // with them in is malformed and the next request is refused.
  for (const part of raw.split(/,(?=\s*[A-Za-z0-9_-]+=)/)) {
    const pair = part.split(';')[0].trim();
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  return jar;
}

/** A cookie jar as a header value. */
export function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

/**
 * Get cookies the way a browser arrives at a quote.
 *
 * **Two requests, not one**, and the second is not optional. The home page sets
 * the bot-protection cookies; the quote page is what NSE expects to have been
 * visited before its API is called, and it sets more. Asking for the home page
 * alone yields a jar that looks complete and is refused — which is exactly the
 * failure this function was written with one request and then corrected for.
 *
 * Returns null when no cookies came back at all, which is a real outcome rather
 * than an error: from a challenged address range the pages answer 200 with a
 * challenge and no `Set-Cookie`, and the caller needs to tell that apart from a
 * network failure and say so in the log.
 *
 * A jar that is complete and still refused is a different answer again, and the
 * one to expect from a datacentre. Nothing here can fix that: it is why ingest is
 * a scheduled job writing to our own registry rather than a live fetch, and if it
 * persists the honest response is a different source for Indian market caps, not
 * a better disguise.
 */
export async function nseSession(fetcher: Fetcher, seedSymbol = 'RELIANCE'): Promise<string | null> {
  const jar = new Map<string, string>();

  const home = await fetcher(HOME, { headers: nseHeaders() });
  if (!home.ok) return null;
  for (const [name, value] of cookiePairs(home.headers?.get('set-cookie'))) jar.set(name, value);

  // The page a browser would actually be on before the API answers anything —
  // warming it, with a Referer that matches it, is what the real flow does.
  const page = await fetcher(
    `${HOME}/get-quotes/equity?symbol=${encodeURIComponent(seedSymbol)}`,
    { headers: nseHeaders(jar.size > 0 ? cookieHeader(jar) : undefined, seedSymbol) },
  );
  if (page.ok) {
    for (const [name, value] of cookiePairs(page.headers?.get('set-cookie'))) jar.set(name, value);
  }

  return jar.size > 0 ? cookieHeader(jar) : null;
}

/**
 * A figure from a source that writes for people.
 *
 * `parseAmount` from the reconciliation engine already handles `₹`, lakh-grouped
 * commas, parenthesised negatives and dash placeholders, and there is no reason
 * for a second implementation of that.
 *
 * What is inverted is its blank convention. A blank cell in a ledger is zero —
 * nothing was posted — so `parseAmount` returns 0. A blank cell in a comparables
 * table is **unknown**, and returning 0 would claim a company earned nothing. So
 * blanks are caught before the call and unparseable values become null instead of
 * throwing.
 */
export function toFigure(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;

  const text = raw.trim();
  if (text === '' || /^[-–—]+$/.test(text) || /^(na|n\/a|nil|null)$/i.test(text)) return null;

  try {
    const value = parseAmount(text);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Read a dotted path out of an unknown object. */
export function readPath(root: unknown, path: string): unknown {
  let node: unknown = root;
  for (const key of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/**
 * Candidate paths per figure, with the scale each one is in.
 *
 * `scale` multiplies what is found, so a market cap reported in lakhs becomes
 * rupees. Stated per path because the same figure genuinely arrives in different
 * units from different endpoints — see the unit trap in the header.
 */
export type PathSpec = { path: string; scale?: number };

export const NSE_PATHS = {
  companyName: [{ path: 'info.companyName' }, { path: 'metadata.companyName' }],
  isin: [{ path: 'info.isin' }, { path: 'metadata.isin' }],
  industry: [{ path: 'info.industry' }, { path: 'industryInfo.industry' }, { path: 'metadata.industry' }],
  sector: [{ path: 'industryInfo.sector' }, { path: 'industryInfo.macro' }],
  lastPrice: [{ path: 'priceInfo.lastPrice' }, { path: 'priceInfo.close' }],
  tradedOn: [{ path: 'metadata.lastUpdateTime' }, { path: 'info.lastUpdateTime' }],
  /**
   * Market capitalisation.
   *
   * The `tradeInfo` path is in **lakhs** — hence the scale of 100,000. The
   * `securityInfo` path, where present, is in rupees. Getting these the wrong way
   * round is a hundred-fold error that reads as merely expensive rather than as
   * obviously wrong, which is why they are separate entries rather than one path
   * with the unit guessed from the value.
   */
  marketCap: [
    { path: 'marketDeptOrderBook.tradeInfo.totalMarketCap', scale: 100_000 },
    { path: 'securityInfo.totalMarketCap' },
  ],
  issuedSize: [{ path: 'securityInfo.issuedSize' }, { path: 'marketDeptOrderBook.tradeInfo.totalTradedVolume' }],
} as const satisfies Record<string, readonly PathSpec[]>;

/** The first path that yields a usable figure, scaled. */
export function figureAt(root: unknown, specs: readonly PathSpec[]): { value: number; path: string } | null {
  for (const spec of specs) {
    const value = toFigure(readPath(root, spec.path));
    if (value !== null) return { value: value * (spec.scale ?? 1), path: spec.path };
  }
  return null;
}

/** The first path that yields a non-empty string. */
export function textAt(root: unknown, specs: readonly PathSpec[]): string | null {
  for (const spec of specs) {
    const value = readPath(root, spec.path);
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

/** What every path in a spec list was, for a refusal a person can act on. */
function pathsTried(specs: readonly PathSpec[]): string {
  return specs.map((s) => s.path).join(', ');
}

/**
 * An NSE date, as ISO.
 *
 * NSE writes `22-Aug-2026 15:30:00`. A date that cannot be read falls back to the
 * caller's `asOf` rather than to today: a quote stamped with the day the ingest
 * ran, when it is actually last Friday's close, is a figure that looks current
 * and is not.
 */
export function parseNseDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(raw.trim());
  if (!m) return null;
  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  };
  const month = months[m[2].toUpperCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
}

/**
 * Turn a quote response into a company and a market capitalisation.
 *
 * `asOf` is the fallback trading date, supplied by the caller — normally the last
 * completed session — because a quote's own timestamp is the better answer and its
 * absence should not become "today".
 *
 * A response with no market cap still yields the COMPANY. That is deliberate: the
 * symbol, name and ISIN are worth having in the registry even when the figure
 * behind them could not be read, and an unlisted-looking peer with no multiple is
 * a row a reader can see rather than a company that silently does not exist.
 */
export function parseNseQuote(
  json: unknown,
  symbol: string,
  { asOf }: { asOf: string },
): Harvest {
  const harvest = emptyHarvest();
  const at = symbol.toUpperCase();

  const name = textAt(json, NSE_PATHS.companyName);
  if (!name) {
    harvest.skipped.push({
      at,
      reason: `No company name found. Tried: ${pathsTried(NSE_PATHS.companyName)}`,
    });
    return harvest;
  }

  const company: CompanyRecord = {
    name,
    nse_symbol: at,
    isin: textAt(json, NSE_PATHS.isin),
    country: 'IN',
    // Its presence on the exchange IS the evidence, and this must be ingested
    // after MCA master data — see the ordering note in cin.ts.
    listing_status: 'listed',
    industry: textAt(json, NSE_PATHS.industry),
    sector: textAt(json, NSE_PATHS.sector),
    source: SOURCE,
    source_url: nseQuoteUrl(at),
  };
  harvest.companies.push(company);

  const marketCap = figureAt(json, NSE_PATHS.marketCap);
  const price = figureAt(json, NSE_PATHS.lastPrice);
  const traded = parseNseDate(readPath(json, 'metadata.lastUpdateTime')) ?? asOf;

  if (!marketCap) {
    harvest.skipped.push({
      at,
      reason: `No market capitalisation found, so no multiple can be computed. Tried: ${pathsTried(NSE_PATHS.marketCap)}`,
    });
    return harvest;
  }

  const quote: QuoteRecord = {
    match: { by: 'nse_symbol', value: at },
    as_of: traded,
    close_price: price ? price.value : null,
    shares_outstanding: null,
    market_cap: marketCap.value,
    currency: 'INR',
    source: SOURCE,
    source_url: nseQuoteUrl(at),
  };
  harvest.quotes.push(quote);

  return harvest;
}

/**
 * Fetch one symbol's quote.
 *
 * Two requests, and both are needed: the plain quote carries the name and ISIN,
 * the `trade_info` section carries the capitalisation. They are merged before
 * parsing so the path map does not have to know which response a key came from —
 * which is also what lets the map be corrected in one place when NSE moves a key
 * between the two.
 */
export async function fetchNseQuote(
  fetcher: Fetcher,
  symbol: string,
  { cookie, asOf }: { cookie: string; asOf: string },
): Promise<Harvest> {
  const at = symbol.toUpperCase();
  const headers = nseHeaders(cookie, at);

  const [base, trade] = await Promise.all([
    fetcher(nseQuoteUrl(at), { headers }),
    fetcher(nseTradeInfoUrl(at), { headers }),
  ]);

  if (!base.ok) {
    const harvest = emptyHarvest();
    const skip: Skip = {
      at,
      reason:
        base.status === 401 || base.status === 403
          ? 'NSE refused the request. The session cookie is missing, stale, or the address is blocked.'
          : `NSE answered ${base.status}`,
    };
    harvest.skipped.push(skip);
    return harvest;
  }

  const merged = {
    ...(asObject(await base.json()) ?? {}),
    ...(trade.ok ? (asObject(await trade.json()) ?? {}) : {}),
  };

  return parseNseQuote(merged, at, { asOf });
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export const NSE = {
  id: SOURCE,
  label: 'NSE India',
  politeness: {
    // Three per second is where NSE's unofficial clients settled, well under
    // EDGAR's ten, and it challenges datacentre ranges regardless — which is why
    // this belongs in a scheduled ingest and not in a request.
    requestsPerSecond: 3,
    needsSession: true,
  },
} as const;
