/**
 * What the ingest runner needs from the world, and what it hands back.
 *
 * The runner itself does no I/O and reads no clock. It is given a `Writer`, a
 * `Fetcher` and a `Clock`, which is what lets its pacing, batching, resolution
 * and failure handling be tested without a network, a database or a wait — the
 * arrangement the source adapters already use, extended one level up.
 *
 * ── The one open question, stated here rather than assumed away ────────────
 *
 * Every write function in migration 0028 is `grant execute … to authenticated`.
 * That is correct — the registry must not be writable by an anonymous caller —
 * but it means **an ingest process needs a session**, and a background script
 * does not have one.
 *
 * There are three ways out and they are not equivalent:
 *
 *   1. Trigger ingest from an admin screen, in batches, on the operator's own
 *      session. Fits this project as it stands: the ingest is operator work, the
 *      operator is signed in, and `SupabaseWriter` takes whatever client it is
 *      handed. A batch of fifty symbols finishes inside a request; 3.6 million
 *      MCA rows do not.
 *   2. Give a script a dedicated ingest account and put its password in the
 *      environment. Pragmatic for the bulk load, and it is a decision about a
 *      credential rather than a piece of code — so it is the user's to make, not
 *      one to be made quietly by importing a helper.
 *   3. Use a service-role key, which bypasses RLS entirely. **Not available
 *      here**: `.env.local` holds only the URL and the publishable key, on
 *      purpose, and the README says why.
 *
 * So the runner is transport-agnostic and both writers below implement the same
 * interface. Nothing in this directory chooses between 1 and 2.
 */

import type {
  CompanyMatch,
  CompanyRecord,
  FinancialsRecord,
  QuoteRecord,
  Skip,
  SourceId,
} from '../sources/types';

/**
 * Where records go.
 *
 * Each method maps to one SECURITY DEFINER function in migration 0028, which are
 * the only doors into the shared registry. `upsertCompany` returns the id because
 * `upsert_company` does, and because the financials and quotes that follow have
 * no other way to find it.
 */
export type Writer = {
  upsertCompany(record: CompanyRecord): Promise<string>;
  recordFinancials(record: FinancialsRecord, companyId: string): Promise<void>;
  recordQuote(record: QuoteRecord, companyId: string): Promise<void>;
  /**
   * Find a company already in the registry by whichever identifier the source
   * knew. Null when it is not there — which is a skip, never a reason to invent
   * one. `upsert_company` requires a name and a financial statement does not
   * carry one, so a company cannot be conjured out of a set of figures even by
   * accident; this makes that explicit rather than incidental.
   */
  resolve(match: CompanyMatch): Promise<string | null>;
  /**
   * One line of the bill, for a source that charges.
   *
   * Deliberately not called for a free source. `data_lookups` exists to answer
   * "who spent what" and "is the cache paying for itself", and three and a half
   * million rows recording that the MCA bulk file cost nothing would drown both
   * questions. Free-source volumes are reported in the run summary instead.
   */
  recordLookup(entry: LookupEntry): Promise<void>;
};

export type LookupEntry = {
  provider: string;
  kind: string;
  subject: string;
  companyId?: string | null;
  costPaise: number;
  cacheHit: boolean;
  outcome: 'hit' | 'miss' | 'error';
  note?: string | null;
};

/**
 * Time, injected.
 *
 * `now` is only ever used to measure a gap between two requests, so a test can
 * hand over a counter. `sleep` is what the runner calls to pace itself, and a
 * test records the durations instead of waiting for them — which is the whole
 * reason pacing is testable at all.
 */
export type Clock = {
  now(): number;
  sleep(ms: number): Promise<void>;
};

/** A clock that uses the real one. The only place `Date.now` appears. */
export const REAL_CLOCK: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** What one ingest run did. */
export type IngestReport = {
  source: SourceId;
  /** Items asked for — symbols, CIKs, rows. */
  requested: number;
  /** Network requests actually made. Zero for a bulk-file source. */
  requests: number;
  companiesWritten: number;
  financialsWritten: number;
  quotesWritten: number;
  /** Everything the adapters and the writer declined to use, with reasons. */
  skipped: Skip[];
  /** Skips grouped by reason, most frequent first. */
  tally: { reason: string; count: number }[];
  /** Items that threw. Counted separately from a skip: a skip is a judgement. */
  failed: number;
  /** Total time the runner spent waiting to stay inside a rate limit. */
  pausedMs: number;
  /** True when nothing was written, because it was a dry run. */
  dryRun: boolean;
};

export type RunOptions = {
  writer: Writer;
  clock?: Clock;
  /**
   * Stop after this many consecutive failures.
   *
   * A source that has started refusing every request — a stale cookie, a blocked
   * address, an endpoint that moved — will refuse the next thousand too, and
   * grinding through them at three a second turns a five-minute problem into an
   * hour of it while looking like progress. Zero disables the check.
   */
  stopAfterConsecutiveFailures?: number;
  /** Called after each item, for a progress line. */
  onProgress?: (done: number, total: number) => void;
};
