-- ============================================================================
-- NVR Voucher v2 — deletion, restore, and chapter administration
--
-- Fixes a real bug in 0003: `vouchers_update` requires `deleted_at is null` in
-- its USING clause, so a soft-deleted row could never be updated — which means
-- restore was impossible for everyone, including admins. Its status predicate
-- also limited soft delete to drafts, so the recycle bin could only ever hold
-- drafts.
--
-- Deletion is a state transition like any other, so it moves to SECURITY
-- DEFINER functions alongside the rest of the workflow, with its own rules and
-- its own audit entries.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- soft_delete_voucher — move to the recycle bin
--
-- The creator may bin their own draft or rejected voucher. Removing anything
-- that has entered the approval workflow is an admin act, and is audited.
-- ---------------------------------------------------------------------------
create or replace function soft_delete_voucher(p_id uuid, p_reason text default null)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare v vouchers;
begin
  select * into v from vouchers where id = p_id and deleted_at is null for update;
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

-- ---------------------------------------------------------------------------
-- restore_voucher — bring it back out of the bin
-- ---------------------------------------------------------------------------
create or replace function restore_voucher(p_id uuid)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare v vouchers;
begin
  select * into v from vouchers where id = p_id and deleted_at is not null for update;
  if not found then raise exception 'Voucher not found in the bin'; end if;

  if v.created_by <> auth.uid() and not is_admin() then
    raise exception 'Only the person who raised this voucher, or an admin, can restore it';
  end if;

  update vouchers set deleted_at = null where id = p_id returning * into v;
  perform log_audit(p_id, 'restored', v.status, v.status);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- purge_voucher — permanent deletion
--
-- Deliberately refuses to destroy anything that was ever approved or paid.
-- voucher_audit cascades on delete, so purging an approved voucher would erase
-- the evidence that it was approved — exactly what the audit trail exists to
-- prevent. Those stay in the bin instead.
-- ---------------------------------------------------------------------------
create or replace function purge_voucher(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v vouchers; ever_approved boolean;
begin
  if not is_admin() then
    raise exception 'Only an admin can permanently delete a voucher';
  end if;

  select * into v from vouchers where id = p_id for update;
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

-- ---------------------------------------------------------------------------
-- Replace the update policy so it no longer pretends to cover deletion.
-- Editing is for live vouchers only; the bin is handled by the functions above.
-- ---------------------------------------------------------------------------
drop policy if exists vouchers_update on vouchers;

create policy vouchers_update on vouchers
  for update using (
    (created_by = auth.uid() or is_admin())
    and status in ('draft', 'rejected')
    and deleted_at is null
  )
  with check (
    created_by = auth.uid() or is_admin()
  );

-- The bin has to be readable to be shown. Creators see their own; admins see all.
drop policy if exists vouchers_read on vouchers;

create policy vouchers_read on vouchers
  for select using (
    created_by = auth.uid()
    or is_admin()
    or (can_approve() and status <> 'draft' and deleted_at is null)
  );

-- ---------------------------------------------------------------------------
-- Chapters: retiring rather than deleting.
--
-- A chapter is referenced by historical vouchers (ON DELETE RESTRICT), so it
-- can never simply be removed. Deactivating hides it from new vouchers while
-- leaving every past voucher intact and readable.
-- ---------------------------------------------------------------------------
create or replace function set_chapter_active(p_id uuid, p_active boolean)
returns chapters
language plpgsql security definer set search_path = public as $$
declare c chapters;
begin
  if not is_admin() then
    raise exception 'Only an admin can change chapters';
  end if;

  select * into c from chapters where id = p_id for update;
  if not found then raise exception 'Chapter not found'; end if;

  if c.is_head_office and not p_active then
    raise exception 'The head office chapter cannot be deactivated';
  end if;

  update chapters set is_active = p_active where id = p_id returning * into c;
  return c;
end $$;

-- Chapter codes appear in voucher numbers, so they are fixed once used.
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

  select * into c from chapters where id = p_id for update;
  if not found then raise exception 'Chapter not found'; end if;

  -- Only the display name changes. Voucher numbers embed the code, which is
  -- fixed for life, so a rename never invalidates an existing voucher number.
  update chapters set name = trim(p_name) where id = p_id returning * into c;
  return c;
end $$;
