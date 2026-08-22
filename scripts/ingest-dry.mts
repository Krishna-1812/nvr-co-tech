/**
 * A dry ingest run: fetch from a real source, write nothing, print what came
 * back and what did not.
 *
 * This exists for one job before it exists for any other. The NSE field paths in
 * `src/lib/comps/sources/nse.ts` are a best reading of an API with no published
 * specification, and the only way to confirm them is to look at a real response.
 * So:
 *
 *     npm run ingest:dry -- --source nse --symbols RELIANCE,TCS,INFY
 *
 * and read the skip lines. Every refusal names the paths it tried, so a wrong
 * guess becomes a one-constant fix rather than a mystery. Nothing is written to
 * the database — this uses the in-memory writer — so it can be run before
 * migration 0028 is applied and before the session question in
 * `src/lib/comps/ingest/types.ts` is settled.
 *
 * EDGAR works the same way and needs no session at all, which makes it the
 * quickest way to prove the pipeline itself is sound:
 *
 *     npm run ingest:dry -- --source edgar --ciks 320193,789019
 *
 * A note on where this runs from. NSE challenges datacentre address ranges, so
 * this will very likely work from a laptop and fail from a server. If the
 * handshake comes back with no cookies, that is the answer rather than a bug —
 * and it is the reason ingest belongs in a scheduled job writing to our own
 * registry rather than in a request.
 */

import { ingestEdgarCiks, ingestNseSymbols } from '../src/lib/comps/ingest/passes';
import { skipLines, summarise } from '../src/lib/comps/ingest/runner';
import { MemoryWriter } from '../src/lib/comps/ingest/writers';
import type { Fetcher, FetchResponse } from '../src/lib/comps/sources/types';

/** `--flag value` pairs, and nothing cleverer. */
function args(argv: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const next = argv[i + 1];
    out[token.slice(2)] = next && !next.startsWith('--') ? next : 'true';
  }
  return out;
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/**
 * Global fetch, wrapped to the `Fetcher` shape.
 *
 * The only interesting line is the set-cookie handling. Undici — which is Node's
 * fetch — keeps multiple Set-Cookie headers separate and `get()` returns them
 * joined in a way that is not always safe to re-split, so `getSetCookie()` is
 * preferred where it exists. NSE sends more than one cookie on the handshake, so
 * this matters: taking only the first is the difference between a session and a
 * pass that refuses every symbol.
 */
const fetcher: Fetcher = async (url, init) => {
  const response = await fetch(url, init);
  const headers: FetchResponse['headers'] = {
    get: (name: string) => {
      if (name.toLowerCase() === 'set-cookie') {
        const all = (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.();
        if (all && all.length > 0) return all.join(', ');
      }
      return response.headers.get(name);
    },
  };

  return {
    ok: response.ok,
    status: response.status,
    text: () => response.text(),
    json: () => response.json(),
    headers,
  };
};

/** Yesterday, as the fallback trading date. Never today: markets close. */
function lastSession(): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const opts = args(process.argv.slice(2));
  const source = opts.source ?? 'nse';
  const writer = new MemoryWriter();

  const onProgress = (done: number, total: number) => {
    process.stdout.write(`\r  ${done}/${total}`);
  };

  let report;

  if (source === 'nse') {
    const symbols = list(opts.symbols);
    if (symbols.length === 0) {
      console.error('Give it something to fetch: --symbols RELIANCE,TCS,INFY');
      process.exit(1);
    }
    console.log(`\nNSE, ${symbols.length} symbol(s), nothing will be written.\n`);
    report = await ingestNseSymbols(fetcher, symbols, {
      writer,
      asOf: opts.asOf ?? lastSession(),
      onProgress,
    });
  } else if (source === 'edgar') {
    const ciks = list(opts.ciks);
    if (ciks.length === 0) {
      console.error('Give it something to fetch: --ciks 320193,789019');
      process.exit(1);
    }
    console.log(`\nSEC EDGAR, ${ciks.length} CIK(s), nothing will be written.\n`);
    report = await ingestEdgarCiks(fetcher, ciks, { writer, onProgress });
  } else {
    console.error(`Unknown source: ${source}. Use nse or edgar.`);
    process.exit(1);
    return;
  }

  process.stdout.write('\r');
  console.log(`\n${summarise({ ...report, dryRun: true })}\n`);

  if (report.tally.length > 0) {
    console.log('What it could not use — read this first:\n');
    for (const line of skipLines(report)) console.log(line);
    console.log('');
  }

  // A sample of what came back, because "3 companies" does not tell you whether
  // the fields landed in the right places.
  for (const company of writer.companies.slice(0, 5)) {
    console.log(`  ${company.name}`);
    console.log(
      `    ${[
        company.nse_symbol && `symbol ${company.nse_symbol}`,
        company.cik && `cik ${company.cik}`,
        company.isin && `isin ${company.isin}`,
        company.listing_status,
        company.industry,
        company.sector,
      ]
        .filter(Boolean)
        .join(' · ')}`,
    );
  }

  for (const { record } of writer.quotes.slice(0, 5)) {
    console.log(
      `  quote ${record.match.value}  as at ${record.as_of}  price ${record.close_price ?? '—'}  market cap ${
        record.market_cap === null || record.market_cap === undefined
          ? '—'
          : record.market_cap.toLocaleString('en-IN')
      }`,
    );
  }

  for (const { record } of writer.financials.slice(0, 8)) {
    console.log(
      `  ${record.match.value}  ${record.period_end}  revenue ${
        record.revenue === null || record.revenue === undefined ? '—' : record.revenue.toLocaleString('en-IN')
      }  ebitda ${
        record.ebitda === null || record.ebitda === undefined ? '—' : record.ebitda.toLocaleString('en-IN')
      }  ${record.currency}`,
    );
  }

  console.log('');
}

await main();
