-- ============================================================================
-- NVR Voucher v2 — Row Level Security
--
-- v1 had no migrations at all: the schema and every policy lived only in the
-- Supabase dashboard, unreviewable and unreproducible. Everything is explicit here.
--
-- Shape of the model:
--   * members see and edit only their own vouchers, and only while editable
--   * approvers additionally see everything submitted for approval
--   * admins and owners see everything
--   * status transitions happen ONLY through the SECURITY DEFINER functions in
--     0002 — direct UPDATEs cannot move a voucher between states
--   * voucher_audit is append-only for everyone
-- ============================================================================

alter table profiles            enable row level security;
alter table chapters            enable row level security;
alter table events              enable row level security;
alter table vouchers            enable row level security;
alter table voucher_attachments enable row level security;
alter table voucher_audit       enable row level security;
alter table user_settings       enable row level security;
alter table sheet_sync_log      enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_read_self on profiles
  for select using (id = auth.uid() or can_approve());

create policy profiles_update_self on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Role changes go through set_user_role() only. No direct role UPDATE policy
-- exists, so a member cannot promote themselves even with a raw REST call.

-- ---------------------------------------------------------------------------
-- chapters / events — readable by all signed-in users, writable by admins.
-- (v1 made these per-user, so two staff kept diverging lists of the same events.)
-- ---------------------------------------------------------------------------
create policy chapters_read on chapters
  for select using (auth.uid() is not null);

create policy chapters_write on chapters
  for all using (is_admin()) with check (is_admin());

create policy events_read on events
  for select using (auth.uid() is not null);

-- Anyone can create an event (they're created inline from the voucher form),
-- but only admins can edit or remove one.
create policy events_insert on events
  for insert with check (auth.uid() is not null);

create policy events_modify on events
  for update using (is_admin()) with check (is_admin());

create policy events_delete on events
  for delete using (is_admin());

-- ---------------------------------------------------------------------------
-- vouchers
-- ---------------------------------------------------------------------------

-- Read: own vouchers; approvers also see anything in or past the approval queue;
-- admins see everything.
create policy vouchers_read on vouchers
  for select using (
    created_by = auth.uid()
    or is_admin()
    or (can_approve() and status <> 'draft')
  );

create policy vouchers_insert on vouchers
  for insert with check (
    created_by = auth.uid() and status = 'draft'
  );

-- Edit: only your own voucher, and only while it is a draft or has been sent
-- back to you. Approved and paid vouchers are frozen (also enforced by trigger).
-- Admins may edit a draft/rejected voucher on someone's behalf.
create policy vouchers_update on vouchers
  for update using (
    (created_by = auth.uid() or is_admin())
    and status in ('draft', 'rejected')
    and deleted_at is null
  )
  with check (
    created_by = auth.uid() or is_admin()
  );

-- Soft delete is an UPDATE (covered above). Hard delete is admin-only.
create policy vouchers_delete on vouchers
  for delete using (is_admin());

-- ---------------------------------------------------------------------------
-- attachments — follow the voucher
-- ---------------------------------------------------------------------------
create policy attachments_read on voucher_attachments
  for select using (
    exists (
      select 1 from vouchers v
      where v.id = voucher_id
        and (v.created_by = auth.uid() or is_admin() or (can_approve() and v.status <> 'draft'))
    )
  );

create policy attachments_write on voucher_attachments
  for insert with check (
    exists (
      select 1 from vouchers v
      where v.id = voucher_id
        and (v.created_by = auth.uid() or is_admin())
        and v.status in ('draft', 'rejected')
    )
  );

create policy attachments_delete on voucher_attachments
  for delete using (
    exists (
      select 1 from vouchers v
      where v.id = voucher_id
        and (v.created_by = auth.uid() or is_admin())
        and v.status in ('draft', 'rejected')
    )
  );

-- ---------------------------------------------------------------------------
-- voucher_audit — readable with the voucher, append-only, never mutable.
-- There is deliberately no UPDATE or DELETE policy: not even an owner can
-- rewrite history. That is the point of an audit trail.
-- ---------------------------------------------------------------------------
create policy audit_read on voucher_audit
  for select using (
    exists (
      select 1 from vouchers v
      where v.id = voucher_id
        and (v.created_by = auth.uid() or is_admin() or can_approve())
    )
  );

create policy audit_append on voucher_audit
  for insert with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- user_settings / sheet_sync_log — strictly per-user
-- ---------------------------------------------------------------------------
create policy settings_own on user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy sync_log_own on sheet_sync_log
  for select using (user_id = auth.uid() or is_admin());

create policy sync_log_write on sheet_sync_log
  for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage bucket for invoice attachments (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- Files live at invoices/<voucher_id>/<filename>; access mirrors the voucher.
create policy invoices_read on storage.objects
  for select using (
    bucket_id = 'invoices'
    and exists (
      select 1 from vouchers v
      where v.id::text = (storage.foldername(name))[1]
        and (v.created_by = auth.uid() or is_admin() or (can_approve() and v.status <> 'draft'))
    )
  );

create policy invoices_write on storage.objects
  for insert with check (
    bucket_id = 'invoices'
    and exists (
      select 1 from vouchers v
      where v.id::text = (storage.foldername(name))[1]
        and (v.created_by = auth.uid() or is_admin())
        and v.status in ('draft', 'rejected')
    )
  );

create policy invoices_delete on storage.objects
  for delete using (
    bucket_id = 'invoices'
    and exists (
      select 1 from vouchers v
      where v.id::text = (storage.foldername(name))[1]
        and (v.created_by = auth.uid() or is_admin())
        and v.status in ('draft', 'rejected')
    )
  );
