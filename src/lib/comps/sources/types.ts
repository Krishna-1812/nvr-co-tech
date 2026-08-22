/**
 * One adapter per source, behind one interface.
 *
 * Every figure this tool shows comes from somewhere that can change without
 * telling us. NSE reshuffles a JSON key, the MCA renames a CSV column, a state's
 * master-data file arrives with different headers from the last one. That is the
 * normal condition of free data and not a reason to avoid it — but it does decide
 * the shape of this directory: **a broken source must be a one-file fix.**
 *
 * So each source is a module that knows only about its own wire format and emits
 * the same normalised records. Nothing above this directory knows the difference
 * between a company that arrived from the MCA and one that arrived from EDGAR,
 * beyond the `source` string stamped on every record — which exists precisely so
 * that difference can be seen when it matters.
 *
 * ── Fetching is injected, parsing is pure ─────────────────────────────────
 *
 * The `Fetcher` type is the seam. Adapters never reach for global `fetch`; they
 * are handed one, so every test in this directory runs offline against fixed
 * responses. That is the same arrangement `src/lib/analytics/ip/gate.test.ts`
 * uses to test the identification gate without a network, and the reason most of
 * its assertions can be about a refusal.
 *
 * The mapping functions go further and take no fetcher at all — they take the
 * text or the parsed JSON. That is where the decisions live, so that is where the
 * tests are. A fetch wrapper that has nothing in it but a URL and a header cannot
 * be meaningfully unit-tested and does not need to be.
 *
 * ── Nothing here writes to the database ───────────────────────────────────
 *
 * An adapter returns records. The ingest caller passes them to `upsert_company`,
 * `record_financials` and `record_quote` — the SECURITY DEFINER functions in
 * migration 0028, which are the only doors into the shared registry. Keeping the
 * two apart means an adapter can be run against a real source and its output
 * eyeballed before anything is written, which is how the field maps in here are
 * meant to be confirmed.
 */

/** Which source a record came from. Stamped on every row for provenance. */
export type SourceId = 'mca_master' | 'nse' | 'bse' | 'sec_edgar';

/** A minimal response, so a test can hand over an object literal. */
export type FetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
  headers?: { get(name: string): string | null };
};

/** What an adapter is given instead of global fetch. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<FetchResponse>;

/**
 * A company, in the shape `upsert_company(jsonb)` wants.
 *
 * Field names are snake_case to match the payload keys the function reads,
 * deliberately breaking this codebase's camelCase habit. The alternative is a
 * translation layer between the adapter and the RPC call whose only job is
 * renaming, which is one more place a key can be misspelled with no type to
 * catch it.
 */
export type CompanyRecord = {
  name: string;
  cin?: string | null;
  isin?: string | null;
  nse_symbol?: string | null;
  bse_code?: string | null;
  cik?: string | null;
  lei?: string | null;
  legal_name?: string | null;
  country?: string;
  listing_status?: 'listed' | 'unlisted' | 'delisted' | 'unknown';
  incorporated_on?: string | null;
  registered_state?: string | null;
  nic_code?: string | null;
  sic_code?: string | null;
  industry?: string | null;
  sector?: string | null;
  business_description?: string | null;
  source: SourceId;
  source_url?: string | null;
};

/** One reporting period, in the shape `record_financials(jsonb)` wants. */
export type FinancialsRecord = {
  /** Resolved by the caller after upsert_company returns an id. */
  company_id?: string;
  /** How the caller finds the company: whichever identifier the source knew. */
  match: CompanyMatch;
  period_start?: string | null;
  period_end: string;
  fy_label?: string | null;
  months?: number | null;
  basis: 'standalone' | 'consolidated';
  revenue?: number | null;
  other_income?: number | null;
  ebitda?: number | null;
  ebit?: number | null;
  pat?: number | null;
  total_assets?: number | null;
  net_worth?: number | null;
  total_debt?: number | null;
  cash?: number | null;
  employees?: number | null;
  currency: string;
  is_audited?: boolean | null;
  source: SourceId;
  source_url?: string | null;
  as_of?: string | null;
};

/** One market capitalisation, in the shape `record_quote(jsonb)` wants. */
export type QuoteRecord = {
  company_id?: string;
  match: CompanyMatch;
  as_of: string;
  close_price?: number | null;
  shares_outstanding?: number | null;
  market_cap?: number | null;
  currency: string;
  source: SourceId;
  source_url?: string | null;
};

/**
 * How a financials or quote row names the company it belongs to.
 *
 * A source knows the identifier it uses and nothing else — NSE has a symbol,
 * EDGAR has a CIK, the MCA has a CIN — so an adapter cannot hand back a UUID and
 * must not invent one. The caller resolves this against the registry, and a match
 * that resolves to nothing is a skip with a reason rather than a new company
 * conjured out of a financial statement.
 */
export type CompanyMatch =
  | { by: 'cin'; value: string }
  | { by: 'nse_symbol'; value: string }
  | { by: 'bse_code'; value: string }
  | { by: 'isin'; value: string }
  | { by: 'cik'; value: string };

/**
 * Something the adapter looked at and did not use.
 *
 * The same discipline as `Rejection` in the peer screen and
 * `excluded_reason` in migration 0028. An ingest run that reports "2,317
 * companies loaded" and says nothing about the 46 rows it could not read is
 * hiding the only part of its output that needs attention — and those 46 are
 * usually where a renamed column first shows up.
 */
export type Skip = {
  /** Row number, CIN, symbol — whatever identifies it in the source. */
  at: string;
  reason: string;
};

/** What every adapter returns. */
export type Harvest = {
  companies: CompanyRecord[];
  financials: FinancialsRecord[];
  quotes: QuoteRecord[];
  skipped: Skip[];
};

/** An empty harvest, so an adapter that finds nothing still returns the shape. */
export function emptyHarvest(): Harvest {
  return { companies: [], financials: [], quotes: [], skipped: [] };
}

/** Merge harvests from several files or pages into one. */
export function mergeHarvests(parts: readonly Harvest[]): Harvest {
  const all = emptyHarvest();
  for (const part of parts) {
    all.companies.push(...part.companies);
    all.financials.push(...part.financials);
    all.quotes.push(...part.quotes);
    all.skipped.push(...part.skipped);
  }
  return all;
}

/**
 * How to be a good citizen of a source we are not paying.
 *
 * Declared as data rather than enforced in here, so the ingest runner can pace
 * itself and a test never has to wait. The numbers are not decoration:
 *
 *   * SEC EDGAR publishes a hard 10 requests per second across all its domains
 *     and returns 403 without a `User-Agent` naming a person to contact. Both are
 *     stated policy, not observed behaviour.
 *   * NSE throttles well below that and challenges requests from datacentre
 *     addresses. Three per second is what its unofficial clients settled on.
 *
 * Exceeding either gets the IP blocked, which for a free source is a
 * self-inflicted outage with no support desk to call.
 */
export type Politeness = {
  requestsPerSecond: number;
  /** Sent as User-Agent. Required by EDGAR; good manners everywhere else. */
  userAgent?: string;
  /** Whether the source needs a cookie handshake before it answers. */
  needsSession?: boolean;
};

/** Every adapter declares itself. */
export type SourceAdapter = {
  id: SourceId;
  /** What it is, for the ingest log and the provenance line on screen. */
  label: string;
  politeness: Politeness;
};
