import type { Voucher, VoucherAudit } from '@/lib/supabase/types';

/**
 * Row shapes for queries that use embedded joins.
 *
 * The hand-written Database types carry empty `Relationships`, so supabase-js
 * cannot infer these. Declaring them here keeps the assertion in one place
 * instead of scattering `any` through the pages.
 *
 * Regenerating types from the live schema makes this file unnecessary:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 */

export type PersonRef = { full_name: string | null; email: string } | null;
export type ChapterRef = { name: string; code?: string } | null;

/** Voucher row as selected by the list page. */
export type VoucherListRow = Voucher & {
  chapter: ChapterRef;
};

/** Voucher row as selected by the detail page, with every person resolved. */
export type VoucherDetailRow = Voucher & {
  chapter: ChapterRef;
  paid_by: ChapterRef;
  initiator: PersonRef;
  first_approver: PersonRef;
  second_approver: PersonRef;
  rejecter: PersonRef;
};

/** Audit row with its actor resolved. */
export type AuditRow = Pick<VoucherAudit, 'id' | 'action' | 'note' | 'created_at'> & {
  actor: PersonRef;
};

/**
 * The select for a full voucher, shared by the detail page and the PDF route so
 * the two can never drift. If the PDF needs a column the page stopped selecting,
 * that column would silently render blank — which is exactly the class of bug
 * that made v1's re-downloaded PDFs lose their event date.
 */
export const VOUCHER_DETAIL_SELECT = `*,
  chapter:chapters!vouchers_chapter_id_fkey(name, code),
  paid_by:chapters!vouchers_paid_by_chapter_id_fkey(name),
  initiator:profiles!vouchers_initiated_by_fkey(full_name, email),
  first_approver:profiles!vouchers_approver_1_fkey(full_name, email),
  second_approver:profiles!vouchers_approver_2_fkey(full_name, email),
  rejecter:profiles!vouchers_rejected_by_fkey(full_name, email)` as const;
