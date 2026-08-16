-- ============================================================================
-- Organizations — turning one client's database into many clients' database
--
-- Until now `profiles`, `chapters`, `events` and `vouchers` were single global
-- tables built for one organization (see 0001's own header: "Client: CIO
-- Association"). `chapters_read` was `using (auth.uid() is not null)` — any
-- signed-in person, from any client, saw every chapter — and an `admin` or
-- `approver` role let someone see every voucher in the whole database. There
-- was no concept anywhere of which client a person belonged to.
--
-- This migration adds that concept and rewires everything that assumed there
-- was only ever one organization to check it instead.
--
-- The one thing worth being explicit about before the rest: several existing
-- functions are SECURITY DEFINER, which means they run as the table owner and
-- BYPASS ROW LEVEL SECURITY entirely for their own internal queries. `is_admin()`
-- alone was never a safe gate for "may touch this specific row" once a second
-- organization exists — nothing stopped an admin of Org A from calling
-- `rename_chapter(<Org B's chapter id>, 'new name')`, because the function only
-- checked the caller's role, never whose chapter it was. Every function below
-- that takes a target row id has an organization check added to the query that
-- finds that row, not just a role check — the same shape as "Voucher not
-- found" already uses, so a cross-organization attempt fails exactly like a
-- non-existent id would.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- organizations — one row per client
-- ---------------------------------------------------------------------------
create table organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  -- The prefix this org's vouchers are issued under (see next_voucher_no
  -- below). Defaults to the platform's own brand; a client is free to look
  -- distinct in their own numbering, but nothing requires it.
  voucher_prefix text not null default 'FI',
  created_at     timestamptz not null default now()
);

comment on table organizations is
  'One client on this platform. Everything a client should not see belonging '
  'to another client is scoped to this.';

-- RLS is enabled here but the read policy is added further down, once
-- my_organization_id() exists for it to call.
alter table organizations enable row level security;

-- ---------------------------------------------------------------------------
-- Backfill: today's only tenant becomes an explicit row rather than an
-- implicit one. Every existing profile, chapter, event and voucher is assigned
-- to it before any NOT NULL constraint goes on, so applying this migration to
-- the live database does not orphan a single row.
-- ---------------------------------------------------------------------------
do $$
declare v_default_org uuid;
begin
  insert into organizations (name) values ('CIO Association') returning id into v_default_org;

  alter table profiles add column organization_id uuid references organizations(id);
  update profiles set organization_id = v_default_org;
  -- Deliberately NOT set not null: this column being null is exactly what
  -- "signed up, has not yet joined or created an organisation" means, and every
  -- policy below fails closed on it (organization_id = my_organization_id()
  -- can never match when either side is null).

  alter table chapters add column organization_id uuid references organizations(id);
  update chapters set organization_id = v_default_org;
  alter table chapters alter column organization_id set not null;

  alter table events add column organization_id uuid references organizations(id);
  update events set organization_id = v_default_org;
  alter table events alter column organization_id set not null;

  alter table vouchers add column organization_id uuid references organizations(id);
  update vouchers set organization_id = v_default_org;
  alter table vouchers alter column organization_id set not null;
end $$;

create index chapters_org_idx  on chapters  (organization_id);
create index events_org_idx    on events    (organization_id);
create index vouchers_org_idx  on vouchers  (organization_id);
create index profiles_org_idx  on profiles  (organization_id) where organization_id is not null;

-- ---------------------------------------------------------------------------
-- Uniqueness moves from global to per-organization.
--
-- Reusing the same constraint names (chapters_name_key, chapters_code_key) on
-- purpose: src/app/actions/admin.ts matches on these exact strings to turn a
-- constraint violation into "A chapter with that name already exists" — giving
-- them a new name would silently fall that message back to a generic one.
-- ---------------------------------------------------------------------------
alter table chapters drop constraint if exists chapters_name_key;
alter table chapters drop constraint if exists chapters_code_key;
alter table chapters add constraint chapters_name_key unique (organization_id, name);
alter table chapters add constraint chapters_code_key unique (organization_id, code);

drop index if exists chapters_single_ho;
create unique index chapters_single_ho on chapters (organization_id) where is_head_office;


-- ---------------------------------------------------------------------------
-- my_organization_id() — the one place "which client is this" is answered
-- ---------------------------------------------------------------------------
create or replace function my_organization_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid()
$$;

comment on function my_organization_id() is
  'The caller''s organization, or null if they have not joined or created one '
  'yet. Every RLS policy and function below that needs to know "is this the '
  'same client" compares against this.';

create policy organizations_read on organizations
  for select using (id = my_organization_id());


-- ═══════════════════════════════════════════════════════════════════════════
-- Stamping and guarding organization_id on write
--
-- A BEFORE trigger rather than trusting the client to send the right value —
-- the same reasoning voucher_no and the generated totals already follow. This
-- is also what means createChapter, createEvent and every voucher-insert path
-- in the existing app code needs no changes at all: none of them ever sent an
-- organization_id, and now none of them need to.
--
-- For events and vouchers, the trigger also refuses a chapter_id (or event_id,
-- or paid_by_chapter_id) that belongs to a different organization. Without
-- this, someone who merely knows another client's chapter UUID could attach
-- their own voucher to it — RLS would still hide that chapter from them, but
-- nothing stops a foreign key insert naming an id you cannot see.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function stamp_chapter_organization() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.organization_id := my_organization_id();
  if new.organization_id is null then
    raise exception 'You must belong to an organization to do this';
  end if;
  return new;
end $$;

create trigger chapters_stamp_org before insert on chapters
  for each row execute function stamp_chapter_organization();

create or replace function guard_event_organization() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_chapter_org uuid;
begin
  if tg_op = 'INSERT' then
    new.organization_id := my_organization_id();
    if new.organization_id is null then
      raise exception 'You must belong to an organization to do this';
    end if;
  end if;

  if new.chapter_id is not null then
    select organization_id into v_chapter_org from chapters where id = new.chapter_id;
    if v_chapter_org is distinct from new.organization_id then
      raise exception 'That chapter does not belong to your organization';
    end if;
  end if;

  return new;
end $$;

create trigger events_guard_org before insert or update on events
  for each row execute function guard_event_organization();

create or replace function guard_voucher_organization() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if tg_op = 'INSERT' then
    new.organization_id := my_organization_id();
    if new.organization_id is null then
      raise exception 'You must belong to an organization to do this';
    end if;
  end if;

  if new.chapter_id is not null then
    select organization_id into v_org from chapters where id = new.chapter_id;
    if v_org is distinct from new.organization_id then
      raise exception 'That chapter does not belong to your organization';
    end if;
  end if;

  if new.paid_by_chapter_id is not null then
    select organization_id into v_org from chapters where id = new.paid_by_chapter_id;
    if v_org is distinct from new.organization_id then
      raise exception 'That paying chapter does not belong to your organization';
    end if;
  end if;

  if new.event_id is not null then
    select organization_id into v_org from events where id = new.event_id;
    if v_org is distinct from new.organization_id then
      raise exception 'That event does not belong to your organization';
    end if;
  end if;

  return new;
end $$;

create trigger vouchers_guard_org before insert or update on vouchers
  for each row execute function guard_voucher_organization();


-- ═══════════════════════════════════════════════════════════════════════════
-- RLS rewrite — every policy from 0003 and 0005 that touches chapters, events,
-- vouchers or profiles, with an organization check added alongside the
-- existing role check. The shape of each policy is unchanged; only the
-- predicate grew.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists chapters_read on chapters;
create policy chapters_read on chapters
  for select using (organization_id = my_organization_id());

drop policy if exists chapters_write on chapters;
create policy chapters_write on chapters
  for all using (is_admin() and organization_id = my_organization_id())
  with check (is_admin() and organization_id = my_organization_id());

drop policy if exists events_read on events;
create policy events_read on events
  for select using (organization_id = my_organization_id());

drop policy if exists events_insert on events;
create policy events_insert on events
  for insert with check (auth.uid() is not null and organization_id = my_organization_id());

drop policy if exists events_modify on events;
create policy events_modify on events
  for update using (is_admin() and organization_id = my_organization_id())
  with check (is_admin() and organization_id = my_organization_id());

drop policy if exists events_delete on events;
create policy events_delete on events
  for delete using (is_admin() and organization_id = my_organization_id());

-- vouchers_read and vouchers_update were both replaced once already, in 0005.
-- These are their final versions, unchanged in shape but for the added
-- organization_id predicate wrapping the whole thing.
drop policy if exists vouchers_read on vouchers;
create policy vouchers_read on vouchers
  for select using (
    organization_id = my_organization_id()
    and (
      created_by = auth.uid()
      or is_admin()
      or (can_approve() and status <> 'draft' and deleted_at is null)
    )
  );

drop policy if exists vouchers_insert on vouchers;
create policy vouchers_insert on vouchers
  for insert with check (
    created_by = auth.uid() and status = 'draft' and organization_id = my_organization_id()
  );

drop policy if exists vouchers_update on vouchers;
create policy vouchers_update on vouchers
  for update using (
    organization_id = my_organization_id()
    and (created_by = auth.uid() or is_admin())
    and status in ('draft', 'rejected')
    and deleted_at is null
  )
  with check (
    organization_id = my_organization_id() and (created_by = auth.uid() or is_admin())
  );

drop policy if exists vouchers_delete on vouchers;
create policy vouchers_delete on vouchers
  for delete using (is_admin() and organization_id = my_organization_id());

-- profiles_read_self: today's version lets ANY approver read ANY profile in
-- the entire database via the `or can_approve()` branch. Attachments/audit
-- policies are untouched — both read through an `exists (select 1 from
-- vouchers ...)` subquery, which already inherits vouchers' own (now
-- organization-scoped) RLS automatically, since it runs as the same
-- authenticated role rather than bypassing it.
drop policy if exists profiles_read_self on profiles;
create policy profiles_read_self on profiles
  for select using (
    id = auth.uid() or (can_approve() and organization_id = my_organization_id())
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Organization guards on every SECURITY DEFINER function that takes a target
-- row id. Each one adds `and organization_id = my_organization_id()` to the
-- query that finds that row, so a cross-organization attempt fails exactly
-- like "that id does not exist" rather than succeeding silently.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function submit_voucher(p_id uuid)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare v vouchers;
begin
  select * into v from vouchers
    where id = p_id and deleted_at is null and organization_id = my_organization_id()
    for update;
  if not found then raise exception 'Voucher not found'; end if;

  if v.created_by <> auth.uid() and not is_admin() then
    raise exception 'Only the person who created this voucher can submit it';
  end if;
  if v.status not in ('draft', 'rejected') then
    raise exception 'Only a draft or rejected voucher can be submitted (this one is %)', v.status;
  end if;

  if v.chapter_id is null           then raise exception 'Chapter is required'; end if;
  if v.paid_to is null or trim(v.paid_to) = '' then raise exception 'Paid To is required'; end if;
  if v.type_of_supporting is null   then raise exception 'Type of Supporting is required'; end if;
  if v.type_of_payment is null      then raise exception 'Type of Payment is required'; end if;
  if v.grand_total <= 0             then raise exception 'Grand Total must be greater than zero'; end if;

  update vouchers set
    status       = 'pending_first',
    voucher_no   = coalesce(v.voucher_no, next_voucher_no(v.chapter_id, v.date)),
    initiated_by = coalesce(v.initiated_by, auth.uid()),
    initiated_at = coalesce(v.initiated_at, now()),
    submitted_at = now(),
    rejected_by = null, rejected_at = null, rejection_reason = null
  where id = p_id
  returning * into v;

  perform log_audit(p_id, 'submitted', 'draft', 'pending_first');
  return v;
end $$;

create or replace function approve_voucher(p_id uuid, p_note text default null)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare v vouchers; me uuid := auth.uid();
begin
  if not can_approve() then
    raise exception 'You do not have permission to approve vouchers';
  end if;

  select * into v from vouchers
    where id = p_id and deleted_at is null and organization_id = my_organization_id()
    for update;
  if not found then raise exception 'Voucher not found'; end if;

  if v.initiated_by = me or v.created_by = me then
    raise exception 'You cannot approve a voucher you raised';
  end if;

  if v.status = 'pending_first' then
    update vouchers set
      status = 'pending_second', approver_1 = me, approved_1_at = now()
    where id = p_id returning * into v;
    perform log_audit(p_id, 'approved_first', 'pending_first', 'pending_second', p_note);

  elsif v.status = 'pending_second' then
    if v.approver_1 = me then
      raise exception 'This voucher already has your first approval — a second person must approve it';
    end if;
    update vouchers set
      status = 'approved', approver_2 = me, approved_2_at = now()
    where id = p_id returning * into v;
    perform log_audit(p_id, 'approved_second', 'pending_second', 'approved', p_note);

  else
    raise exception 'This voucher is % and is not awaiting approval', v.status;
  end if;

  return v;
end $$;

create or replace function reject_voucher(p_id uuid, p_reason text)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare v vouchers; from_status voucher_status;
begin
  if not can_approve() then
    raise exception 'You do not have permission to reject vouchers';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Please give a reason so the voucher can be corrected';
  end if;

  select * into v from vouchers
    where id = p_id and deleted_at is null and organization_id = my_organization_id()
    for update;
  if not found then raise exception 'Voucher not found'; end if;
  if v.status not in ('pending_first', 'pending_second') then
    raise exception 'This voucher is % and is not awaiting approval', v.status;
  end if;
  if v.initiated_by = auth.uid() or v.created_by = auth.uid() then
    raise exception 'You cannot action a voucher you raised';
  end if;

  from_status := v.status;
  update vouchers set
    status = 'rejected',
    rejected_by = auth.uid(), rejected_at = now(), rejection_reason = trim(p_reason),
    approver_1 = null, approved_1_at = null,
    approver_2 = null, approved_2_at = null
  where id = p_id returning * into v;

  perform log_audit(p_id, 'rejected', from_status, 'rejected', trim(p_reason));
  return v;
end $$;

create or replace function reopen_voucher(p_id uuid, p_reason text default null)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare v vouchers; from_status voucher_status;
begin
  select * into v from vouchers
    where id = p_id and deleted_at is null and organization_id = my_organization_id()
    for update;
  if not found then raise exception 'Voucher not found'; end if;

  if v.status = 'rejected' then
    if v.created_by <> auth.uid() and not is_admin() then
      raise exception 'Only the person who raised this voucher can reopen it';
    end if;
  elsif v.status = 'approved' then
    if not is_admin() then
      raise exception 'Only an admin can reopen an approved voucher';
    end if;
    if p_reason is null or length(trim(p_reason)) = 0 then
      raise exception 'Reopening an approved voucher needs a reason';
    end if;
  else
    raise exception 'A % voucher cannot be reopened', v.status;
  end if;

  from_status := v.status;
  update vouchers set
    status = 'draft',
    approver_1 = null, approved_1_at = null,
    approver_2 = null, approved_2_at = null,
    submitted_at = null
  where id = p_id returning * into v;

  perform log_audit(p_id, 'reopened', from_status, 'draft', p_reason);
  return v;
end $$;

create or replace function mark_voucher_paid(
  p_id uuid, p_utr text, p_payment_date date default null
) returns vouchers
language plpgsql security definer set search_path = public as $$
declare v vouchers;
begin
  if not is_admin() then
    raise exception 'Only an admin can mark a voucher as paid';
  end if;
  if p_utr is null or length(trim(p_utr)) = 0 then
    raise exception 'A UTR / reference number is required to mark a voucher paid';
  end if;

  select * into v from vouchers
    where id = p_id and deleted_at is null and organization_id = my_organization_id()
    for update;
  if not found then raise exception 'Voucher not found'; end if;
  if v.status <> 'approved' then
    raise exception 'Only an approved voucher can be marked paid (this one is %)', v.status;
  end if;

  update vouchers set
    status = 'paid',
    utr_ref = trim(p_utr),
    payment_date = coalesce(p_payment_date, v.payment_date, current_date),
    paid_marked_by = auth.uid(), paid_at = now()
  where id = p_id returning * into v;

  perform log_audit(p_id, 'marked_paid', 'approved', 'paid', 'UTR ' || trim(p_utr));
  return v;
end $$;

create or replace function set_user_role(p_user uuid, p_role user_role)
returns profiles
language plpgsql security definer set search_path = public as $$
declare target profiles; result profiles;
begin
  if not is_owner() then
    raise exception 'Only the owner can change roles';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  select * into target from profiles
    where id = p_user and organization_id = my_organization_id();
  if not found then raise exception 'User not found'; end if;
  if target.role = 'owner' then
    raise exception 'An owner''s role cannot be changed';
  end if;

  update profiles set role = p_role where id = p_user returning * into result;
  return result;
end $$;

create or replace function soft_delete_voucher(p_id uuid, p_reason text default null)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare v vouchers;
begin
  select * into v from vouchers
    where id = p_id and deleted_at is null and organization_id = my_organization_id()
    for update;
  if not found then raise exception 'Voucher not found'; end if;

  if v.status in ('draft', 'rejected') then
    if v.created_by <> auth.uid() and not is_admin() then
      raise exception 'Only the person who raised this voucher can delete it';
    end if;
  else
    if not is_admin() then
      raise exception 'Only an admin can delete a voucher that is already in the approval workflow';
    end if;
    if p_reason is null or length(trim(p_reason)) = 0 then
      raise exception 'Deleting a % voucher needs a reason', v.status;
    end if;
  end if;

  update vouchers set deleted_at = now() where id = p_id returning * into v;
  perform log_audit(p_id, 'deleted', v.status, v.status, p_reason);
  return v;
end $$;

create or replace function restore_voucher(p_id uuid)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare v vouchers;
begin
  select * into v from vouchers
    where id = p_id and deleted_at is not null and organization_id = my_organization_id()
    for update;
  if not found then raise exception 'Voucher not found in the bin'; end if;

  if v.created_by <> auth.uid() and not is_admin() then
    raise exception 'Only the person who raised this voucher, or an admin, can restore it';
  end if;

  update vouchers set deleted_at = null where id = p_id returning * into v;
  perform log_audit(p_id, 'restored', v.status, v.status);
  return v;
end $$;

create or replace function purge_voucher(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v vouchers; ever_approved boolean;
begin
  if not is_admin() then
    raise exception 'Only an admin can permanently delete a voucher';
  end if;

  select * into v from vouchers
    where id = p_id and organization_id = my_organization_id()
    for update;
  if not found then raise exception 'Voucher not found'; end if;

  if v.deleted_at is null then
    raise exception 'Move the voucher to the bin before deleting it permanently';
  end if;

  if v.status in ('approved', 'paid') then
    raise exception
      'An approved or paid voucher cannot be permanently deleted — its approval record must survive';
  end if;

  select exists (
    select 1 from voucher_audit
    where voucher_id = p_id
      and action in ('approved_first', 'approved_second', 'marked_paid')
  ) into ever_approved;

  if ever_approved then
    raise exception
      'This voucher was approved at some point, so it cannot be permanently deleted';
  end if;

  delete from vouchers where id = p_id;
end $$;

create or replace function set_chapter_active(p_id uuid, p_active boolean)
returns chapters
language plpgsql security definer set search_path = public as $$
declare c chapters;
begin
  if not is_admin() then
    raise exception 'Only an admin can change chapters';
  end if;

  select * into c from chapters
    where id = p_id and organization_id = my_organization_id()
    for update;
  if not found then raise exception 'Chapter not found'; end if;

  if c.is_head_office and not p_active then
    raise exception 'The head office chapter cannot be deactivated';
  end if;

  update chapters set is_active = p_active where id = p_id returning * into c;
  return c;
end $$;

create or replace function rename_chapter(p_id uuid, p_name text)
returns chapters
language plpgsql security definer set search_path = public as $$
declare c chapters;
begin
  if not is_admin() then
    raise exception 'Only an admin can change chapters';
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Give the chapter a name';
  end if;

  select * into c from chapters
    where id = p_id and organization_id = my_organization_id()
    for update;
  if not found then raise exception 'Chapter not found'; end if;

  update chapters set name = trim(p_name) where id = p_id returning * into c;
  return c;
end $$;

-- ---------------------------------------------------------------------------
-- next_voucher_no — now scoped by organization on both sides.
--
-- The chapter lookup is scoped so a chapter id from another organization is
-- treated as unknown. The sequence count is scoped too, and this is the part
-- that matters most: chapter codes are no longer globally unique (see the
-- constraint change above), so two different clients could each have a
-- chapter coded HO. Without the added `organization_id = v_org` filter here,
-- their voucher numbers would share one counter and could collide.
--
-- The prefix is now read from the organization rather than hardcoded, so a
-- client can look distinct in their own numbering if they choose to; existing
-- numbers already issued are unaffected; see 0007 for why a rename never
-- rewrites history.
-- ---------------------------------------------------------------------------
create or replace function next_voucher_no(p_chapter_id uuid, p_date date)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_org    uuid;
  v_code   text;
  v_prefix text;
  v_fy     text;
  v_seq    int;
  v_tail   text;
begin
  v_org := my_organization_id();
  if v_org is null then
    raise exception 'You must belong to an organization to do this';
  end if;

  select code into v_code from chapters where id = p_chapter_id and organization_id = v_org;
  if v_code is null then
    raise exception 'Unknown chapter';
  end if;

  select voucher_prefix into v_prefix from organizations where id = v_org;

  v_fy := financial_year(coalesce(p_date, current_date));
  v_tail := '/' || v_code || '/' || v_fy || '/';

  perform 1 from chapters where id = p_chapter_id for update;

  select coalesce(max(split_part(voucher_no, '/', 4)::int), 0) + 1
    into v_seq
  from vouchers
  where organization_id = v_org
    and voucher_no like '%' || v_tail || '%';

  return coalesce(v_prefix, 'FI') || v_tail || lpad(v_seq::text, 4, '0');
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- Onboarding: creating an organization, and joining one by invite
-- ═══════════════════════════════════════════════════════════════════════════

create table organization_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email           text not null,
  role            user_role not null default 'member',
  -- The copy-a-link secret. Generated, not chosen, and unique so a lookup by
  -- token can never resolve to more than one invite.
  token           text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '14 days',
  accepted_at     timestamptz
);

create index organization_invites_org_idx   on organization_invites (organization_id);
create index organization_invites_email_idx on organization_invites (lower(email));

comment on table organization_invites is
  'Copy-a-link invites. accept_invite() is the only way one is consumed; '
  'invite_user() is the only way one is created.';

alter table organization_invites enable row level security;

create policy organization_invites_read on organization_invites
  for select using (is_admin() and organization_id = my_organization_id());
-- No insert/update policy: invite_user() and accept_invite() are the only door.

-- ---------------------------------------------------------------------------
-- create_organization — a brand-new client becomes its first owner
--
-- Only callable while profiles.organization_id is still null. Without that
-- guard, someone already inside an organization could call this again and
-- silently switch — and take their existing role's authority — into a second
-- one they just made themselves the owner of.
-- ---------------------------------------------------------------------------
create or replace function create_organization(p_name text)
returns organizations
language plpgsql security definer set search_path = public as $$
declare v_org organizations; v_existing uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create an organisation';
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Give your organisation a name';
  end if;

  select organization_id into v_existing from profiles where id = auth.uid();
  if v_existing is not null then
    raise exception 'You already belong to an organisation';
  end if;

  insert into organizations (name) values (trim(p_name)) returning * into v_org;

  update profiles set organization_id = v_org.id, role = 'owner' where id = auth.uid();

  return v_org;
end $$;

-- ---------------------------------------------------------------------------
-- invite_user — an admin brings a teammate in
-- ---------------------------------------------------------------------------
create or replace function invite_user(p_email text, p_role user_role default 'member')
returns organization_invites
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_email text; v_invite organization_invites;
begin
  if not is_admin() then
    raise exception 'Only an admin can invite people';
  end if;

  v_org := my_organization_id();
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'Give a valid email address';
  end if;

  insert into organization_invites (organization_id, email, role, invited_by)
  values (v_org, v_email, p_role, auth.uid())
  returning * into v_invite;

  return v_invite;
end $$;

-- ---------------------------------------------------------------------------
-- invite_preview — read enough of an invite to show "join <org>?" before
-- accepting it. Deliberately readable by anyone signed in, unlike the table's
-- own RLS: the whole point is that the invited person is not a member of
-- anything yet, so `organization_invites_read`'s admin-of-this-org check could
-- never pass for them.
-- ---------------------------------------------------------------------------
create or replace function invite_preview(p_token text)
returns table(organization_name text, role user_role, email text, valid boolean)
language plpgsql security definer set search_path = public as $$
declare v_invite organization_invites; v_org_name text;
begin
  select * into v_invite from organization_invites where token = p_token;
  if not found then
    return query select null::text, null::user_role, null::text, false;
    return;
  end if;

  select o.name into v_org_name from organizations o where o.id = v_invite.organization_id;

  return query select
    v_org_name,
    v_invite.role,
    v_invite.email,
    (v_invite.accepted_at is null and v_invite.expires_at >= now());
end $$;

-- ---------------------------------------------------------------------------
-- accept_invite — the invited person joins
-- ---------------------------------------------------------------------------
create or replace function accept_invite(p_token text)
returns organizations
language plpgsql security definer set search_path = public as $$
declare v_invite organization_invites; v_org organizations; v_email text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invite';
  end if;

  select * into v_invite from organization_invites where token = p_token for update;
  if not found then raise exception 'That invite link is not valid'; end if;
  if v_invite.accepted_at is not null then raise exception 'That invite has already been used'; end if;
  if v_invite.expires_at < now() then raise exception 'That invite link has expired'; end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email <> v_invite.email then
    raise exception 'This invite was sent to a different email address. Sign in as % to accept it.',
      v_invite.email;
  end if;

  if (select organization_id from profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to an organisation';
  end if;

  update profiles set organization_id = v_invite.organization_id, role = v_invite.role
    where id = auth.uid();

  update organization_invites set accepted_at = now() where id = v_invite.id;

  select * into v_org from organizations where id = v_invite.organization_id;
  return v_org;
end $$;

grant execute on function my_organization_id()               to authenticated;
grant execute on function create_organization(text)          to authenticated;
grant execute on function invite_user(text, user_role)       to authenticated;
grant execute on function invite_preview(text)               to authenticated;
grant execute on function accept_invite(text)                to authenticated;
