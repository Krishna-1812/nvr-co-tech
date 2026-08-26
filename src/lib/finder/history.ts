import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, FinderHistoryRow, FinderListRow } from '@/lib/supabase/types';

/**
 * What somebody looked up, and what they kept.
 *
 * Two records, one rule between them: **neither may ever break the thing it is
 * recording.** Every function here runs after a credit has already been spent,
 * immediately before the answer that credit bought is handed back. A failure to
 * write the note must not turn a paid-for contact into a 500, so every write is
 * best-effort and says so in the log rather than to the caller.
 *
 * The retention rule is a privacy control rather than a size one — these rows
 * can hold revealed email addresses and phone numbers — and the sweep runs on
 * READ, for every user, not only the reader. Pruning on write covers only the
 * person writing, which makes ninety days conditional on continued use:
 * somebody who stops using the tool keeps their revealed contacts forever,
 * because nothing they do triggers their own cleanup.
 */

type Client = SupabaseClient<Database>;
type RpcName = Parameters<Client['rpc']>[0];

/** The kinds of thing that end up in the drawer. */
export type HistoryEntity =
  | 'people'
  | 'companies'
  | 'chat'
  | 'contact'
  | 'company_profile'
  | 'revealed';

export type HistoryEntry = {
  entity: HistoryEntity;
  label: string;
  filters?: Record<string, unknown>;
  total?: number | null;
  rows?: readonly unknown[];
  answer?: string | null;
  credits?: number;
  /**
   * Grow the entry this id names rather than writing a near-identical second
   * one. This is what "Load more" uses: without it, paging three deep wrote
   * three entries holding 24, 48 and 72 rows and evicted real history against
   * the 60-entry cap.
   */
  replaceId?: number | null;
  /**
   * A stable key for "the same thing looked up again".
   *
   * Enriching one person twice should refresh one entry rather than filling the
   * drawer with identical ones. Resolved to a `replaceId` by a read here rather
   * than inside the function, because the row is already visible to its owner
   * and only to its owner — a guessed key belonging to somebody else matches
   * nothing, so the lookup cannot leak an entry it then overwrites.
   */
  dedupe?: string;
};

/**
 * Save one entry. Returns its id, or null if nothing was written.
 *
 * The id matters to exactly one caller — the one that pages — and it is the
 * reason this does not use the shared quiet-RPC helper: that one discards the
 * return value, which is fine for a cache and not fine for something you have
 * to be able to grow.
 */
export async function saveHistory(
  supabase: Client,
  entry: HistoryEntry,
): Promise<number | null> {
  try {
    let replaceId = entry.replaceId ?? null;
    const filters: Record<string, unknown> = { ...(entry.filters ?? {}) };

    if (entry.dedupe) {
      filters.dedupe = entry.dedupe;
      if (!replaceId) {
        const { data } = await supabase
          .from('finder_search_history')
          .select('id')
          .eq('entity', entry.entity)
          .eq('filters->>dedupe', entry.dedupe)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        replaceId = data?.id ?? null;
      }
    }

    const { data, error } = await supabase.rpc('finder_save_history' as RpcName, {
      p: {
        entity: entry.entity,
        label: entry.label.slice(0, 160),
        filters,
        total: entry.total ?? null,
        rows: entry.rows ?? [],
        answer: entry.answer ?? null,
        credits: entry.credits ?? 0,
        replace_id: replaceId,
      },
    } as never);

    if (error) {
      console.warn(`finder: history save failed: ${error.message}`);
      return null;
    }
    return typeof data === 'number' ? data : null;
  } catch (error) {
    console.warn(
      `finder: history save threw: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return null;
  }
}

/**
 * Retire everything past its date, for everybody.
 *
 * Called on every read of either drawer. Cheap, because both tables are capped
 * per person, and correct in a way that pruning on write is not.
 */
export async function expire(supabase: Client): Promise<void> {
  const { error } = await supabase.rpc('finder_expire' as RpcName, undefined as never);
  if (error) console.warn(`finder: expiry sweep failed: ${error.message}`);
}

export type HistoryItem = {
  id: number;
  entity: string;
  label: string | null;
  total: number | null;
  credits: number;
  answer: string | null;
  created_at: string;
  /** How many result rows the entry holds. The rows themselves come on open. */
  rows: number;
};

/** The drawer's list: enough to choose from, never the rows themselves. */
export async function readHistory(supabase: Client, limit = 60): Promise<HistoryItem[]> {
  await expire(supabase);

  const { data, error } = await supabase
    .from('finder_search_history')
    .select('id, entity, label, total, credits, answer, created_at, rows')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(`finder: history read failed: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    entity: row.entity,
    label: row.label,
    total: row.total,
    credits: row.credits,
    // Trimmed hard: the drawer prints a couple of lines, and a chat entry can
    // carry eight thousand characters of prose it has no room for.
    answer: row.answer ? row.answer.slice(0, 400) : null,
    created_at: row.created_at,
    rows: Array.isArray(row.rows) ? row.rows.length : 0,
  }));
}

/**
 * One entry in full, rows and all.
 *
 * No ownership check in the application, because there is none to make: the
 * policy on this table is `user_id = auth.uid()`, so an id belonging to somebody
 * else matches no row rather than matching one that then has to be refused.
 */
export async function readHistoryEntry(
  supabase: Client,
  id: number,
): Promise<FinderHistoryRow | null> {
  const { data, error } = await supabase
    .from('finder_search_history')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.warn(`finder: history entry read failed: ${error.message}`);
    return null;
  }
  return data ?? null;
}

export async function deleteHistoryEntry(supabase: Client, id: number): Promise<boolean> {
  const { error } = await supabase.from('finder_search_history').delete().eq('id', id);
  if (error) {
    console.warn(`finder: history delete failed: ${error.message}`);
    return false;
  }
  return true;
}

// ─── The working list ────────────────────────────────────────────────────────

/**
 * What identifies a row on the list.
 *
 * An Apollo id when there is one. Failing that, the pair that actually
 * identifies the row to a person: a name and an employer for a person, a domain
 * or a name for a company. Deliberately not the array index, which changes the
 * moment anything is added.
 */
export function listKey(row: Record<string, unknown>, entity: string): string {
  const id = String(row.id ?? '').trim();
  if (id) return id;

  const text = (v: unknown) => String(v ?? '').trim().toLowerCase();
  if (entity === 'companies') {
    return text(row.primary_domain) || text(row.name) || '';
  }
  return [text(row.full_name), text(row.organization_domain) || text(row.organization_name)]
    .filter(Boolean)
    .join('|');
}

export type ListResult = { added: number; count: number; full: boolean };

/** Put rows on the list. Returns what actually landed and how full it now is. */
export async function listAdd(
  supabase: Client,
  entity: string,
  rows: readonly Record<string, unknown>[],
): Promise<ListResult> {
  const payload = rows
    .map((row) => ({ dedupe_key: listKey(row, entity), row }))
    .filter((r) => r.dedupe_key);

  if (payload.length === 0) return { added: 0, count: await listCount(supabase), full: false };

  const { data, error } = await supabase.rpc('finder_list_add' as RpcName, {
    p: { entity, rows: payload },
  } as never);

  if (error) {
    console.warn(`finder: list add failed: ${error.message}`);
    return { added: 0, count: await listCount(supabase), full: false };
  }

  const out = (data ?? {}) as Partial<ListResult>;
  return {
    added: Number(out.added ?? 0),
    count: Number(out.count ?? 0),
    full: Boolean(out.full),
  };
}

async function listCount(supabase: Client): Promise<number> {
  const { count } = await supabase
    .from('finder_list_rows')
    .select('dedupe_key', { count: 'exact', head: true });
  return count ?? 0;
}

export async function readList(supabase: Client): Promise<FinderListRow[]> {
  await expire(supabase);

  const { data, error } = await supabase
    .from('finder_list_rows')
    .select('*')
    .order('added_at', { ascending: false })
    .limit(500);

  if (error) {
    console.warn(`finder: list read failed: ${error.message}`);
    return [];
  }
  return data ?? [];
}

/** Remove one row, or — with no key — everything on the list. */
export async function listRemove(
  supabase: Client,
  entity: string,
  dedupeKey?: string,
): Promise<boolean> {
  let query = supabase.from('finder_list_rows').delete().eq('entity', entity);
  if (dedupeKey) query = query.eq('dedupe_key', dedupeKey);

  const { error } = await query;
  if (error) {
    console.warn(`finder: list remove failed: ${error.message}`);
    return false;
  }
  return true;
}
