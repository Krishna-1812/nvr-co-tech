-- ---------------------------------------------------------------------------
-- 0019 — voucher numbers are typed by hand, and every date is floored at
-- FY 26-27
--
-- 1. Voucher numbering used to be auto-assigned on submit (next_voucher_no()).
--    The desk now wants the number entered manually, same as everything else
--    on the form. submit_voucher() no longer falls back to next_voucher_no()
--    — it requires the caller to have already typed one in, the same way it
--    already requires Paid To or Chapter. next_voucher_no() itself is left in
--    place rather than dropped: nothing calls it any more, but removing a
--    SECURITY DEFINER function that used to serialise concurrent submits is
--    not worth the risk for no functional gain.
--
-- 2. The desk stopped taking vouchers dated before 1 April 2026. Every date
--    column on a voucher gets a floor, not just the voucher date — a client
--    could otherwise backdate an invoice or payment into the old year even
--    though the voucher itself is dated correctly. Added NOT VALID: existing
--    vouchers already on file predate this rule and must not be invalidated
--    by adding it. The floor applies to every row from here on — any future
--    UPDATE to an old row is also checked, same as any INSERT.
-- ---------------------------------------------------------------------------

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

  if v.voucher_no is null or trim(v.voucher_no) = '' then raise exception 'Voucher number is required'; end if;
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
  if v.date < '2026-04-01' then
    raise exception 'The voucher date cannot be earlier than 1 April 2026';
  end if;

  select requires_approval into v_requires_approval
    from organizations where id = my_organization_id();

  v_from := v.status;
  v_to := case when v_requires_approval then 'pending_first' else 'paid' end;

  update vouchers set
    status       = v_to,
    voucher_no   = trim(v.voucher_no),
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

alter table vouchers add constraint dates_not_before_fy2627 check (
  (date is null or date >= '2026-04-01')
  and (event_date is null or event_date >= '2026-04-01')
  and (invoice_date is null or invoice_date >= '2026-04-01')
  and (invoice_received_date is null or invoice_received_date >= '2026-04-01')
  and (payment_date is null or payment_date >= '2026-04-01')
) not valid;
