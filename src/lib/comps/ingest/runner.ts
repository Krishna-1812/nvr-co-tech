/**
 * The ingest runner.
 *
 * Takes a list of things to fetch, paces itself against the source's own limits,
 * writes what comes back through the functions in migration 0028, and reports
 * what it could not use and why.
 *
 * Four rules, all of which exist because of how this goes wrong in practice.
 *
 * **One item cannot break a run.** Every fetch is wrapped, and a throw becomes a
 * counted failure with the message attached. Three and a half million rows will
 * contain something no parser survives, and a run that dies on row 240,000 has
 * wasted the 239,999 before it unless they were already written — which is why
 * writes happen per item rather than in one transaction at the end.
 *
 * **A run that has started failing every request stops.** A stale NSE cookie or
 * a blocked address refuses the next thousand requests exactly as fast as the
 * first, and grinding through them at three a second looks like progress for an
 * hour. `stopAfterConsecutiveFailures` is what turns that into a five-minute
 * problem.
 *
 * **Companies are written before the figures that point at them.** Financials
 * and quotes arrive carrying an identifier, not a UUID, so they have to be
 * resolved — from the companies written moments ago where possible, and from the
 * registry otherwise. A figure whose company cannot be resolved is skipped. It is
 * never used to create one: `upsert_company` requires a name, a balance sheet
 * does not carry one, and a company invented out of a set of figures would sit in
 * the registry forever matching nothing.
 *
 * **Pacing is measured, not assumed.** The runner records when it last called a
 * source and waits out the remainder of the gap, rather than sleeping the full
 * interval every time. Parsing a large EDGAR response takes long enough that
 * sleeping the whole 100ms afterwards would roughly halve the throughput for no
 * benefit to the SEC.
 */

import { minimumGapMs } from '../sources';
import type { CompanyMatch, Harvest, Skip, SourceAdapter, SourceId } from '../sources/types';
import { tallySkips } from '../sources/mcaMaster';
import type { Clock, IngestReport, RunOptions, Writer } from './types';
import { REAL_CLOCK } from './types';

/** A key for one identifier, so a match can be looked up in a plain Map. */
export function matchKey(match: CompanyMatch): string {
  return `${match.by}:${match.value.toUpperCase()}`;
}

/**
 * Every identifier a company record carries, as match keys.
 *
 * All of them, not just the one the source considers primary: a quote that
 * arrives keyed on an ISIN can then resolve against a company that was written
 * keyed on a symbol, without a round trip and without either source having to
 * know about the other.
 */
export function keysOf(record: {
  cin?: string | null;
  nse_symbol?: string | null;
  bse_code?: string | null;
  isin?: string | null;
  cik?: string | null;
}): string[] {
  const keys: string[] = [];
  if (record.cin) keys.push(matchKey({ by: 'cin', value: record.cin }));
  if (record.nse_symbol) keys.push(matchKey({ by: 'nse_symbol', value: record.nse_symbol }));
  if (record.bse_code) keys.push(matchKey({ by: 'bse_code', value: record.bse_code }));
  if (record.isin) keys.push(matchKey({ by: 'isin', value: record.isin }));
  if (record.cik) keys.push(matchKey({ by: 'cik', value: record.cik }));
  return keys;
}

/**
 * Write one harvest, resolving figures against the companies in it.
 *
 * `known` is carried across harvests within a run, so a symbol fetched on the
 * first page is still resolvable on the fiftieth without asking the database
 * again. It is a cache of things this process itself wrote, so it cannot be
 * stale in the way a read cache can.
 *
 * The company loop is wrapped per record rather than left to throw. For NSE
 * and EDGAR a harvest never carries more than one company, so this changes
 * nothing observable there — a throw was already equivalent to failing that
 * one item, just reported by the caller's own try/catch instead of this
 * function's. It matters once a harvest can carry hundreds, as a bulk MCA
 * batch does: without this, company 37 failing to upsert would abandon
 * companies 38 through 100 along with it, the opposite of "one item cannot
 * break a run".
 */
export async function writeHarvest(
  harvest: Harvest,
  writer: Writer,
  known: Map<string, string>,
): Promise<{ companies: number; financials: number; quotes: number; skipped: Skip[] }> {
  const skipped: Skip[] = [...harvest.skipped];
  let companies = 0;

  for (const record of harvest.companies) {
    try {
      const id = await writer.upsertCompany(record);
      companies += 1;
      for (const key of keysOf(record)) known.set(key, id);
    } catch (error) {
      skipped.push({ at: record.cin ?? record.name, reason: `Threw: ${messageOf(error)}` });
    }
  }

  const resolve = async (match: CompanyMatch, at: string): Promise<string | null> => {
    const cached = known.get(matchKey(match));
    if (cached) return cached;

    const found = await writer.resolve(match);
    if (found) {
      known.set(matchKey(match), found);
      return found;
    }

    skipped.push({
      at,
      reason: `No company in the registry with ${match.by} ${match.value}, so this figure has nothing to attach to`,
    });
    return null;
  };

  let financials = 0;
  for (const record of harvest.financials) {
    const id = await resolve(record.match, `${record.match.value} ${record.period_end}`);
    if (!id) continue;
    await writer.recordFinancials(record, id);
    financials += 1;
  }

  let quotes = 0;
  for (const record of harvest.quotes) {
    const id = await resolve(record.match, `${record.match.value} ${record.as_of}`);
    if (!id) continue;
    await writer.recordQuote(record, id);
    quotes += 1;
  }

  return { companies, financials, quotes, skipped };
}

/** A blank report, so a run that does nothing still returns the shape. */
export function emptyReport(source: SourceId, dryRun: boolean): IngestReport {
  return {
    source,
    requested: 0,
    requests: 0,
    companiesWritten: 0,
    financialsWritten: 0,
    quotesWritten: 0,
    skipped: [],
    tally: [],
    failed: 0,
    pausedMs: 0,
    dryRun,
  };
}

/**
 * Wait out whatever is left of the source's minimum gap.
 *
 * Returns how long it actually waited, so the report can say how much of a run
 * was spent being polite. On a thousand-symbol NSE pass that is over five
 * minutes, and knowing it is pacing rather than a slow source is the difference
 * between leaving it alone and going looking for a problem.
 */
export async function pace(
  adapter: SourceAdapter,
  clock: Clock,
  lastAt: number | null,
): Promise<number> {
  if (lastAt === null) return 0;
  const gap = minimumGapMs(adapter);
  const waited = gap - (clock.now() - lastAt);
  if (waited <= 0) return 0;
  await clock.sleep(waited);
  return waited;
}

/** One item's worth of work: fetch it, and say what came back. */
export type ItemTask<T> = (item: T) => Promise<Harvest>;

/**
 * Run a paced pass over a list of items.
 *
 * The general shape every network source uses. `task` does the fetching and
 * parsing for one item and is the only part that differs between NSE and EDGAR,
 * which is why they are two thin functions below rather than two runners.
 */
export async function runPaced<T>(
  adapter: SourceAdapter,
  items: readonly T[],
  task: ItemTask<T>,
  label: (item: T) => string,
  options: RunOptions,
): Promise<IngestReport> {
  const clock = options.clock ?? REAL_CLOCK;
  const limit = options.stopAfterConsecutiveFailures ?? 25;
  const known = new Map<string, string>();
  const report = emptyReport(adapter.id, false);
  report.requested = items.length;

  let lastAt: number | null = null;
  let consecutiveFailures = 0;

  for (const [index, item] of items.entries()) {
    report.pausedMs += await pace(adapter, clock, lastAt);
    lastAt = clock.now();
    report.requests += 1;

    try {
      const harvest = await task(item);
      const written = await writeHarvest(harvest, options.writer, known);
      report.companiesWritten += written.companies;
      report.financialsWritten += written.financials;
      report.quotesWritten += written.quotes;
      report.skipped.push(...written.skipped);
      consecutiveFailures = 0;
    } catch (error) {
      report.failed += 1;
      consecutiveFailures += 1;
      report.skipped.push({ at: label(item), reason: `Threw: ${messageOf(error)}` });

      if (limit > 0 && consecutiveFailures >= limit) {
        report.skipped.push({
          at: label(item),
          reason: `Stopped after ${consecutiveFailures} consecutive failures, with ${items.length - index - 1} items not attempted`,
        });
        break;
      }
    }

    options.onProgress?.(index + 1, items.length);
  }

  report.tally = tallySkips(report.skipped);
  return report;
}

/** An error's message, whatever was actually thrown. */
export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return JSON.stringify(error);
}

/**
 * Run a batched pass over rows that are already in hand.
 *
 * For a bulk file there is nothing to pace — the download happened once — so this
 * skips the clock entirely. `requests` stays at zero, which is accurate and is
 * also how the summary distinguishes a bulk load from a per-item one.
 *
 * Batches rather than one call, because three and a half million rows will not
 * fit in memory as objects and a skip list of two million dormant companies is
 * not a report anybody reads. The caller streams the file; this writes a chunk at
 * a time and keeps only the tally.
 */
export async function runBatched(
  source: SourceId,
  batches: AsyncIterable<Harvest> | Iterable<Harvest>,
  options: RunOptions,
): Promise<IngestReport> {
  const known = new Map<string, string>();
  const report = emptyReport(source, false);

  for await (const harvest of batches) {
    report.requested += harvest.companies.length + harvest.skipped.length;
    try {
      const written = await writeHarvest(harvest, options.writer, known);
      report.companiesWritten += written.companies;
      report.financialsWritten += written.financials;
      report.quotesWritten += written.quotes;
      report.skipped.push(...written.skipped);
    } catch (error) {
      report.failed += 1;
      report.skipped.push({ at: 'batch', reason: `Threw: ${messageOf(error)}` });
    }
    options.onProgress?.(report.requested, report.requested);
  }

  report.tally = tallySkips(report.skipped);
  return report;
}

/**
 * A one-line summary, for a terminal.
 *
 * Leads with what was written and then with what was not, and never omits the
 * second half. A run that reports "2,317 companies" and says nothing about the
 * 46 rows it could not read is hiding the only part of its output that needs
 * attention — and those 46 are usually where a renamed column first shows up.
 */
export function summarise(report: IngestReport): string {
  const parts = [
    `${report.source}${report.dryRun ? ' (dry run)' : ''}`,
    `${report.companiesWritten} companies`,
  ];
  if (report.financialsWritten) parts.push(`${report.financialsWritten} periods`);
  if (report.quotesWritten) parts.push(`${report.quotesWritten} quotes`);
  if (report.skipped.length) parts.push(`${report.skipped.length} skipped`);
  if (report.failed) parts.push(`${report.failed} failed`);
  if (report.pausedMs >= 1000) parts.push(`${Math.round(report.pausedMs / 1000)}s paced`);
  return parts.join(' · ');
}

/**
 * The skips, grouped, as lines for a terminal.
 *
 * This is the part worth reading. On a first run against NSE it is where the
 * field map announces which of its guesses were wrong, and every one of those
 * reasons names the paths it tried.
 */
export function skipLines(report: IngestReport, limit = 20): string[] {
  return report.tally.slice(0, limit).map(({ reason, count }) => `  ${String(count).padStart(7)}  ${reason}`);
}
