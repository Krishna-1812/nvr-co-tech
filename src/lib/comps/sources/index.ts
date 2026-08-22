/**
 * The source registry.
 *
 * One entry per adapter, so the ingest runner can pace itself against each
 * source's own limits and the provenance line on screen can name the source
 * without every screen importing every adapter.
 *
 * BSE is deliberately absent. It overlaps NSE almost completely for the companies
 * this tool cares about, its XBRL financial-results feed needs one real sample to
 * map, and a second exchange adapter that returns the same figures under a
 * different key is cost without coverage. It belongs here the day a company shows
 * up that is listed on BSE and not NSE — of which there are a few hundred, all
 * small — and not before.
 */

import { EDGAR } from './edgar';
import { MCA_MASTER } from './mcaMaster';
import { NSE } from './nse';
import type { SourceAdapter, SourceId } from './types';

export const SOURCES = { mca_master: MCA_MASTER, nse: NSE, sec_edgar: EDGAR } as const;

export function sourceById(id: SourceId): SourceAdapter | null {
  if (id === 'bse') return null;
  return SOURCES[id];
}

/**
 * The order a full ingest has to run in.
 *
 * Not alphabetical and not arbitrary. `upsert_company` in migration 0028 lets a
 * later non-'unknown' listing status overwrite an earlier one, and the MCA's CIN
 * only records what was true when the number was allotted — so master data must
 * land first and the exchange must correct it. Reversed, a bulk MCA pass relabels
 * every listed company in the registry as unlisted, and nothing looks wrong until
 * a peer set comes back empty. See the header of cin.ts.
 */
export const INGEST_ORDER: readonly SourceId[] = ['mca_master', 'nse', 'sec_edgar'] as const;

/**
 * The minimum gap between requests to a source, in milliseconds.
 *
 * Returned as data for the runner to sleep on rather than enforced here, so no
 * test has to wait for a real clock.
 */
export function minimumGapMs(adapter: SourceAdapter): number {
  const rate = Math.max(adapter.politeness.requestsPerSecond, 0.1);
  return Math.ceil(1000 / rate);
}

export * from './types';
export { parseCin, isCin, cinDisqualifies } from './cin';
export { EDGAR, MCA_MASTER, NSE };
