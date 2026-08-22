/**
 * Preview fixtures for Valuation Desk.
 *
 * ── Every name here is invented, and that is not a detail ─────────────────
 *
 * The obvious way to build these would have been to take eight real listed
 * logistics companies and put plausible figures against them. That is precisely
 * the mistake this project already made once and had to unpick: `/analytics`
 * spent weeks showing "Hostroyale Technologies" and "steel-axis LLC" as visiting
 * companies because a name had been derived rather than observed, and the fix was
 * to refuse a name the evidence did not support.
 *
 * A screenshot of this screen showing a real company at a revenue it does not
 * have is the same thing wearing a different hat, and it would be far more
 * damaging: somebody would quote it. So the peer set is fictional, the amber
 * preview banner says the whole app is on sample data, and the names are chosen
 * to be unmistakably invented.
 *
 * ── The set is built to exercise the refusals, not the happy path ─────────
 *
 * Six of the eight are ordinary. The other two are the point:
 *
 *   * **Vindhya Roadlines** is loss-making at EBITDA, so it contributes to
 *     EV/Revenue and drops out of EV/EBITDA and P/E — and because it is cheap on
 *     revenue it also lands outside the 1.5 × IQR fence, so the screen has to
 *     show an outlier it has deliberately not removed.
 *   * **Coromandel Parcel Services** is unlisted, so it has figures and no
 *     multiples at all.
 *   * **Malabar Transport** has a market capitalisation and no revenue, which is
 *     what a company that has not filed looks like. Its cells must render as
 *     dashes rather than zeros.
 *
 * If a future change makes those three render like the other five, something has
 * started substituting a default for an unknown.
 *
 * Figures are in rupees, as the real adapters would write them — the ₹ crore on
 * screen is a display decision, not a storage one.
 */

const CR = 10_000_000;

/** One fictional peer, before it becomes rows in three tables. */
type Seed = {
  id: string;
  name: string;
  symbol: string | null;
  listed: boolean;
  /** All in ₹ crore, for legibility here. Multiplied out below. */
  revenue: number | null;
  priorRevenue: number | null;
  ebitda: number | null;
  ebit: number | null;
  pat: number | null;
  debt: number | null;
  cash: number | null;
  marketCap: number | null;
};

const SEEDS: Seed[] = [
  {
    id: 'co-meridian',
    name: 'Meridian Logistics Ltd',
    symbol: 'MERIDLOG',
    listed: true,
    revenue: 1_200,
    priorRevenue: 1_020,
    ebitda: 180,
    ebit: 132,
    pat: 90,
    debt: 250,
    cash: 80,
    marketCap: 3_600,
  },
  {
    id: 'co-sahyadri',
    name: 'Sahyadri Freightways Ltd',
    symbol: 'SAHYFRT',
    listed: true,
    revenue: 850,
    priorRevenue: 780,
    ebitda: 119,
    ebit: 86,
    pat: 62,
    debt: 180,
    cash: 40,
    marketCap: 2_400,
  },
  {
    id: 'co-konkan',
    name: 'Konkan Supply Chain Ltd',
    symbol: 'KONKANSC',
    listed: true,
    revenue: 2_100,
    priorRevenue: 1_760,
    ebitda: 252,
    ebit: 190,
    pat: 130,
    debt: 500,
    cash: 150,
    marketCap: 5_200,
  },
  {
    id: 'co-deccan',
    name: 'Deccan Warehousing Ltd',
    symbol: 'DECCANWH',
    listed: true,
    revenue: 640,
    priorRevenue: 505,
    ebitda: 128,
    ebit: 101,
    pat: 70,
    debt: 90,
    cash: 60,
    marketCap: 2_900,
  },
  {
    id: 'co-nilgiri',
    name: 'Nilgiri Cold Chain Ltd',
    symbol: 'NILGCC',
    listed: true,
    revenue: 410,
    priorRevenue: 330,
    ebitda: 74,
    ebit: 52,
    pat: 31,
    debt: 220,
    cash: 25,
    marketCap: 1_450,
  },
  {
    // Loss-making, and cheap on revenue because of it. Contributes to
    // EV/Revenue, drops out of the other two, and flags as an outlier.
    id: 'co-vindhya',
    name: 'Vindhya Roadlines Ltd',
    symbol: 'VINDHYARL',
    listed: true,
    revenue: 1_540,
    priorRevenue: 1_610,
    ebitda: -46,
    ebit: -118,
    pat: -95,
    debt: 640,
    cash: 30,
    marketCap: 980,
  },
  {
    // Unlisted: figures, and no multiples at all.
    id: 'co-coromandel',
    name: 'Coromandel Parcel Services Pvt Ltd',
    symbol: null,
    listed: false,
    revenue: 520,
    priorRevenue: 445,
    ebitda: 62,
    ebit: 40,
    pat: 24,
    debt: 130,
    cash: 18,
    marketCap: null,
  },
  {
    // Listed, and has not filed. Every figure cell must be a dash, not a zero.
    id: 'co-malabar',
    name: 'Malabar Transport Ltd',
    symbol: 'MALABARTR',
    listed: true,
    revenue: null,
    priorRevenue: null,
    ebitda: null,
    ebit: null,
    pat: 18,
    debt: null,
    cash: null,
    marketCap: 690,
  },
];

const PERIOD_END = '2026-03-31';
const PRIOR_END = '2025-03-31';
const QUOTE_AS_OF = '2026-08-21';

const rupees = (crore: number | null): number | null => (crore === null ? null : crore * CR);

/**
 * The subject: an unlisted client, which is the normal case for this audience.
 *
 * Deliberately smaller than every listed peer. A valuer's client usually is, and
 * a screen that only ever shows a subject comfortably inside its peer band would
 * never surface the size caveat that most real engagements need.
 */
export const PREVIEW_SUBJECT = {
  name: 'Aravalli Logistics Pvt Ltd',
  currency: 'INR',
  periodEnd: PERIOD_END,
  basis: 'consolidated' as const,
  revenue: 380 * CR,
  ebitda: 53 * CR,
  pat: 21 * CR,
  totalDebt: 95 * CR,
  cash: 22 * CR,
};

export const companies = SEEDS.map((s) => ({
  id: s.id,
  cin: `${s.listed ? 'L' : 'U'}63030MH20${s.id.length}PLC0${s.id.length}9481`,
  isin: null,
  nse_symbol: s.symbol,
  bse_code: null,
  cik: null,
  lei: null,
  name: s.name,
  legal_name: null,
  country: 'IN',
  listing_status: s.listed ? 'listed' : 'unlisted',
  incorporated_on: '2009-06-15',
  registered_state: 'Maharashtra',
  nic_code: '63030',
  sic_code: null,
  industry: 'Freight transport and warehousing',
  sector: 'Services',
  business_description:
    'Road freight, contract logistics and warehousing for manufacturers and retailers across western and southern India.',
  embedding: null,
  embedding_model: null,
  source: 'preview',
  source_url: null,
  first_seen: '2026-08-01T00:00:00Z',
  last_refreshed: '2026-08-21T00:00:00Z',
}));

export const company_financials = SEEDS.flatMap((s) => [
  {
    id: `${s.id}-fy26`,
    company_id: s.id,
    period_start: '2025-04-01',
    period_end: PERIOD_END,
    fy_label: '25-26',
    months: 12,
    basis: 'consolidated',
    revenue: rupees(s.revenue),
    other_income: null,
    ebitda: rupees(s.ebitda),
    ebit: rupees(s.ebit),
    pat: rupees(s.pat),
    total_assets: null,
    net_worth: null,
    total_debt: rupees(s.debt),
    cash: rupees(s.cash),
    employees: null,
    currency: 'INR',
    is_audited: true,
    source: 'preview',
    source_url: null,
    source_document_id: null,
    as_of: '2026-06-30',
    fetched_at: '2026-08-01T00:00:00Z',
  },
  // The prior year, so the growth column and the growth screen have something
  // to read. Only revenue is seeded: nothing on screen needs the rest of it.
  {
    id: `${s.id}-fy25`,
    company_id: s.id,
    period_start: '2024-04-01',
    period_end: PRIOR_END,
    fy_label: '24-25',
    months: 12,
    basis: 'consolidated',
    revenue: rupees(s.priorRevenue),
    other_income: null,
    ebitda: null,
    ebit: null,
    pat: null,
    total_assets: null,
    net_worth: null,
    total_debt: null,
    cash: null,
    employees: null,
    currency: 'INR',
    is_audited: true,
    source: 'preview',
    source_url: null,
    source_document_id: null,
    as_of: '2025-06-30',
    fetched_at: '2026-08-01T00:00:00Z',
  },
]);

export const company_quotes = SEEDS.filter((s) => s.marketCap !== null).map((s) => ({
  id: `${s.id}-q`,
  company_id: s.id,
  as_of: QUOTE_AS_OF,
  close_price: null,
  shares_outstanding: null,
  market_cap: rupees(s.marketCap),
  currency: 'INR',
  source: 'preview',
  source_url: null,
  fetched_at: '2026-08-21T00:00:00Z',
}));

export const funding_rounds: unknown[] = [];
export const source_documents: unknown[] = [];
export const peer_sets: unknown[] = [];
export const peer_set_members: unknown[] = [];
export const valuations: unknown[] = [];
export const data_lookups: unknown[] = [];
