import type { SupabaseClient } from '@supabase/supabase-js';
import { VOUCHER_STATUSES, isAdmin, type UserRole } from '@/lib/domain/workflow';

/**
 * The voucher list filters, in one place.
 *
 * The list page and the Excel export must select the same rows — an export that
 * quietly differs from the table you were looking at is worse than no export.
 * Both call this.
 */

export type VoucherFilters = {
  status?: string;
  q?: string;
  chapter?: string;
};

/** Parse raw search params, ignoring anything unrecognised. */
export function parseFilters(sp: Record<string, string | undefined>): VoucherFilters {
  return {
    status: VOUCHER_STATUSES.find((s) => s === sp.status),
    chapter: sp.chapter?.trim() || undefined,
    q: sp.q?.trim() || undefined,
  };
}

/** True when any filter is active — used to label the export. */
export function hasFilters(f: VoucherFilters): boolean {
  return Boolean(f.status || f.chapter || f.q);
}

/**
 * Apply visibility and filters to a vouchers query.
 *
 * `select` is passed in because the list and the export need different shapes.
 */
export function applyVoucherFilters<T>(
  query: T,
  filters: VoucherFilters,
  viewer: { id: string; role: UserRole },
): T {
  // The Supabase builder types are deeply generic and re-deriving them here adds
  // nothing; the generic preserves the caller's type across the call.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;

  // Members only ever see their own; admins and owners see everything.
  if (!isAdmin(viewer.role)) q = q.eq('created_by', viewer.id);

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.chapter) q = q.eq('chapter_id', filters.chapter);

  if (filters.q) {
    // Escape PostgREST's `or` separators so a comma or paren in the search box
    // cannot alter the filter expression.
    const term = `%${filters.q.replace(/[,()]/g, ' ')}%`;
    q = q.or(
      `voucher_no.ilike.${term},paid_to.ilike.${term},invoice_no.ilike.${term},event_name.ilike.${term}`,
    );
  }

  return q as T;
}

/** Convenience for callers holding a real client. */
export function voucherQuery(
  supabase: SupabaseClient,
  select: string,
  filters: VoucherFilters,
  viewer: { id: string; role: UserRole },
  opts?: { count?: 'exact' },
) {
  const base = supabase.from('vouchers').select(select, opts).is('deleted_at', null);
  return applyVoucherFilters(base, filters, viewer);
}
