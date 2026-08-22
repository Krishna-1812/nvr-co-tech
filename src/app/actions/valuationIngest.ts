'use server';

import { revalidatePath } from 'next/cache';
import { requireUser, createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/domain/workflow';
import { ingestEdgarCiks, ingestNseSymbols } from '@/lib/comps/ingest/passes';
import { makeRpcWriter } from '@/lib/comps/ingest/writers';
import { skipLines, summarise } from '@/lib/comps/ingest/runner';
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

const MAX_ITEMS = 25;

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

export async function runValuationIngest(input: {
  source: 'edgar' | 'nse';
  identifiers: string[];
}): Promise<ActionResult<IngestSummary>> {
  const me = await requireUser();
  if (!isAdmin(me.role)) return { ok: false, error: 'Only an admin can run an ingest pass.' };

  const identifiers = [...new Set(input.identifiers.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (identifiers.length === 0) return { ok: false, error: 'Give it at least one identifier.' };
  if (identifiers.length > MAX_ITEMS) {
    return {
      ok: false,
      error: `That is ${identifiers.length} — send at most ${MAX_ITEMS} at a time, so the request finishes inside the page's own timeout. Run the rest as a second batch.`,
    };
  }

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

  const report =
    input.source === 'edgar'
      ? await ingestEdgarCiks(fetcher, identifiers, { writer })
      : await ingestNseSymbols(fetcher, identifiers, { writer, asOf: lastSession() });

  // The registry just changed; the comparables page reads it fresh next time.
  revalidatePath('/comps');

  return { ok: true, data: { headline: summarise(report), skipped: skipLines(report) } };
}
