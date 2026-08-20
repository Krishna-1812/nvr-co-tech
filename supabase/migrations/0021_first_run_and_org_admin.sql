-- ---------------------------------------------------------------------------
-- 0021 — clearing the first-run wall, and the gaps around it
--
-- A new-user walk of the product found the journey stopping dead at the first
-- required field of the first real task. create_organization() built an
-- organisation with no chapters in it, and Chapter is required on every
-- voucher — so a brand-new owner reached a mandatory dropdown holding nothing
-- but its own placeholder, with nothing on the screen explaining why. The
-- phrase "you need a chapter first" existed nowhere in the product.
--
-- This migration fixes the cause rather than adding a message about it, and
-- closes four smaller gaps found on the same walk:
--
--   1. create_organization() now seeds a head-office chapter. One change fixes
--      three symptoms at once: the empty dropdown, the "Paid by chapter" hint
--      that promised a head office no code path could ever create, and the
--      voucher number having no chapter code to be derived from.
--   2. rename_organization() — the name was typed once at onboarding and was
--      then permanent, unrenameable and never displayed again anywhere.
--   3. invite_user() refuses a duplicate outstanding invite and an address
--      that is already a member, instead of silently minting parallel tokens.
--      invite_preview() gains expires_at so the join screen can state it.
--   4. revoke_invite() — an invite could be created and never withdrawn.
--   5. withdraw_voucher() — the person who raised a voucher could not recall
--      it once submitted. Their only route was to find an approver out of band
--      and ask to be rejected, and the fields most likely to be wrong are the
--      ones they had to guess at. Recalling your own un-actioned voucher is
--      not a privileged operation, so it does not need an admin.
-- ---------------------------------------------------------------------------

-- A withdrawal is not a rejection and not an admin reopen, and an audit trail
-- that called it either would be lying about who did what.
alter type audit_action add value if not exists 'withdrawn';


-- ---------------------------------------------------------------------------
-- create_organization — now leaves the organisation usable, not merely present
--
-- 'Head Office' / 'HO' satisfies all three chapter constraints 0012 set up
-- (unique name per org, unique code per org, one head office per org), and the
-- chapters_stamp_org trigger fills organization_id from the profile we have
-- just updated — which is why that update has to come first.
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

  -- Seeded, not requested. Every organisation needs at least one chapter to
  -- raise anything at all, and asking a brand-new owner to invent one before
  -- they have seen a voucher is asking them to make a decision they have no
  -- basis for yet. It is renameable from Admin → Chapters like any other.
  insert into chapters (name, code, is_head_office)
  values ('Head Office', 'HO', true);

  return v_org;
end $$;


-- ---------------------------------------------------------------------------
-- rename_organization — owner only
-- ---------------------------------------------------------------------------
create or replace function rename_organization(p_name text)
returns organizations
language plpgsql security definer set search_path = public as $$
declare v_org organizations;
begin
  if not is_owner() then
    raise exception 'Only an owner can rename the organisation';
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Give your organisation a name';
  end if;

  update organizations set name = trim(p_name)
    where id = my_organization_id()
  returning * into v_org;

  if not found then raise exception 'Organisation not found'; end if;
  return v_org;
end $$;


-- ---------------------------------------------------------------------------
-- invite_user — refuses duplicates rather than stacking them
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

  -- Already inside. Without this the admin mints a token that accept_invite
  -- will always refuse with 'You already belong to an organisation', which
  -- reads as a broken link rather than as an answer.
  if exists (
    select 1 from profiles
    where organization_id = v_org and lower(email) = v_email
  ) then
    raise exception '% is already in your organisation', v_email;
  end if;

  -- An outstanding invite already covers this address. Two live tokens for one
  -- person is not twice as useful; it is two things to keep track of.
  if exists (
    select 1 from organization_invites
    where organization_id = v_org
      and email = v_email
      and accepted_at is null
      and expires_at >= now()
  ) then
    raise exception 'There is already an invite waiting for %. Revoke it first to issue a new one.',
      v_email;
  end if;

  insert into organization_invites (organization_id, email, role, invited_by)
  values (v_org, v_email, p_role, auth.uid())
  returning * into v_invite;

  return v_invite;
end $$;


-- ---------------------------------------------------------------------------
-- invite_preview — same as 0012 plus expires_at, so the person being invited
-- can be told when the link stops working before they walk away from it.
--
-- Dropped rather than replaced: the return type is changing, and CREATE OR
-- REPLACE cannot widen a RETURNS TABLE.
-- ---------------------------------------------------------------------------
drop function if exists invite_preview(text);

create function invite_preview(p_token text)
returns table(
  organization_name text,
  role user_role,
  email text,
  valid boolean,
  expires_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare v_invite organization_invites; v_org_name text;
begin
  select * into v_invite from organization_invites where token = p_token;
  if not found then
    return query select null::text, null::user_role, null::text, false, null::timestamptz;
    return;
  end if;

  select o.name into v_org_name from organizations o where o.id = v_invite.organization_id;

  return query select
    v_org_name,
    v_invite.role,
    v_invite.email,
    (v_invite.accepted_at is null and v_invite.expires_at >= now()),
    v_invite.expires_at;
end $$;


-- ---------------------------------------------------------------------------
-- revoke_invite — an admin withdraws one they issued
--
-- A hard delete. An unaccepted invite is not a record of anything that
-- happened, and leaving revoked rows behind would mean the "already invited"
-- check above had to reason about them.
-- ---------------------------------------------------------------------------
create or replace function revoke_invite(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Only an admin can revoke an invite';
  end if;

  delete from organization_invites
  where id = p_id
    and organization_id = my_organization_id()
    and accepted_at is null;

  if not found then
    raise exception 'That invite has already been used, or is not yours to revoke';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- withdraw_voucher — the raiser pulls their own voucher back to draft
--
-- Deliberately narrower than reopen_voucher: only the person who raised it,
-- only while it is still waiting, and only if nobody has given an approval
-- yet. Once somebody has acted on it the record belongs to more than one
-- person and taking it back silently would erase their part in it — that case
-- is a rejection, or an admin reopen, both of which demand a reason.
-- ---------------------------------------------------------------------------
create or replace function withdraw_voucher(p_id uuid)
returns vouchers
language plpgsql security definer set search_path = public as $$
declare v vouchers; v_from voucher_status;
begin
  select * into v from vouchers
    where id = p_id and deleted_at is null and organization_id = my_organization_id()
    for update;
  if not found then raise exception 'Voucher not found'; end if;

  if v.created_by <> auth.uid() then
    raise exception 'Only the person who raised this voucher can withdraw it';
  end if;
  if v.status not in ('pending_first', 'pending_second') then
    raise exception 'Only a voucher waiting for approval can be withdrawn (this one is %)', v.status;
  end if;
  if v.approver_1 is not null or v.approver_2 is not null then
    raise exception 'Somebody has already approved this voucher. Ask them to send it back instead.';
  end if;

  v_from := v.status;

  update vouchers set
    status = 'draft',
    submitted_at = null
  where id = p_id returning * into v;

  perform log_audit(p_id, 'withdrawn', v_from, 'draft', null);
  return v;
end $$;


grant execute on function rename_organization(text) to authenticated;
grant execute on function invite_preview(text)      to authenticated;
grant execute on function revoke_invite(uuid)       to authenticated;
grant execute on function withdraw_voucher(uuid)    to authenticated;
