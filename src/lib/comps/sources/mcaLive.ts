/**
 * MCA company master data, live — the reachable slice of data.gov.in's own index.
 *
 * `mcaMaster.ts` takes rows somebody already downloaded. This takes them straight
 * from data.gov.in's own search API, resource `ec58dab7-d891-4abb-936e-d5d274a6ce9b`
 * (confirmed live this session, via the network log behind data.gov.in's own
 * "Company Master Data" page — the catalog page's own "Catalog API" link and
 * "Zip Download" both read "not Available" for this resource, so this endpoint,
 * used with the same public sample key data.gov.in's own frontend uses, is the
 * only door in). It reports 4,065,191 companies live, and most of them are not
 * reachable through it — see below.
 *
 * ── The ceiling, found rather than assumed ────────────────────────────────
 *
 * Any query where `offset + limit` exceeds 10,000 fails outright:
 *
 *   "Result window is too large, from + size must be less than or equal to:
 *    [10000] but was [...]. See the scroll api for a more efficient way..."
 *
 * That is Elasticsearch's `index.max_result_window`, a backend setting on
 * data.gov.in's side — not a rate limit, and not something a header, a delay or a
 * different client can move. It applies identically no matter what filter is on
 * the request.
 *
 * Every filterable field was tried against it this session, looking for a way to
 * split a large state's rows into windows under 10,000: `company_status`,
 * `company_class`, `company_category`. None of them have enough cardinality —
 * `Maharashtra + Active + Private + "Company limited by Shares"` is still 239,061
 * rows, because that one combination is nearly the whole state. There is no
 * date-range, numeric-range, or prefix filter either (all tested, all rejected).
 * So `MAX_WINDOW` below is not a number this file chose; it is the true ceiling on
 * what this source can ever return, in one query or many.
 *
 * ── What that means for coverage ──────────────────────────────────────────
 *
 * A state whose own total is at or under `MAX_WINDOW` is fully reachable — ten of
 * them are (see `KNOWN_STATES`), together a shade over 16,000 companies. Every
 * larger state caps at its first 10,000 rows, in whatever order the index
 * happens to return them, which is not documented and not something to assume is
 * representative. `reachableCount` names the number honestly rather than
 * pretending a state's coverage is complete when it is a few percent of it.
 *
 * Real completeness for a large state means a different door: MCA21's own paid
 * bulk export for registered business users, or a licensed reseller who already
 * built one (Tofler, Zauba Corp, Probe42, IndiaFilings). That is a vendor
 * decision for whoever runs this platform to make, not one this file makes for
 * them — the manual upload path in `mcaMaster.ts` stays exactly as it is for
 * whichever export they end up with.
 */

import type { Fetcher } from './types';

const RESOURCE_ID = 'ec58dab7-d891-4abb-936e-d5d274a6ce9b';

/**
 * The public sample key data.gov.in's own frontend bundle uses for
 * unauthenticated access — not a private credential, and the one this platform
 * has: the "Catalog API" application flow on the resource page itself reads "not
 * Available" for this dataset.
 */
const API_KEY = '579b464db66ec23bdd0000015ccfae5e282347146ed579583a2c4559';

/** Elasticsearch's `index.max_result_window` on this resource. See the header. */
export const MAX_WINDOW = 10_000;

/**
 * The real `registered_state` strings this register holds, not India's official
 * state list — two are old names the field was never backfilled from: `Orissa`
 * (not `Odisha`), `Pondicherry` (not `Puducherry`), both found by trial after the
 * current official spelling returned a live total of zero.
 *
 * This is hardcoded rather than discovered from the index, and that is
 * deliberate: there is no endpoint that lists a field's distinct values, and
 * sampling for them would not find the ones that matter most. Sikkim holds 6 of
 * 4,065,191 rows — an unfiltered sample would have to be implausibly large to
 * ever see one, and the small states are exactly the ones with full coverage.
 *
 * `Dadra and Nagar Haveli` is a known gap: several spellings were tried against
 * the live index this session and every one returned zero, so its real spelling
 * here is still unknown. Disclosed rather than guessed at further.
 */
export const KNOWN_STATES: readonly string[] = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Orissa',
  'Pondicherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

/** How much of a state is actually reachable, given its live total. */
export function reachableCount(total: number): number {
  return Math.min(Math.max(total, 0), MAX_WINDOW);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pageUrl({ state, offset, limit }: { state: string; offset: number; limit: number }): string {
  const params = new URLSearchParams({
    format: 'json',
    'api-key': API_KEY,
    limit: String(limit),
    offset: String(offset),
    'filters[registered_state]': state,
  });
  return `https://www.data.gov.in/backend/dataapi/v1/catalog/${RESOURCE_ID}?${params.toString()}`;
}

export type McaLivePage = {
  /** Raw rows, in the same loose shape `mcaMasterRow` already normalises. */
  rows: Record<string, unknown>[];
  /** The state's live total, as reported by this call. */
  total: number;
};

/**
 * One page of one state, straight from data.gov.in.
 *
 * Refuses locally before the request goes out when the window would exceed
 * `MAX_WINDOW` — the same refusal the API itself would give back, caught here so
 * a caller's bug shows up as a clear local error rather than a parsed
 * Elasticsearch stack trace.
 */
export async function fetchMcaLivePage(
  fetcher: Fetcher,
  { state, offset, limit }: { state: string; offset: number; limit: number },
): Promise<McaLivePage> {
  if (offset + limit > MAX_WINDOW) {
    throw new Error(
      `Offset ${offset} plus limit ${limit} exceeds data.gov.in's own ${MAX_WINDOW}-row ceiling for this resource.`,
    );
  }

  const response = await fetcher(pageUrl({ state, offset, limit }));
  if (!response.ok) {
    throw new Error(`data.gov.in answered ${response.status} for ${state}.`);
  }

  const json = await response.json();
  if (!isRecord(json)) {
    throw new Error(`data.gov.in returned an unexpected shape for ${state}.`);
  }

  const total = typeof json.total === 'number' ? json.total : 0;
  const records = Array.isArray(json.records) ? json.records : [];
  return { rows: records.filter(isRecord), total };
}
