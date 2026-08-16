-- ---------------------------------------------------------------------------
-- 0015 — one approval is enough, not two
--
-- The "approval required" option (0013/0014) was still the original v1 rule
-- underneath: two different people, neither of them the raiser. The product
-- decision now is that when an organization wants approval at all, a single
-- approver is enough — the whole point of the toggle is to trade rigour for
-- speed, and a mandatory second signature is exactly the rigour being traded
-- away.
--
-- approve_voucher() changes so pending_first goes straight to 'approved' on
-- the first approval, rather than to pending_second waiting for a different
-- second person. The pending_second branch is kept rather than deleted: any
-- voucher already sitting there when this migration runs (raised under the
-- old rule) still needs, and can still receive, its second signature to
-- close out — nothing gets stuck. No organization's submit_voucher() path
-- puts a new voucher into pending_second from here on, so the branch simply
-- stops being reached for anything raised after this ships.
-- ---------------------------------------------------------------------------

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
      status = 'approved', approver_1 = me, approved_1_at = now()
    where id = p_id returning * into v;
    perform log_audit(p_id, 'approved_first', 'pending_first', 'approved', p_note);

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
