-- ---------------------------------------------------------------------------
-- 0017 — log what a plain edit actually changed
--
-- voucher_audit already has an 'updated' action and a `changed` diff column
-- (0001), and the timeline already renders both — but nothing has ever called
-- log_audit() for a plain field edit. createDraft() and saveDraft() (the
-- autosave path, firing every 900ms while typing) do bare inserts/updates.
-- The result: a voucher sent back for correction, then quietly altered before
-- resubmission, leaves no record of what actually changed. That is the exact
-- gap this audit trail exists to close.
--
-- log_audit() itself stays internal-only (called from inside workflow
-- functions that have already verified the transition they're logging). This
-- is a separate, narrower function for the application to call directly: it
-- does its own ownership and organization check rather than trusting the
-- caller, since — unlike log_audit — it is reachable straight from a
-- server action with nothing upstream having already checked anything.
-- ---------------------------------------------------------------------------

create or replace function log_voucher_change(
  p_id uuid, p_action audit_action, p_changed jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v vouchers;
begin
  if p_action not in ('created', 'updated') then
    raise exception 'log_voucher_change only logs created or updated, not %', p_action;
  end if;

  select * into v from vouchers
    where id = p_id and organization_id = my_organization_id();
  if not found then raise exception 'Voucher not found'; end if;

  if v.created_by <> auth.uid() and not is_admin() then
    raise exception 'Only the person who raised this voucher, or an admin, can log an edit to it';
  end if;

  insert into voucher_audit (voucher_id, actor_id, action, from_status, to_status, changed)
  values (p_id, auth.uid(), p_action, v.status, v.status, p_changed);
end $$;

grant execute on function log_voucher_change(uuid, audit_action, jsonb) to authenticated;
