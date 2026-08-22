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
  /** Null means signed up but not yet joined or created an organization (0012). */
  organization_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ChapterRow = {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  is_head_office: boolean;
  is_active: boolean;
  created_at: string;
  deleted_at: string | null;
};

export type EventRow = {
  id: string;
  organization_id: string;
  name: string;
  chapter_id: string | null;
  date_of_event: string | null;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
};

/**
 * One client on this platform (0012). `voucher_prefix` is what
 * next_voucher_no() issues numbers under, editable per organization.
 * `requires_approval` (0013) — false means submit_voucher() pays a voucher
 * immediately instead of routing it through pending_first/pending_second.
 */
export type OrganizationRow = {
  id: string;
  name: string;
  voucher_prefix: string;
  requires_approval: boolean;
  created_at: string;
};

/** A copy-a-link invite (0012). Consumed only through accept_invite(). */
export type OrganizationInviteRow = {
  id: string;
  organization_id: string;
  email: string;
  role: UserRole;
  token: string;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

export type Voucher = {
  id: string;
  /** Stamped by a trigger from the caller's own organization (0012), never client-set. */
  organization_id: string;
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
  | 'id' | 'organization_id' | 'voucher_no' | 'status'
  | 'total_tax' | 'net_total' | 'grand_total'
  | 'initiated_by' | 'initiated_at' | 'submitted_at'
  | 'approver_1' | 'approved_1_at' | 'approver_2' | 'approved_2_at'
  | 'rejected_by' | 'rejected_at' | 'rejection_reason'
  | 'paid_marked_by' | 'paid_at'
  | 'created_by' | 'created_at' | 'updated_at' | 'deleted_at'
>;

export type AuditAction =
  | 'created' | 'updated' | 'submitted' | 'approved_first' | 'approved_second'
  | 'rejected' | 'reopened' | 'marked_paid' | 'deleted' | 'restored' | 'purged'
  // 0021 — the raiser pulling a voucher back before anyone acted on it. Its
  // own action rather than 'reopened', which is an admin undoing an approval.
  | 'withdrawn';

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
 * The analytics store (0010).
 *
 * Deliberately thin here. The event tables have no insert policy at all — every
 * write goes through a SECURITY DEFINER function taking one jsonb payload — so
 * there is no meaningful Insert shape for them, and the row shapes the screens
 * actually reason about live in lib/analytics/types.ts beside the code that
 * reads them. What this file needs is only enough for the query builder to type
 * a select and for the two caches, which the dashboard does write to directly.
 */
export type AnalyticsAdminRow = { email: string; note: string | null; added_at: string };

export type IpResolutionRow = {
  ip: string;
  /** Stamped by the resolver, so improved logic re-resolves instead of serving stale. */
  version: number;
  resolution: unknown;
  resolved_at: string;
  expires_at: string;
};

export type CompanyEnrichmentRow = {
  domain: string;
  tier: 'free' | 'paid';
  version: number;
  /** Null is a real cached answer: we looked, and there was nothing. */
  data: unknown;
  fetched_at: string;
  expires_at: string;
};

export type EnrichmentSpendRow = {
  id: number;
  spent_at: string;
  actor_email: string;
  kind: 'company' | 'person';
  subject: string;
  outcome: 'hit' | 'miss' | 'error';
};

/** Row shapes for the append-only analytics tables, as the dashboard reads them. */
type AnalyticsRow = Record<string, unknown>;

/**
 * 0022 — an activation milestone, written from the function that caused it.
 *
 * Named rather than left as an AnalyticsRow because the funnel screen selects
 * specific columns off it and would otherwise have to assert every one.
 */
export type ProductEventRow = {
  id: number;
  name: string;
  actor_id: string | null;
  organization_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

/*
 * 0026 — what the operator functions hand back.
 *
 * These are not table rows. Each one is the return shape of a SECURITY DEFINER
 * function that exists precisely so the operator does not read the underlying
 * table, and the narrowness is the feature: if a screen wants a figure that is
 * not in one of these shapes, the honest move is to go and widen a function
 * body where somebody will see it, not to reach past them into `vouchers`.
 */
export type OperatorTenantRow = {
  organization_id: string;
  name: string;
  created_at: string;
  members: number;
  first_event: string | null;
  last_event: string | null;
  chapters_created: number;
  invites_sent: number;
  invites_accepted: number;
  vouchers_drafted: number;
  vouchers_submitted: number;
  vouchers_approved: number;
  vouchers_rejected: number;
  vouchers_paid: number;
  reconciliations_saved: number;
};

export type OperatorMemberRow = {
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  organization_id: string | null;
  organization_name: string | null;
  joined_at: string;
};

export type OperatorOnboardingRow = {
  email: string;
  full_name: string | null;
  signed_up_at: string;
};

export type OperatorWorkflowStageRow = {
  stage: string;
  samples: number;
  /** Null when every span in the stage was unmeasurable. */
  median_hours: number | null;
  p90_hours: number | null;
};

export type OperatorStuckRow = {
  organization_id: string;
  organization_name: string;
  status: VoucherStatus;
  waiting: number;
  oldest_days: number;
};

/** 0023 — one open of a metered tool. */
export type AgentRunRow = {
  id: number;
  actor_id: string | null;
  email: string;
  feature_slug: string;
  organization_id: string | null;
  created_at: string;
};

/** 0023 — the public request-access form. */
export type AccessRequestRow = {
  id: number;
  created_at: string;
  name: string;
  email: string;
  company: string | null;
  interest: string | null;
  message: string | null;
  ip: string | null;
  source: string | null;
  visitor_id: string | null;
};

/**
 * 0024 — a model-written read of a person, keyed by a hash of the facts that
 * produced it rather than by time, so it is regenerated when it stops being
 * true instead of when it gets old.
 */
export type AiSummaryRow = {
  fact_hash: string;
  subject: string;
  headline: string;
  summary: string;
  intent: 'high' | 'medium' | 'low';
  model: string | null;
  created_at: string;
};

/** 0023 — a signed-in person asking for a tool that is not live yet. */
export type FeatureRequestRow = {
  id: number;
  created_at: string;
  actor_id: string | null;
  email: string;
  name: string | null;
  feature_slug: string;
  reason: string | null;
};

/** 0011 — a caught failure, as the errors admin screen reads it. */
type ErrorLogRow = {
  id: number;
  occurred_at: string;
  scope: 'client' | 'server';
  route: string | null;
  message: string;
  digest: string | null;
  stack: string | null;
  user_email: string | null;
  extra: Record<string, unknown> | null;
};

/**
 * Shape for the Supabase client generic.
 *
 * supabase-js expects each table to carry Row / Insert / Update / Relationships
 * and each schema to carry Tables / Views / Functions / Enums / CompositeTypes.
 * Omitting any of them collapses queries to `never`, which is the confusing
 * "Property 'x' does not exist on type 'never'" error.
 */
// --- Valuation Desk (0028) --------------------------------------------------

/**
 * A company somebody is valuing.
 *
 * Three things in this schema say "company" and they are different: an
 * `organizations` row is a tenant, a `company_enrichment` row is a visitor's
 * employer guessed from an IP, and this is a subject of research drawn from
 * public record. Shared across every tenant, readable by all, writable by none —
 * see the header of migration 0028 for why that is safe and, more importantly,
 * for what must never be stored in it.
 *
 * `embedding` is deliberately typed `unknown`. It is a pgvector value, the app
 * never reads it — nearest-neighbour search happens inside `find_peers`, where
 * the index is — and giving it a number[] shape would invite somebody to pull
 * 1,536 floats per row across the wire to do in JavaScript what Postgres has
 * already done.
 */
export type CompanyRegistryRow = {
  id: string;
  cin: string | null;
  isin: string | null;
  nse_symbol: string | null;
  bse_code: string | null;
  cik: string | null;
  lei: string | null;
  name: string;
  legal_name: string | null;
  country: string;
  listing_status: 'listed' | 'unlisted' | 'delisted' | 'unknown';
  incorporated_on: string | null;
  registered_state: string | null;
  nic_code: string | null;
  sic_code: string | null;
  industry: string | null;
  sector: string | null;
  business_description: string | null;
  embedding: unknown;
  embedding_model: string | null;
  source: string;
  source_url: string | null;
  first_seen: string;
  last_refreshed: string;
};

/**
 * One reporting period, one basis, one source.
 *
 * Every figure nullable, and that is the schema saying something rather than
 * being lax: null is "not known" and zero is a claim that the company earned
 * nothing. The same year genuinely arrives twice from two sources — an exchange
 * result and an MCA filing will not agree to the rupee — which is why `source`
 * is part of the uniqueness rule rather than one row overwriting the other.
 */
export type CompanyFinancialsRow = {
  id: number;
  company_id: string;
  period_start: string | null;
  period_end: string;
  fy_label: string | null;
  months: number | null;
  basis: 'standalone' | 'consolidated';
  revenue: number | null;
  other_income: number | null;
  ebitda: number | null;
  ebit: number | null;
  pat: number | null;
  total_assets: number | null;
  net_worth: number | null;
  total_debt: number | null;
  cash: number | null;
  employees: number | null;
  currency: string;
  is_audited: boolean | null;
  source: string;
  source_url: string | null;
  source_document_id: number | null;
  as_of: string | null;
  fetched_at: string;
};

/** A market capitalisation on a date. Moves on a different clock from a filing. */
export type CompanyQuoteRow = {
  id: number;
  company_id: string;
  as_of: string;
  close_price: number | null;
  shares_outstanding: number | null;
  market_cap: number | null;
  currency: string;
  source: string;
  source_url: string | null;
  fetched_at: string;
};

/**
 * An announced private round.
 *
 * `post_money_to_revenue` is a generated column, so it is read-only from here and
 * cannot drift from the two figures it is made of. `disclosure` admits only
 * 'disclosed' and 'reported': there is deliberately no estimated value, because
 * once a modelled valuation is in the table nobody downstream can tell it from a
 * number a founder actually announced.
 */
export type FundingRoundRow = {
  id: number;
  company_id: string;
  round_label: string;
  announced_on: string;
  amount_raised: number | null;
  pre_money: number | null;
  post_money: number | null;
  currency: string;
  lead_investor: string | null;
  investors: string[] | null;
  revenue: number | null;
  revenue_period: string | null;
  revenue_basis: 'standalone' | 'consolidated' | null;
  revenue_source: string | null;
  /** Generated. Null unless both the valuation and the revenue are known. */
  post_money_to_revenue: number | null;
  disclosure: 'disclosed' | 'reported';
  source: string;
  source_url: string | null;
  fetched_at: string;
};

/** That a filing was read, and where a reader can fetch it. Never a copy of it. */
export type SourceDocumentRow = {
  id: number;
  company_id: string;
  doc_type: string;
  filed_on: string | null;
  period_end: string | null;
  provider: string;
  external_id: string | null;
  url: string | null;
  retrieved_at: string;
};

/** A recorded judgement about what is comparable to a subject, on a date. */
export type PeerSetRow = {
  id: string;
  organization_id: string;
  created_by: string;
  subject_company_id: string | null;
  subject_name: string;
  subject_description: string | null;
  as_of: string;
  basis: 'standalone' | 'consolidated';
  screen: Record<string, unknown>;
  method_note: string | null;
  created_at: string;
};

/**
 * One comparable, frozen as at the peer set's date.
 *
 * The four multiples are generated columns over the figures in the same row, so
 * they are read-only here. `excluded_reason` is required whenever `included` is
 * false: a peer set whose rejects are invisible is the one a reviewer cannot
 * check.
 */
export type PeerSetMemberRow = {
  id: number;
  peer_set_id: string;
  organization_id: string;
  company_id: string;
  included: boolean;
  rationale: string;
  decided_by: 'screen' | 'model' | 'person';
  excluded_reason: string | null;
  revenue: number | null;
  ebitda: number | null;
  ebit: number | null;
  pat: number | null;
  total_debt: number | null;
  cash: number | null;
  market_cap: number | null;
  currency: string;
  financials_id: number | null;
  quote_id: number | null;
  period_end: string | null;
  /** Generated, all four. */
  enterprise_value: number | null;
  ev_to_revenue: number | null;
  ev_to_ebitda: number | null;
  price_to_earnings: number | null;
  created_at: string;
};

/** A concluded valuation. Stores what was signed, not what would be recomputed. */
export type ValuationRow = {
  id: string;
  organization_id: string;
  created_by: string;
  peer_set_id: string | null;
  subject_name: string;
  as_of: string;
  concluded_value: number | null;
  low_value: number | null;
  high_value: number | null;
  currency: string;
  valuation_basis: 'minority_private' | 'control_private' | 'minority_listed' | 'control_listed';
  methods: unknown[];
  result: Record<string, unknown>;
  created_at: string;
};

/** One line of the bill for a paid provider. Append-only, cache hits included. */
export type DataLookupRow = {
  id: number;
  looked_up_at: string;
  organization_id: string | null;
  actor_id: string | null;
  actor_email: string;
  provider: string;
  kind: string;
  subject: string;
  company_id: string | null;
  cost_paise: number;
  cache_hit: boolean;
  outcome: 'hit' | 'miss' | 'error';
  note: string | null;
};

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      // 0012 — organizations.
      organizations: Table<OrganizationRow>;
      organization_invites: Table<OrganizationInviteRow>;

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

      // 0010 — the analytics store.
      analytics_admins: Table<AnalyticsAdminRow>;
      page_views: Table<AnalyticsRow>;
      visitor_analytics: Table<AnalyticsRow>;
      visitor_identities: Table<AnalyticsRow>;
      identity_nodes: Table<AnalyticsRow>;
      identity_edges: Table<AnalyticsRow>;
      ip_resolutions: Table<IpResolutionRow>;
      company_enrichment: Table<CompanyEnrichmentRow>;
      enrichment_spend: Table<EnrichmentSpendRow>;

      // 0011 — shared rate limiting and error logging.
      error_log: Table<ErrorLogRow>;
      product_events: Table<ProductEventRow>;
      agent_runs: Table<AgentRunRow>;
      access_requests: Table<AccessRequestRow>;
      feature_requests: Table<FeatureRequestRow>;
      ai_summaries: Table<AiSummaryRow>;

      /*
       * Valuation Desk (0028).
       *
       * The first five are the shared registry: every signed-in person may
       * select from them and nobody may write, so their Insert and Update
       * shapes exist only because Table<Row> supplies them and are unreachable
       * — every write goes through a SECURITY DEFINER function.
       */
      companies: Table<CompanyRegistryRow>;
      company_financials: Table<CompanyFinancialsRow>;
      company_quotes: Table<CompanyQuoteRow>;
      funding_rounds: Table<FundingRoundRow>;
      source_documents: Table<SourceDocumentRow>;
      peer_sets: Table<PeerSetRow>;
      peer_set_members: Table<PeerSetMemberRow>;
      valuations: Table<ValuationRow>;
      data_lookups: Table<DataLookupRow>;
    };
    Views: Record<never, never>;
    Functions: {
      /*
       * Still here, and used again since 0021 — not to assign a number on
       * submit (0019 made that manual on purpose) but to offer the next one as
       * a starting point in a field the reader can still overwrite.
       */
      next_voucher_no: { Args: { p_chapter_id: string; p_date: string | null }; Returns: string };

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

      // 0017 — a plain edit, logged with its own ownership check rather than
      // trusting the caller (unlike log_audit, this is reachable directly).
      log_voucher_change: {
        Args: { p_id: string; p_action: 'created' | 'updated'; p_changed?: Record<string, unknown> | null };
        Returns: void;
      };

      set_chapter_active: { Args: { p_id: string; p_active: boolean }; Returns: ChapterRow };
      rename_chapter: { Args: { p_id: string; p_name: string }; Returns: ChapterRow };

      // 0006 — copies the identity provider's picture onto your own profile row.
      // No arguments on purpose: it reads auth.users itself, so a caller cannot
      // choose the URL that other people's browsers will end up fetching.
      sync_own_avatar: { Args: Record<string, never>; Returns: string | null };

      /*
       * 0010 — analytics. The three writers all take one jsonb payload rather
       * than thirty-odd arguments, and they are the only way anything reaches
       * the event tables: those have no insert policy, so this is not a
       * convenience, it is the door.
       */
      is_analytics_admin: { Args: Record<string, never>; Returns: boolean };
      record_visitor_view: { Args: { p: Record<string, unknown> }; Returns: void };
      record_page_view: { Args: { p: Record<string, unknown> }; Returns: void };
      record_identity: { Args: { p: Record<string, unknown> }; Returns: void };
      prune_analytics: { Args: { p_days?: number }; Returns: number };

      /*
       * 0011 — a shared rate-limit counter and a caught-failure log, both
       * reachable by anon since both exist for callers with no session.
       */
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: { allowed: boolean; retry_after_seconds: number }[];
      };
      record_error: { Args: { p: Record<string, unknown> }; Returns: void };
      prune_errors: { Args: { p_days?: number }; Returns: number };

      /*
       * 0012 — organizations. my_organization_id() is read-only and used
       * everywhere else; the other three are the only way to move a profile
       * into (or between) an organization_id.
       */
      my_organization_id: { Args: Record<string, never>; Returns: string | null };
      create_organization: { Args: { p_name: string }; Returns: OrganizationRow };
      invite_user: {
        Args: { p_email: string; p_role?: UserRole };
        Returns: OrganizationInviteRow;
      };
      invite_preview: {
        Args: { p_token: string };
        Returns: {
          organization_name: string | null;
          role: UserRole | null;
          email: string | null;
          valid: boolean;
          // 0021 — so the join screen can say when the link stops working.
          expires_at: string | null;
        }[];
      };
      accept_invite: { Args: { p_token: string }; Returns: OrganizationRow };

      // 0013 — owner-only toggle read by submit_voucher() to decide whether a
      // draft routes through approval or is paid immediately.
      set_requires_approval: { Args: { p_value: boolean }; Returns: OrganizationRow };

      /*
       * 0021 — the first-run and recovery gaps. rename_organization is the
       * only way the name typed at onboarding can ever change; revoke_invite
       * the only way one is withdrawn; withdraw_voucher lets the person who
       * raised a voucher pull it back while nobody has acted on it.
       */
      rename_organization: { Args: { p_name: string }; Returns: OrganizationRow };
      revoke_invite: { Args: { p_id: string }; Returns: void };
      withdraw_voucher: { Args: { p_id: string }; Returns: Voucher };

      /*
       * 0023 — the three streams the analytics section needs.
       *
       * record_agent_run reports its outcome rather than raising when somebody
       * is at their limit, because being at a cap is an ordinary state the
       * calling screen has to render, not a fault. It returns a single-row set,
       * which is why the shape is an array.
       *
       * submit_feature_request returns false to mean "you had already asked",
       * which is a settled state and not an error either.
       */
      agent_run_cap: { Args: Record<string, never>; Returns: number };
      record_agent_run: {
        Args: { p_slug: string };
        Returns: { allowed: boolean; used: number; cap: number }[];
      };
      submit_feature_request: { Args: { p_slug: string; p_reason?: string | null }; Returns: boolean };
      requested_features: { Args: Record<string, never>; Returns: string[] };

      // 0024 — writing a generated summary into its cache. Gated on the
      // analytics allowlist because each miss costs a model call.
      cache_ai_summary: {
        Args: {
          p_hash: string;
          p_subject: string;
          p_headline: string;
          p_summary: string;
          p_intent: 'high' | 'medium' | 'low';
          p_model?: string | null;
        };
        Returns: void;
      };
      submit_access_request: {
        Args: {
          p_name: string;
          p_email: string;
          p_company?: string | null;
          p_interest?: string | null;
          p_message?: string | null;
          p_ip?: string | null;
          p_source?: string | null;
          p_visitor_id?: string | null;
        };
        Returns: AccessRequestRow;
      };

      /*
       * 0026 — the operator's cross-tenant view.
       *
       * Every one of these is SECURITY DEFINER and checks the analytics
       * allowlist inside its own body, so an unauthorised caller gets an empty
       * set rather than an error. They exist because the RLS on organizations
       * and profiles scopes both to the caller's own organisation, which left
       * every tenant screen rendering exactly one row.
       *
       * The shapes are deliberately narrow. Nothing here returns a voucher
       * amount, a vendor, a voucher number or a note, and nothing added later
       * should either — see the header of the migration.
       */
      operator_tenants: { Args: Record<string, never>; Returns: OperatorTenantRow[] };
      operator_members: { Args: Record<string, never>; Returns: OperatorMemberRow[] };
      operator_onboarding: { Args: Record<string, never>; Returns: OperatorOnboardingRow[] };
      operator_workflow_stages: {
        Args: Record<string, never>;
        Returns: OperatorWorkflowStageRow[];
      };
      operator_stuck_vouchers: {
        Args: { p_days?: number };
        Returns: OperatorStuckRow[];
      };
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
