import { personCols } from '@/lib/supabase/columns';
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

export type PersonRef = {
  full_name: string | null;
  email: string;
  /** Their profile picture, when the select asked for it. */
  avatar_url?: string | null;
} | null;
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
  /** Who marked it paid. The last link in the chain of custody. */
  payer: PersonRef;
};

/** Audit row with its actor resolved. */
export type AuditRow = Pick<VoucherAudit, 'id' | 'action' | 'note' | 'created_at' | 'to_status'> & {
  actor: PersonRef;
};

/**
 * The select for a full voucher, shared by the detail page and the PDF route so
 * the two can never drift. If the PDF needs a column the page stopped selecting,
 * that column would silently render blank — which is exactly the class of bug
 * that made v1's re-downloaded PDFs lose their event date.
 *
 * A function rather than a constant because the person columns depend on what the
 * database has: see lib/supabase/columns.ts. Both call sites wrap the query in
 * tolerateMissingColumns, which needs to be able to build it a second time.
 */
export function voucherDetailSelect(): string {
  const who = personCols();
  return `*,
  chapter:chapters!vouchers_chapter_id_fkey(name, code),
  paid_by:chapters!vouchers_paid_by_chapter_id_fkey(name),
  initiator:profiles!vouchers_initiated_by_fkey(${who}),
  first_approver:profiles!vouchers_approver_1_fkey(${who}),
  second_approver:profiles!vouchers_approver_2_fkey(${who}),
  rejecter:profiles!vouchers_rejected_by_fkey(${who}),
  payer:profiles!vouchers_paid_marked_by_fkey(${who})`;
}
