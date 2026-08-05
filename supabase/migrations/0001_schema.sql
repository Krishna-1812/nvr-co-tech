-- ============================================================================
-- Voucher Desk — core schema
-- Client: CIO Association.
--
-- Design notes vs v1:
--   * event_id / event_date are actually persisted (v1's insert silently dropped
--     both, losing the event link and blanking Event Date on re-downloaded PDFs).
--   * events and chapters are org-level, not per-user (v1 gave every user a
--     private, diverging copy of the same real events).
--   * type_of_payment is a plain enum, not a one-element array.
--   * voucher_no is generated, not hand-typed — unique per chapter per FY.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role as enum ('member', 'approver', 'admin', 'owner');

create type voucher_status as enum (
  'draft',
  'pending_first',
  'pending_second',
  'approved',
  'rejected',
  'paid'
);

create type supporting_type as enum (
  'Invoice',
  'Proforma Invoice',
  'Reimbursement',
  'Contract'
);

create type payment_type as enum ('Advance', 'Full Payment');

create type sponsorship as enum ('Sponsored', 'Non-Sponsored');

create type audit_action as enum (
  'created', 'updated', 'submitted', 'approved_first', 'approved_second',
  'rejected', 'reopened', 'marked_paid', 'deleted', 'restored', 'purged'
);

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user
-- Replaces v1's loose is_admin / is_owner booleans with a single ordered role.
-- ---------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text        not null,
  full_name   text,
  role        user_role   not null default 'member',
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column profiles.full_name is
  'Printed on the voucher as Initiated By / Approved By. Captured at signup.';

-- ---------------------------------------------------------------------------
-- chapters — org-level. Seeded with the 15 CIO Association chapters so HO can
-- add or retire one without a redeploy (v1 hard-coded them in the JS bundle).
-- ---------------------------------------------------------------------------
create table chapters (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null unique,
  code        text        not null unique,   -- short form used in voucher numbers
  is_head_office boolean  not null default false,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Exactly one head office.
create unique index chapters_single_ho
  on chapters (is_head_office) where is_head_office;

-- ---------------------------------------------------------------------------
-- events — org-level
-- ---------------------------------------------------------------------------
create table events (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  chapter_id    uuid references chapters(id) on delete set null,
  date_of_event date,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index events_chapter_idx on events (chapter_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- vouchers
-- All 32 business fields from v1 preserved with identical semantics, plus the
-- workflow columns. Money is numeric(14,2) — never float.
-- ---------------------------------------------------------------------------
create table vouchers (
  id            uuid primary key default gen_random_uuid(),

  -- identity
  voucher_no    text,                        -- generated on submit, see 0003
  status        voucher_status not null default 'draft',

  -- § Voucher Info
  date          date,
  chapter_id    uuid references chapters(id) on delete restrict,
  sponsored     sponsorship,

  -- § Event Details  (v1 BUG: event_id and event_date were never saved)
  event_id        uuid references events(id) on delete set null,
  event_name      text,   -- denormalised snapshot: the voucher is a historical record
  event_date      date,   -- snapshot for the same reason
  event_narration text,

  -- § Supporting document
  type_of_supporting    supporting_type,
  type_of_payment       payment_type,
  invoice_no            text,
  invoice_date          date,
  invoice_received_date date,

  -- § Amount breakdown. net_total / grand_total are GENERATED — the formulas
  -- can never drift from the client (v1 computed them in JS and trusted them).
  basic_value numeric(14,2) not null default 0,
  cgst        numeric(14,2) not null default 0,
  sgst        numeric(14,2) not null default 0,
  igst        numeric(14,2) not null default 0,
  vat         numeric(14,2) not null default 0,
  tds         numeric(14,2) not null default 0,
  advance     numeric(14,2) not null default 0,
  tips        numeric(14,2) not null default 0,
  discount    numeric(14,2) not null default 0,

  total_tax   numeric(14,2) generated always as (cgst + sgst + igst) stored,
  net_total   numeric(14,2) generated always as (basic_value + cgst + sgst + igst + vat) stored,
  -- Grand Total = Net − TDS − Advance + Tips − Discount.
  -- NOTE the signs: Tips ADD, Advance SUBTRACTS (already paid out). Same as v1.
  grand_total numeric(14,2) generated always as (
    (basic_value + cgst + sgst + igst + vat) - tds - advance + tips - discount
  ) stored,

  -- § Payment details
  paid_to             text,
  paid_by_chapter_id  uuid references chapters(id) on delete restrict,
  payment_date        date,
  beneficiary_name    text,
  utr_ref             text,
  pan_number          text,
  gst_number          text,

  -- § Workflow (replaces v1's three free-text name boxes)
  initiated_by  uuid references profiles(id) on delete set null,
  initiated_at  timestamptz,
  submitted_at  timestamptz,

  approver_1    uuid references profiles(id) on delete set null,
  approved_1_at timestamptz,
  approver_2    uuid references profiles(id) on delete set null,
  approved_2_at timestamptz,

  rejected_by       uuid references profiles(id) on delete set null,
  rejected_at       timestamptz,
  rejection_reason  text,

  paid_marked_by uuid references profiles(id) on delete set null,
  paid_at        timestamptz,

  created_by  uuid not null references profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  -- ---- Business rules, enforced by the database ----

  -- GST is intra-state (CGST+SGST) or inter-state (IGST) — never both.
  constraint gst_mode_exclusive check (
    not ((cgst > 0 or sgst > 0) and igst > 0)
  ),
  -- CGST and SGST always travel together.
  constraint cgst_sgst_paired check (
    (cgst > 0) = (sgst > 0)
  ),
  -- Amounts are never negative; the signs live in the formula, not the data.
  constraint amounts_non_negative check (
    basic_value >= 0 and cgst >= 0 and sgst >= 0 and igst >= 0 and vat >= 0
    and tds >= 0 and advance >= 0 and tips >= 0 and discount >= 0
  ),
  -- A rejection must say why (v1 had no rejection at all).
  constraint rejection_has_reason check (
    status <> 'rejected' or (rejection_reason is not null and length(trim(rejection_reason)) > 0)
  ),
  -- Segregation of duties: the two approvers must be different people.
  constraint approvers_distinct check (
    approver_1 is null or approver_2 is null or approver_1 <> approver_2
  ),
  -- Anything past draft must carry a voucher number.
  constraint numbered_once_submitted check (
    status = 'draft' or voucher_no is not null
  ),
  constraint payment_after_invoice check (
    payment_date is null or invoice_date is null or payment_date >= invoice_date
  ),
  -- Formats. Blank/NULL allowed (both fields are optional), but if present, valid.
  constraint pan_format check (
    pan_number is null or pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
  ),
  constraint gstin_format check (
    gst_number is null or gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$'
  )
);

-- Voucher numbers are unique across live vouchers (v1 allowed duplicates).
create unique index vouchers_no_unique
  on vouchers (voucher_no) where voucher_no is not null and deleted_at is null;

create index vouchers_status_idx   on vouchers (status)      where deleted_at is null;
create index vouchers_chapter_idx  on vouchers (chapter_id)  where deleted_at is null;
create index vouchers_event_idx    on vouchers (event_id)    where deleted_at is null;
create index vouchers_created_by   on vouchers (created_by)  where deleted_at is null;
create index vouchers_created_at   on vouchers (created_at desc);
-- Approver queue: the hot path.
create index vouchers_queue_idx
  on vouchers (status, submitted_at)
  where deleted_at is null and status in ('pending_first', 'pending_second');

-- ---------------------------------------------------------------------------
-- voucher_attachments — the actual invoice. v1 had nowhere to put it.
-- ---------------------------------------------------------------------------
create table voucher_attachments (
  id          uuid primary key default gen_random_uuid(),
  voucher_id  uuid not null references vouchers(id) on delete cascade,
  storage_path text not null,
  file_name   text not null,
  mime_type   text,
  size_bytes  bigint,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index attachments_voucher_idx on voucher_attachments (voucher_id);

-- ---------------------------------------------------------------------------
-- voucher_audit — append-only. This is what makes a voucher defensible.
-- No UPDATE or DELETE is ever granted on this table (see 0002).
-- ---------------------------------------------------------------------------
create table voucher_audit (
  id          bigserial primary key,
  voucher_id  uuid not null references vouchers(id) on delete cascade,
  actor_id    uuid references profiles(id) on delete set null,
  action      audit_action not null,
  from_status voucher_status,
  to_status   voucher_status,
  note        text,
  changed     jsonb,          -- field-level diff for 'updated'
  created_at  timestamptz not null default now()
);

create index audit_voucher_idx on voucher_audit (voucher_id, created_at desc);

-- ---------------------------------------------------------------------------
-- user_settings — Google Sheet connection (unchanged behaviour from v1)
-- ---------------------------------------------------------------------------
create table user_settings (
  user_id         uuid primary key references profiles(id) on delete cascade,
  google_sheet_id text,
  sheet_title     text,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sheet_sync_log — v1 swallowed sync failures with .catch(() => {}) and told the
-- user "saved". Now every attempt is recorded and retryable.
-- ---------------------------------------------------------------------------
create table sheet_sync_log (
  id          bigserial primary key,
  voucher_id  uuid references vouchers(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  operation   text not null check (operation in ('append', 'delete')),
  status      text not null check (status in ('pending', 'success', 'failed')),
  attempts    int  not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index sheet_sync_pending_idx
  on sheet_sync_log (status, created_at) where status in ('pending', 'failed');

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch    before update on profiles
  for each row execute function touch_updated_at();
create trigger vouchers_touch    before update on vouchers
  for each row execute function touch_updated_at();
create trigger settings_touch    before update on user_settings
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- New auth users get a profile automatically.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
