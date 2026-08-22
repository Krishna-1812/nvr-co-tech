/**
 * Two writers, one interface.
 *
 * Neither of them imports Supabase, and that is on purpose. `makeRpcWriter` takes
 * two small functions instead of a client, so this whole directory can be
 * imported by a test that has no environment variables and no network — and the
 * call site, which does have both, wires the real calls in a few lines. It also
 * means the runner never has to know which of the three session arrangements in
 * `types.ts` is in use.
 */

import type { CompanyMatch, CompanyRecord, FinancialsRecord, QuoteRecord } from '../sources/types';
import type { LookupEntry, Writer } from './types';

/**
 * A writer that keeps everything and writes nothing.
 *
 * Two jobs, and the second is the more valuable. It is what the tests in this
 * directory assert against — and it is what a **dry run** uses, so a source can
 * be pointed at a live endpoint and its output read before a single row reaches
 * the registry. On a first pass against NSE that is the difference between
 * confirming a field map and discovering it was wrong after writing three
 * thousand companies with null market capitalisations.
 */
export class MemoryWriter implements Writer {
  readonly companies: CompanyRecord[] = [];
  readonly financials: { record: FinancialsRecord; companyId: string }[] = [];
  readonly quotes: { record: QuoteRecord; companyId: string }[] = [];
  readonly lookups: LookupEntry[] = [];

  /**
   * Ids are derived from the identifier rather than counted up, so a company
   * upserted twice in one run gets the same id both times — which is what the
   * real `upsert_company` does, and a counter would have hidden a
   * double-insert bug rather than reproducing it.
   */
  private idFor(record: CompanyRecord): string {
    const key =
      record.cin ?? record.nse_symbol ?? record.bse_code ?? record.isin ?? record.cik ?? record.name;
    return `mem-${key.toUpperCase()}`;
  }

  /** What the registry would already hold, for testing the resolve path. */
  constructor(private readonly existing: Map<string, string> = new Map()) {}

  async upsertCompany(record: CompanyRecord): Promise<string> {
    this.companies.push(record);
    return this.idFor(record);
  }

  async recordFinancials(record: FinancialsRecord, companyId: string): Promise<void> {
    this.financials.push({ record, companyId });
  }

  async recordQuote(record: QuoteRecord, companyId: string): Promise<void> {
    this.quotes.push({ record, companyId });
  }

  async resolve(match: CompanyMatch): Promise<string | null> {
    return this.existing.get(`${match.by}:${match.value.toUpperCase()}`) ?? null;
  }

  async recordLookup(entry: LookupEntry): Promise<void> {
    this.lookups.push(entry);
  }
}

/**
 * A copy of an object without one key.
 *
 * Rather than destructuring the key into a variable nobody reads, which is the
 * idiomatic way to do this and also the way that leaves an unused binding for the
 * linter to object to — correctly, since a reader has to work out that the
 * variable exists only to be discarded.
 */
function without<T extends object, K extends keyof T>(record: T, key: K): Omit<T, K> {
  const copy = { ...record };
  delete copy[key];
  return copy;
}

/** The two calls a real writer needs, and nothing else. */
export type RpcBridge = {
  /** Call a Postgres function with a single jsonb argument named `p`. */
  rpc: (fn: string, payload: Record<string, unknown>) => Promise<unknown>;
  /** Select one company id by an identifier column. Null when absent. */
  findCompany: (column: string, value: string) => Promise<string | null>;
};

/**
 * A writer backed by the functions in migration 0028.
 *
 * Wiring it, from a context that has a signed-in Supabase client:
 *
 *     const writer = makeRpcWriter({
 *       rpc: async (fn, p) => {
 *         const { data, error } = await supabase.rpc(fn, { p });
 *         if (error) throw new Error(`${fn}: ${error.message}`);
 *         return data;
 *       },
 *       findCompany: async (column, value) => {
 *         const { data } = await supabase.from('companies').select('id').eq(column, value).maybeSingle();
 *         return data?.id ?? null;
 *       },
 *     });
 *
 * Errors are thrown rather than swallowed, so the runner counts the item as a
 * failure and carries on. A write that quietly did nothing would leave a report
 * claiming rows that are not there, which is worse than a run that stops.
 */
export function makeRpcWriter(bridge: RpcBridge): Writer {
  return {
    async upsertCompany(record) {
      const id = await bridge.rpc('upsert_company', record as unknown as Record<string, unknown>);
      if (typeof id !== 'string' || id === '') {
        throw new Error(`upsert_company returned no id for ${record.name}`);
      }
      return id;
    },

    async recordFinancials(record, companyId) {
      // `match` is how the adapter named the company and is not a column on
      // company_financials. Dropped here rather than in the adapter, so the
      // adapter's output stays readable in a dry run.
      await bridge.rpc('record_financials', { ...without(record, 'match'), company_id: companyId });
    },

    async recordQuote(record, companyId) {
      await bridge.rpc('record_quote', { ...without(record, 'match'), company_id: companyId });
    },

    async resolve(match) {
      return bridge.findCompany(match.by, match.value);
    },

    async recordLookup(entry) {
      await bridge.rpc('record_data_lookup', {
        provider: entry.provider,
        kind: entry.kind,
        subject: entry.subject,
        company_id: entry.companyId ?? null,
        cost_paise: entry.costPaise,
        cache_hit: entry.cacheHit,
        outcome: entry.outcome,
        note: entry.note ?? null,
      });
    },
  };
}
