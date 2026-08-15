/**
 * Database types.
 *
 * Hand-written to match supabase/migrations/. Once the migrations are applied
 * you can regenerate these from the live schema instead:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 */

import type { VoucherStatus, UserRole } from '@/lib/domain/workflow';
import type { Sponsorship, SupportingType, PaymentType } from '@/lib/domain/voucher';
import type { ReconResult, ReconStatus } from '@/lib/recon/types';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  /** From the identity provider. Written only by handle_new_user and sync_own_avatar. */
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ChapterRow = {
  id: string;
  name: string;
  code: string;
  is_head_office: boolean;
  is_active: boolean;
  created_at: string;
  deleted_at: string | null;
};

export type EventRow = {
  id: string;
  name: string;
  chapter_id: string | null;
  date_of_event: string | null;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type Voucher = {
  id: string;
  voucher_no: string | null;
  status: VoucherStatus;

  date: string | null;
  chapter_id: string | null;
  sponsored: Sponsorship | null;

  event_id: string | null;
  event_name: string | null;
  event_date: string | null;
  event_narration: string | null;

  type_of_supporting: SupportingType | null;
  type_of_payment: PaymentType | null;
  invoice_no: string | null;
  invoice_date: string | null;
  invoice_received_date: string | null;

  basic_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  vat: number;
  tds: number;
  advance: number;
  tips: number;
  discount: number;

  /** Generated columns — computed by Postgres, never written by the client. */
  total_tax: number;
  net_total: number;
  grand_total: number;

  paid_to: string | null;
  paid_by_chapter_id: string | null;
  payment_date: string | null;
  beneficiary_name: string | null;
  utr_ref: string | null;
  pan_number: string | null;
  gst_number: string | null;

  initiated_by: string | null;
  initiated_at: string | null;
  submitted_at: string | null;
  approver_1: string | null;
  approved_1_at: string | null;
  approver_2: string | null;
  approved_2_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  paid_marked_by: string | null;
  paid_at: string | null;

  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Columns the client may write. Generated totals and workflow state are excluded. */
export type VoucherWritable = Omit<
  Voucher,
  | 'id' | 'voucher_no' | 'status'
  | 'total_tax' | 'net_total' | 'grand_total'
  | 'initiated_by' | 'initiated_at' | 'submitted_at'
  | 'approver_1' | 'approved_1_at' | 'approver_2' | 'approved_2_at'
  | 'rejected_by' | 'rejected_at' | 'rejection_reason'
  | 'paid_marked_by' | 'paid_at'
  | 'created_by' | 'created_at' | 'updated_at' | 'deleted_at'
>;

export type AuditAction =
  | 'created' | 'updated' | 'submitted' | 'approved_first' | 'approved_second'
  | 'rejected' | 'reopened' | 'marked_paid' | 'deleted' | 'restored' | 'purged';

export type VoucherAudit = {
  id: number;
  voucher_id: string;
  actor_id: string | null;
  action: AuditAction;
  from_status: VoucherStatus | null;
  to_status: VoucherStatus | null;
  note: string | null;
  changed: Record<string, unknown> | null;
  created_at: string;
};

export type VoucherAttachment = {
  id: string;
  voucher_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type UserSettings = {
  user_id: string;
  google_sheet_id: string | null;
  sheet_title: string | null;
  updated_at: string;
};

/**
 * One saved reconciliation (0008).
 *
 * `result` is the engine's own ReconResult, stored whole. The columns beside it
 * are duplicated out of it on purpose: the history list renders from those alone,
 * so opening the page does not mean deserialising every stored statement.
 *
 * There is no Update shape for this table, because there is no update policy.
 */
export type ReconciliationRow = {
  id: string;
  created_by: string;

  ledger_a_name: string;
  ledger_b_name: string;
  reconciliation_date: string;
  starting_ledger: 'A' | 'B';
  tolerance_days: number | null;

  status: ReconStatus;
  variance: number;
  starting_balance: number;
  closing_balance: number;
  matched_count: number;
  timing_count: number;
  one_sided_count: number;
  amount_diff_count: number;

  result: ReconResult;
  created_at: string;
};

/**
 * One saved conversation with the assistant (0009).
 *
 * `turn_count` and `updated_at` are maintained by a trigger and are not
 * writable, which is why there is no Insert shape that includes them and no
 * Update shape at all: neither table has an update policy.
 */
export type AssistConversationRow = {
  id: string;
  created_by: string;
  title: string;
  /** Roster slug of the tool it was begun inside, or null on /ask. */
  agent: string | null;
  turn_count: number;
  created_at: string;
  updated_at: string;
};

/**
 * One turn of one conversation (0009).
 *
 * `sources` and `tools` are the interface's own Source[] and ToolTrace[] stored
 * whole. They are typed as unknown here rather than as those arrays, because
 * that is what jsonb gives back: see turnsFromRows in lib/assist/history, which
 * is the one place they are validated.
 */
export type AssistTurnRow = {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: unknown;
  tools: unknown;
  note: 'offline' | null;
  created_at: string;
};

/**
 * Shape for the Supabase client generic.
 *
 * supabase-js expects each table to carry Row / Insert / Update / Relationships
 * and each schema to carry Tables / Views / Functions / Enums / CompositeTypes.
 * Omitting any of them collapses queries to `never`, which is the confusing
 * "Property 'x' does not exist on type 'never'" error.
 */
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      chapters: Table<ChapterRow>;
      events: Table<EventRow>;
      vouchers: Table<Voucher>;
      voucher_audit: Table<VoucherAudit>;
      voucher_attachments: Table<VoucherAttachment>;
      user_settings: Table<UserSettings>;
      reconciliations: Table<ReconciliationRow>;
      assist_conversations: Table<AssistConversationRow>;
      assist_turns: Table<AssistTurnRow>;
    };
    Views: Record<never, never>;
    Functions: {
      submit_voucher: { Args: { p_id: string }; Returns: Voucher };
      approve_voucher: { Args: { p_id: string; p_note?: string }; Returns: Voucher };
      reject_voucher: { Args: { p_id: string; p_reason: string }; Returns: Voucher };
      reopen_voucher: { Args: { p_id: string; p_reason?: string }; Returns: Voucher };
      mark_voucher_paid: {
        Args: { p_id: string; p_utr: string; p_payment_date?: string };
        Returns: Voucher;
      };
      set_user_role: { Args: { p_user: string; p_role: UserRole }; Returns: Profile };

      // 0005 — deletion is a transition like any other, so it goes through
      // functions rather than a direct UPDATE (the edit policy cannot see a
      // soft-deleted row, which is why restore never worked as a plain update).
      soft_delete_voucher: { Args: { p_id: string; p_reason?: string | null }; Returns: Voucher };
      restore_voucher: { Args: { p_id: string }; Returns: Voucher };
      purge_voucher: { Args: { p_id: string }; Returns: void };

      set_chapter_active: { Args: { p_id: string; p_active: boolean }; Returns: ChapterRow };
      rename_chapter: { Args: { p_id: string; p_name: string }; Returns: ChapterRow };

      // 0006 — copies the identity provider's picture onto your own profile row.
      // No arguments on purpose: it reads auth.users itself, so a caller cannot
      // choose the URL that other people's browsers will end up fetching.
      sync_own_avatar: { Args: Record<string, never>; Returns: string | null };
    };
    Enums: {
      user_role: UserRole;
      voucher_status: VoucherStatus;
      supporting_type: SupportingType;
      payment_type: PaymentType;
      sponsorship: Sponsorship;
      audit_action: AuditAction;
    };
    CompositeTypes: Record<never, never>;
  };
};
