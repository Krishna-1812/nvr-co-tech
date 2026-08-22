/**
 * One function per source, each a few lines over the runner.
 *
 * This is what the "one adapter per source" arrangement buys: NSE and EDGAR
 * differ in a session, a header and a URL, and everything else — pacing, writing,
 * resolution, failure isolation, the report — is shared. A fifth source is a
 * function here, not a second runner.
 */

import { EDGAR, MCA_MASTER, NSE } from '../sources';
import { fetchCompanyFacts } from '../sources/edgar';
import { mcaMasterBatch } from '../sources/mcaMaster';
import { fetchNseQuote, nseSession } from '../sources/nse';
import type { Fetcher, Harvest } from '../sources/types';
import { emptyReport, runBatched, runPaced } from './runner';
import type { IngestReport, RunOptions } from './types';

/**
 * NSE, by symbol.
 *
 * The handshake happens once for the whole pass, not per symbol — it is a cookie,
 * and asking for a new one every time would double the request count against the
 * tightest rate limit of any source here. It is seeded with the first symbol in
 * the batch rather than a fixed one, because the warm-up page's Referer names
 * whatever symbol it visited — a session warmed on a symbol nobody asked for
 * looks less like a real visit than one warmed on the first real request.
 *
 * A pass that cannot get cookies returns immediately with one skip saying so
 * rather than making a thousand requests that will all be refused. That refusal
 * is also the most likely one in production: these functions run from `bom1`,
 * which is a datacentre, and NSE challenges datacentre ranges regardless of how
 * polite the client is.
 */
export async function ingestNseSymbols(
  fetcher: Fetcher,
  symbols: readonly string[],
  { asOf, ...options }: RunOptions & { asOf: string },
): Promise<IngestReport> {
  const cookie = await nseSession(fetcher, symbols[0]);
  if (!cookie) {
    const report = emptyReport(NSE.id, false);
    report.requested = symbols.length;
    report.requests = 1;
    report.skipped.push({
      at: 'session',
      reason:
        'NSE returned no cookies from the home page, so no symbol was attempted. Either the address range is blocked or the handshake has changed.',
    });
    report.tally = [{ reason: report.skipped[0].reason, count: 1 }];
    return report;
  }

  return runPaced(
    NSE,
    symbols,
    (symbol) => fetchNseQuote(fetcher, symbol, { cookie, asOf }),
    (symbol) => symbol.toUpperCase(),
    options,
  );
}

/**
 * SEC EDGAR, by CIK.
 *
 * The User-Agent is taken from the adapter rather than from a parameter, because
 * EDGAR requires it to name a real contact and a caller passing whatever it liked
 * would eventually pass nothing. Changing it is a one-line edit in `edgar.ts`
 * where the reason it exists is written down.
 */
export async function ingestEdgarCiks(
  fetcher: Fetcher,
  ciks: readonly string[],
  options: RunOptions,
): Promise<IngestReport> {
  const userAgent = EDGAR.politeness.userAgent ?? 'The Finance Intelligence';
  return runPaced(
    EDGAR,
    ciks,
    (cik) => fetchCompanyFacts(fetcher, cik, userAgent),
    (cik) => cik,
    options,
  );
}

/**
 * MCA master data, from rows the caller has already read.
 *
 * Takes batches rather than a file. The caller streams the CSV — with SheetJS,
 * which already does this job in `src/lib/recon/parse/sheet.ts` — because 3.6
 * million rows will not fit in memory as objects, and because a run that has to
 * be resumed needs the caller to own the cursor.
 */
export async function* mcaBatches(
  batches: Iterable<readonly Record<string, unknown>[]> | AsyncIterable<readonly Record<string, unknown>[]>,
): AsyncGenerator<Harvest> {
  let row = 1;
  for await (const batch of batches) {
    yield mcaMasterBatch(batch, { firstRowNumber: row });
    row += batch.length;
  }
}

export async function ingestMcaRows(
  batches: Iterable<readonly Record<string, unknown>[]> | AsyncIterable<readonly Record<string, unknown>[]>,
  options: RunOptions,
): Promise<IngestReport> {
  return runBatched(MCA_MASTER.id, mcaBatches(batches), options);
}
