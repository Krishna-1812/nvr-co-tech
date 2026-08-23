'use server';

import { revalidatePath } from 'next/cache';
import { requireUser, createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/domain/workflow';
import { ingestEdgarCiks, ingestNseSymbols } from '@/lib/comps/ingest/passes';
import { makeRpcWriter } from '@/lib/comps/ingest/writers';
import { skipLines, summarise, writeHarvest } from '@/lib/comps/ingest/runner';
import { MAX_ITEMS, MCA_BATCH_SIZE } from '@/lib/comps/ingest/sheetRows';
import type { Writer } from '@/lib/comps/ingest/types';
import { EDGAR } from '@/lib/comps/sources';
import { fetchTickerUniverse } from '@/lib/comps/sources/edgar';
import { fetchMcaLivePage, KNOWN_STATES, reachableCount } from '@/lib/comps/sources/mcaLive';
import { mcaMasterBatch } from '@/lib/comps/sources/mcaMaster';
import type { Skip } from '@/lib/comps/sources/types';
import type { Fetcher, FetchResponse } from '@/lib/comps/sources/types';
import type { ActionResult } from './workflow';

/**
 * Ingest, triggered from the operator's own session.
 *
 * This is option 1 of the three in `src/lib/comps/ingest/types.ts`: no service
 * key and no dedicated ingest account, just the signed-in admin's session,
 * which `upsert_company` and friends already accept because they are granted to
 * `authenticated`. The trade-off that comes with that choice is the cap below —
 * a batch has to finish inside one request, so it cannot be the 3.6 million row
 * MCA file. It is exactly enough to seed a peer set and prove the pipeline
 * against real data, which is what this exists for today.
 *
 * Restricted to admins in the application layer, not just the nav: the
 * migration 0028 write functions are granted to every authenticated user (any
 * signed-in member of any tenant), because RLS has no per-function role concept
 * — so this check is the only thing standing between "an admin seeds the shared
 * registry" and "any member of any customer's team can write into it". Worth
 * tightening in the database itself before this goes further than a handful of
 * admins using it.
 */

export type IngestSummary = { headline: string; skipped: string[] };

/**
 * Global fetch, wrapped to the shape the adapters expect.
 *
 * Copied from `scripts/ingest-dry.mts` rather than shared, because that script
 * is a standalone entry point with no framework around it and this is a server
 * action — sharing one module between them would mean the script importing
 * from `src/app`, which is backwards.
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

/**
 * The admin gate and the writer, in one place.
 *
 * Both `runValuationIngest` and `runValuationMcaBatch` need exactly this —
 * check the caller is an admin, then hand back a `Writer` wired to their own
 * session — and had begun to duplicate it. A third source added later gets
 * this for free rather than a third copy to keep in sync.
 */
async function requireAdminWriter(): Promise<{ error: string } | { writer: Writer }> {
  const me = await requireUser();
  if (!isAdmin(me.role)) return { error: 'Only an admin can run an ingest pass.' };

  const supabase = await createClient();

  const writer = makeRpcWriter({
    rpc: async (fn, p) => {
      // `fn` is one of the four functions `makeRpcWriter` ever calls, but
      // `RpcBridge` types it as a plain string so this directory stays
      // importable without the generated `Database` types in scope — the same
      // trade-off `voucherQuery.ts` makes for a dynamically-built query.
      const { data, error } = await supabase.rpc(fn as Parameters<typeof supabase.rpc>[0], { p });
      if (error) throw new Error(`${fn}: ${error.message}`);
      return data;
    },
    findCompany: async (column, value) => {
      // `column` is one of the five identifiers in `CompanyMatch`, a closed set
      // this code chooses — never a value typed by whoever is filling in the
      // form — so a dynamic `.eq()` here is safe despite the cast.
      const { data } = await supabase.from('companies').select('id').eq(column as never, value).maybeSingle();
      return (data as { id: string } | null)?.id ?? null;
    },
  });

  return { writer };
}

export async function runValuationIngest(input: {
  source: 'edgar' | 'nse';
  identifiers: string[];
}): Promise<ActionResult<IngestSummary>> {
  const admin = await requireAdminWriter();
  if ('error' in admin) return { ok: false, error: admin.error };

  const identifiers = [...new Set(input.identifiers.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (identifiers.length === 0) return { ok: false, error: 'Give it at least one identifier.' };
  if (identifiers.length > MAX_ITEMS) {
    return {
      ok: false,
      error: `That is ${identifiers.length} — send at most ${MAX_ITEMS} at a time, so the request finishes inside the page's own timeout. Run the rest as a second batch.`,
    };
  }

  const report =
    input.source === 'edgar'
      ? await ingestEdgarCiks(fetcher, identifiers, { writer: admin.writer })
      : await ingestNseSymbols(fetcher, identifiers, { writer: admin.writer, asOf: lastSession() });

  // The registry just changed; the comparables page reads it fresh next time.
  revalidatePath('/comps');

  return { ok: true, data: { headline: summarise(report), skipped: skipLines(report) } };
}

/**
 * One batch of MCA company-master rows, written on the operator's session.
 *
 * The same session that seeds EDGAR and NSE, and the same reason: no service
 * key exists here by design. What is different is the shape of the source —
 * a bulk file the caller has already downloaded and parsed in their own
 * browser, not a live endpoint this code fetches — so there is no `Fetcher`
 * here and no pacing to speak of: `MCA_MASTER.politeness` already says a bulk
 * file has no per-request budget to respect.
 *
 * The cap — `MCA_BATCH_SIZE`, 100 rows, not the 25 identifiers EDGAR and NSE
 * get — exists because `upsert_company` is one Postgres round trip per
 * company and this runs inside a web request with its own timeout. A
 * genuinely national, 3.6 million row pass through this door would take a
 * very long time, one small request after another; the honest fix for that,
 * if it is ever needed, is a bulk upsert function in the database, not a
 * bigger number here.
 */
export type McaBatchSummary = { companiesWritten: number; skipped: Skip[] };

export async function runValuationMcaBatch(input: {
  rows: Record<string, string>[];
  /** 1-indexed position of the first row in this batch within the whole file, for skip messages. */
  firstRowNumber: number;
}): Promise<ActionResult<McaBatchSummary>> {
  const admin = await requireAdminWriter();
  if ('error' in admin) return { ok: false, error: admin.error };

  if (input.rows.length === 0) return { ok: true, data: { companiesWritten: 0, skipped: [] } };
  if (input.rows.length > MCA_BATCH_SIZE) {
    return { ok: false, error: `That is ${input.rows.length} rows — send at most ${MCA_BATCH_SIZE} at a time.` };
  }

  const harvest = mcaMasterBatch(input.rows, { firstRowNumber: input.firstRowNumber });
  const written = await writeHarvest(harvest, admin.writer, new Map());

  revalidatePath('/comps');

  return { ok: true, data: { companiesWritten: written.companies, skipped: written.skipped } };
}

/**
 * The whole SEC ticker universe, for the client to chunk and feed back through
 * `runValuationIngest`.
 *
 * Returns identifiers only, not a harvest — the actual fetching and writing
 * happens exactly where it already does, one `MAX_ITEMS`-sized call at a time, so
 * a "sync everything" button is the existing manual flow driven automatically
 * rather than a second ingest path to keep in sync with the first.
 */
export type TickerUniverseEntry = { cik: string; name: string; ticker: string };

export async function fetchEdgarUniverse(): Promise<ActionResult<TickerUniverseEntry[]>> {
  const me = await requireUser();
  if (!isAdmin(me.role)) return { ok: false, error: 'Only an admin can run an ingest pass.' };

  try {
    const universe = await fetchTickerUniverse(fetcher, EDGAR.politeness.userAgent ?? 'The Finance Intelligence');
    return { ok: true, data: universe.map(({ cik, name, ticker }) => ({ cik, name, ticker })) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not fetch the SEC ticker universe.',
    };
  }
}

/**
 * One page of one state, fetched live from data.gov.in and written straight
 * through — no file, no upload, the same `MCA_BATCH_SIZE` cap as
 * `runValuationMcaBatch` and the same reason for it.
 *
 * `stateTotal` and `reachable` come back on every call so the caller always knows
 * how much of the state exists versus how much of it this door can ever reach —
 * see `mcaLive.ts` for why those two numbers are not the same for most states.
 */
export type McaLiveBatchSummary = {
  companiesWritten: number;
  skipped: Skip[];
  state: string;
  stateTotal: number;
  reachable: number;
};

export async function runValuationMcaLiveBatch(input: {
  state: string;
  offset: number;
}): Promise<ActionResult<McaLiveBatchSummary>> {
  const admin = await requireAdminWriter();
  if ('error' in admin) return { ok: false, error: admin.error };

  if (!KNOWN_STATES.includes(input.state)) {
    return { ok: false, error: `"${input.state}" is not one of the states this sync knows how to ask for.` };
  }

  let page;
  try {
    page = await fetchMcaLivePage(fetcher, { state: input.state, offset: input.offset, limit: MCA_BATCH_SIZE });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'data.gov.in request failed.' };
  }

  const harvest = mcaMasterBatch(page.rows, { firstRowNumber: input.offset + 1 });
  const written = await writeHarvest(harvest, admin.writer, new Map());

  revalidatePath('/comps');

  return {
    ok: true,
    data: {
      companiesWritten: written.companies,
      skipped: written.skipped,
      state: input.state,
      stateTotal: page.total,
      reachable: reachableCount(page.total),
    },
  };
}
