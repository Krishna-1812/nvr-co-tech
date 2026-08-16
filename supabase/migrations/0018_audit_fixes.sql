-- ---------------------------------------------------------------------------
-- 0018 — four fixes from a readiness audit: owner-only purge, a lock that
-- names its own scope, a real limit on the invoices bucket, and voucher date
-- bounds
--
-- 1. purge_voucher required only is_admin(), the same bar as renaming a
--    chapter or marking something paid. Unlike those, this one destroys a
--    row permanently and cannot be undone by anyone afterwards — restrict it
--    to is_owner(), the same bar as changing a role or the approval policy.
--
-- 2. next_voucher_no()'s serialising lock (`for update`) named a chapter row
--    by id alone. p_chapter_id is already checked against organization_id
--    just above it, so this was never exploitable — but the lock statement
--    should agree with the check above it about what it is locking, rather
--    than trusting it implicitly.
--
-- 3. The `invoices` bucket accepted anything Storage would take. The app's
--    own validateFile() (src/lib/domain/attachments.ts) checks size and MIME
--    type before upload, but that is client-side only — a direct call to the
--    Storage API bypasses it entirely. Mirroring the same 10 MB / PDF-or-
--    image limits on the bucket itself means the browser is no longer the
--    only thing enforcing them.
--
-- 4. submit_voucher now rejects a voucher dated in the future, or dated
--    outside the current or immediately preceding financial year — both are
--    typos in practice (a slipped digit in the year), never something
--    anyone actually intends to file. Mirrors voucherDateIssue() in
--    src/lib/domain/voucher.ts, which gives the same feedback before this is
--    ever reached.
-- ---------------------------------------------------------------------------

create or replace function purge_voucher(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v vouchers; ever_approved boolean;
begin
  if not is_owner() then
    raise exception 'Only an owner can permanently delete a voucher';
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

  perform 1 from chapters where id = p_chapter_id and organization_id = v_org for update;

  select coalesce(max(split_part(voucher_no, '/', 4)::int), 0) + 1
    into v_seq
  from vouchers
  where organization_id = v_org
    and voucher_no like '%' || v_tail || '%';

  return coalesce(v_prefix, 'FI') || v_tail || lpad(v_seq::text, 4, '0');
end $$;

update storage.buckets
set file_size_limit = 10485760, -- 10 MB — matches MAX_BYTES in attachments.ts
    allowed_mime_types = array[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'
    ]
where id = 'invoices';

create or replace function submit_voucher(p_id uuid)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare
  v vouchers;
  v_requires_approval boolean;
  v_from voucher_status;
  v_to voucher_status;
  v_today date;
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
  if v.date is null                 then raise exception 'Date is required'; end if;

  -- Kolkata, not the server's own timezone — see fiscal.ts for why a naive
  -- current_date can already be tomorrow, or still yesterday, for part of
  -- the day.
  v_today := (now() at time zone 'Asia/Kolkata')::date;
  if v.date > v_today then
    raise exception 'The voucher date cannot be in the future';
  end if;
  if financial_year(v.date) not in
       (financial_year(v_today), financial_year((v_today - interval '1 year')::date))
  then
    raise exception
      'The voucher date (%) is not in the current or previous financial year — check the year', v.date;
  end if;

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
