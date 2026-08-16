-- ---------------------------------------------------------------------------
-- 0013 — optional per-organization approval
--
-- Some organizations do not want the two-person approval chain at all: one
-- person should be able to raise a voucher and have it paid immediately. This
-- was previously a hard requirement built into submit_voucher() itself.
--
-- The flag defaults to true, so every existing organization keeps today's
-- behaviour until its owner explicitly turns it off. Nothing else about the
-- workflow changes: approve_voucher/reject_voucher/mark_voucher_paid are
-- untouched, because a voucher that skips straight to 'paid' never reaches
-- pending_first/pending_second/approved, so those functions simply never see
-- one. A voucher already mid-chain when an owner flips the flag keeps working
-- through the normal approve/reject path — the flag only decides what
-- happens the next time a *draft* is submitted.
-- ---------------------------------------------------------------------------

alter table organizations
  add column requires_approval boolean not null default true;

-- ---------------------------------------------------------------------------
-- set_requires_approval — owner-only, one row (the caller's own org)
-- ---------------------------------------------------------------------------
create or replace function set_requires_approval(p_value boolean)
returns organizations
language plpgsql security definer set search_path = public as $$
declare o organizations;
begin
  if not is_owner() then
    raise exception 'Only an owner can change whether vouchers need approval';
  end if;

  update organizations set requires_approval = p_value
    where id = my_organization_id()
    returning * into o;

  if not found then raise exception 'Organization not found'; end if;
  return o;
end $$;

grant execute on function set_requires_approval(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- submit_voucher — draft | rejected → pending_first, or straight to paid
--
-- Same completeness gate and permission check as before (0012). The only
-- change is the target status and the workflow columns that come with it.
-- ---------------------------------------------------------------------------
create or replace function submit_voucher(p_id uuid)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare
  v vouchers;
  v_requires_approval boolean;
  v_from voucher_status;
  v_to voucher_status;
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

  select requires_approval into v_requires_approval
    from organizations where id = my_organization_id();

  v_from := v.status;
  v_to := case when v_requires_approval then 'pending_first' else 'paid' end;

  update vouchers set
    status       = v_to,
    voucher_no   = coalesce(v.voucher_no, next_voucher_no(v.chapter_id, v.date)),
    initiated_by = coalesce(v.initiated_by, auth.uid()),
    initiated_at = coalesce(v.initiated_at, now()),
    submitted_at = now(),
    rejected_by = null, rejected_at = null, rejection_reason = null,
    paid_marked_by = case when v_requires_approval then null else auth.uid() end,
    paid_at        = case when v_requires_approval then null else now() end
  where id = p_id
  returning * into v;

  perform log_audit(p_id, 'submitted', v_from, v_to);
  return v;
end $$;
