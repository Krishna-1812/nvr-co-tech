-- ---------------------------------------------------------------------------
-- 0020 — Invoice date must be the earliest of the three
--
-- The Invoice date is when the invoice was raised — nothing else on the
-- voucher can happen before that: the voucher itself can't be dated earlier,
-- and the invoice can't have been received earlier. Enforced twice, same
-- pattern as the existing payment_after_invoice constraint (0001):
--
--   1. In submit_voucher(), so the person submitting gets a message that
--      names the actual problem instead of a raw constraint violation.
--   2. As a table CHECK constraint, so it holds even for a row written some
--      other way. Added NOT VALID: existing vouchers were never subject to
--      this rule and must not be invalidated by adding it now — the floor
--      applies to every row from here on, the same way 0019's date-floor
--      constraint does.
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

  if v.invoice_date is not null and v.date < v.invoice_date then
    raise exception 'The voucher date cannot be before the invoice date';
  end if;
  if v.invoice_date is not null and v.invoice_received_date is not null
     and v.invoice_received_date < v.invoice_date then
    raise exception 'The invoice received date cannot be before the invoice date';
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

alter table vouchers add constraint voucher_date_after_invoice check (
  date is null or invoice_date is null or date >= invoice_date
) not valid;

alter table vouchers add constraint invoice_received_after_invoice check (
  invoice_received_date is null or invoice_date is null or invoice_received_date >= invoice_date
) not valid;
