-- ============================================================================
-- NVR Voucher v2 — the approval workflow
--
-- Every rule here is enforced in the DATABASE, not the UI. That is the whole
-- point of the rebuild: v1's "approvals" were three free-text name boxes typed
-- by whoever created the voucher, so a voucher could be self-approved by typing
-- a colleague's name. Here, approval requires being a distinct, authorised
-- person, and every transition is recorded immutably.
--
-- Rules:
--   1. The initiator may never approve their own voucher.
--   2. The second approver must differ from the first.
--   3. Only approver / admin / owner may approve.
--   4. Rejection requires a reason.
--   5. approved and paid vouchers are immutable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function current_role_of() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;

create or replace function can_approve() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_role_of() in ('approver', 'admin', 'owner'), false)
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_role_of() in ('admin', 'owner'), false)
$$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_role_of() = 'owner', false)
$$;

-- ---------------------------------------------------------------------------
-- Voucher numbering: NVR/<CHAPTER-CODE>/<FY>/<0001>
-- Indian financial year, 1 April – 31 March. Sequence is per chapter per FY.
-- Assigned on submit (drafts stay unnumbered so abandoned drafts don't burn
-- numbers — an auditor expects an unbroken series).
-- ---------------------------------------------------------------------------
create or replace function financial_year(d date) returns text
language sql immutable as $$
  select case
    when extract(month from d) >= 4
      then to_char(d, 'YY') || '-' || to_char(d + interval '1 year', 'YY')
    else to_char(d - interval '1 year', 'YY') || '-' || to_char(d, 'YY')
  end
$$;

create or replace function next_voucher_no(p_chapter_id uuid, p_date date)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_fy   text;
  v_seq  int;
  v_prefix text;
begin
  select code into v_code from chapters where id = p_chapter_id;
  if v_code is null then
    raise exception 'Unknown chapter';
  end if;

  v_fy := financial_year(coalesce(p_date, current_date));
  v_prefix := 'NVR/' || v_code || '/' || v_fy || '/';

  -- Lock the chapter row so two concurrent submits can't take the same number.
  perform 1 from chapters where id = p_chapter_id for update;

  select coalesce(max(split_part(voucher_no, '/', 4)::int), 0) + 1
    into v_seq
  from vouchers
  where voucher_no like v_prefix || '%';

  return v_prefix || lpad(v_seq::text, 4, '0');
end $$;

-- ---------------------------------------------------------------------------
-- Immutability: once approved or paid, business fields are frozen.
-- Only workflow columns may still move (e.g. approved → paid).
-- ---------------------------------------------------------------------------
create or replace function guard_locked_vouchers() returns trigger
language plpgsql as $$
begin
  if old.status in ('approved', 'paid') then
    if new.basic_value  is distinct from old.basic_value
    or new.cgst         is distinct from old.cgst
    or new.sgst         is distinct from old.sgst
    or new.igst         is distinct from old.igst
    or new.vat          is distinct from old.vat
    or new.tds          is distinct from old.tds
    or new.advance      is distinct from old.advance
    or new.tips         is distinct from old.tips
    or new.discount     is distinct from old.discount
    or new.paid_to      is distinct from old.paid_to
    or new.invoice_no   is distinct from old.invoice_no
    or new.chapter_id   is distinct from old.chapter_id
    or new.event_id     is distinct from old.event_id
    or new.voucher_no   is distinct from old.voucher_no
    then
      raise exception
        'This voucher is % and cannot be edited. Reopen it first.', old.status
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create trigger vouchers_guard_locked
  before update on vouchers
  for each row execute function guard_locked_vouchers();

-- ---------------------------------------------------------------------------
-- Audit helper
-- ---------------------------------------------------------------------------
create or replace function log_audit(
  p_voucher uuid, p_action audit_action,
  p_from voucher_status, p_to voucher_status, p_note text default null
) returns void
language sql security definer set search_path = public as $$
  insert into voucher_audit (voucher_id, actor_id, action, from_status, to_status, note)
  values (p_voucher, auth.uid(), p_action, p_from, p_to, p_note)
$$;

-- ---------------------------------------------------------------------------
-- submit_voucher — draft | rejected → pending_first
-- ---------------------------------------------------------------------------
create or replace function submit_voucher(p_id uuid)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare v vouchers;
begin
  select * into v from vouchers where id = p_id and deleted_at is null for update;
  if not found then raise exception 'Voucher not found'; end if;

  if v.created_by <> auth.uid() and not is_admin() then
    raise exception 'Only the person who created this voucher can submit it';
  end if;
  if v.status not in ('draft', 'rejected') then
    raise exception 'Only a draft or rejected voucher can be submitted (this one is %)', v.status;
  end if;

  -- Completeness gate: these are required to submit, but NOT to save a draft —
  -- so a half-finished voucher can still be parked and picked up later.
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
    -- Clear any previous rejection: this is a fresh run at approval.
    rejected_by = null, rejected_at = null, rejection_reason = null
  where id = p_id
  returning * into v;

  perform log_audit(p_id, 'submitted', 'draft', 'pending_first');
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- approve_voucher — pending_first → pending_second → approved
-- Enforces segregation of duties.
-- ---------------------------------------------------------------------------
create or replace function approve_voucher(p_id uuid, p_note text default null)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare v vouchers; me uuid := auth.uid();
begin
  if not can_approve() then
    raise exception 'You do not have permission to approve vouchers';
  end if;

  select * into v from vouchers where id = p_id and deleted_at is null for update;
  if not found then raise exception 'Voucher not found'; end if;

  -- Rule 1: never approve your own voucher.
  if v.initiated_by = me or v.created_by = me then
    raise exception 'You cannot approve a voucher you raised';
  end if;

  if v.status = 'pending_first' then
    update vouchers set
      status = 'pending_second', approver_1 = me, approved_1_at = now()
    where id = p_id returning * into v;
    perform log_audit(p_id, 'approved_first', 'pending_first', 'pending_second', p_note);

  elsif v.status = 'pending_second' then
    -- Rule 2: the second approver must be a different person.
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

-- ---------------------------------------------------------------------------
-- reject_voucher — pending_* → rejected. Reason mandatory.
-- ---------------------------------------------------------------------------
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

  select * into v from vouchers where id = p_id and deleted_at is null for update;
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
    -- A rejection voids approvals already given: the next run starts clean.
    approver_1 = null, approved_1_at = null,
    approver_2 = null, approved_2_at = null
  where id = p_id returning * into v;

  perform log_audit(p_id, 'rejected', from_status, 'rejected', trim(p_reason));
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- reopen_voucher — rejected → draft (initiator), or approved → draft (admin).
-- Reopening an approved voucher is a deliberate, audited act.
-- ---------------------------------------------------------------------------
create or replace function reopen_voucher(p_id uuid, p_reason text default null)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare v vouchers; from_status voucher_status;
begin
  select * into v from vouchers where id = p_id and deleted_at is null for update;
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

-- ---------------------------------------------------------------------------
-- mark_paid — approved → paid. Records the UTR.
-- ---------------------------------------------------------------------------
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

  select * into v from vouchers where id = p_id and deleted_at is null for update;
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

-- ---------------------------------------------------------------------------
-- Role management — carried over from v1: an owner may not demote another
-- owner, nor themselves.
-- ---------------------------------------------------------------------------
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

  select * into target from profiles where id = p_user;
  if not found then raise exception 'User not found'; end if;
  if target.role = 'owner' then
    raise exception 'An owner''s role cannot be changed';
  end if;

  update profiles set role = p_role where id = p_user returning * into result;
  return result;
end $$;
