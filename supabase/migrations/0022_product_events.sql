-- ---------------------------------------------------------------------------
-- 0022 — the five numbers that say whether onboarding works
--
-- The analytics stack (0010) is genuinely good at anonymous visitors and ties
-- them to a person once they sign in — but it records page views and nothing
-- else. Not one product event. So there was no way to answer any of the
-- questions the first-run work in 0021 was meant to move:
--
--   how many accounts ever create an organisation
--   how many organisations ever create a second chapter
--   how many people get as far as a draft
--   how many drafts are ever submitted
--   how many invites are actually accepted
--
-- Recorded in SQL rather than in the app, deliberately. Every one of these
-- moments already passes through a SECURITY DEFINER function or a trigger, and
-- an event emitted there cannot be forgotten by a new call site, cannot be
-- skipped by a client that fails mid-flight, and cannot disagree with what the
-- database actually did.
--
-- Deliberately not a funnel table: one row per occurrence, with a name and a
-- little context. Anything worth charting is a group-by over this.
-- ---------------------------------------------------------------------------

create table if not exists product_events (
  id              bigserial primary key,
  name            text not null,
  actor_id        uuid references profiles(id) on delete set null,
  organization_id uuid references organizations(id) on delete cascade,
  meta            jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists product_events_name_idx on product_events (name, created_at desc);
create index if not exists product_events_org_idx  on product_events (organization_id);

comment on table product_events is
  'Activation milestones, written from the functions that cause them. '
  'Append-only: no update or delete policy exists, and there is no insert '
  'policy either — record_product_event() is the only door.';

alter table product_events enable row level security;

-- Readable by the platform operator only. These are counts about how the
-- product is being adopted, not a client's own data, and they are the same
-- audience as the rest of the analytics screens.
create policy product_events_read on product_events
  for select using (is_analytics_admin());


-- ---------------------------------------------------------------------------
-- record_product_event — the only writer
--
-- Swallows its own failures. A voucher that was submitted has been submitted
-- whether or not the row counting it landed, and a measurement that can break
-- the thing it measures is worse than no measurement.
-- ---------------------------------------------------------------------------
create or replace function record_product_event(p_name text, p_meta jsonb default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into product_events (name, actor_id, organization_id, meta)
  values (p_name, auth.uid(), my_organization_id(), p_meta);
exception when others then
  null;
end $$;


-- ---------------------------------------------------------------------------
-- The five emit points, each added to the function that already owns the moment
-- ---------------------------------------------------------------------------

-- 1. An account exists. handle_new_user() is the trigger that mints the profile
--    row, so it is where a signup is unambiguously real. No organisation yet,
--    which is exactly the point of measuring it separately from the next one.
--    The insert is 0006's, unchanged — it is the version that carries
--    avatar_url across from an OAuth signup, and rewriting it from memory here
--    would quietly undo that. Only the event block below it is new.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    nullif(
      coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
      ''
    )
  )
  on conflict (id) do nothing;

  /*
   * Written directly rather than through record_product_event(), because this
   * runs on a trigger on auth.users where auth.uid() is not the new account and
   * my_organization_id() has nothing to find yet. Its own exception block for
   * the same reason that function has one: a signup must not fail over a count.
   */
  begin
    insert into product_events (name, actor_id)
    values ('account_created', new.id);
  exception when others then null;
  end;

  return new;
end $$;

-- 2. An organisation exists, and its head-office chapter with it (0021).
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

  insert into chapters (name, code, is_head_office)
  values ('Head Office', 'HO', true);

  perform record_product_event('organisation_created', null);

  return v_org;
end $$;

-- 3. A chapter beyond the seeded head office — the first act of real setup.
create or replace function stamp_chapter_organization() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.organization_id := my_organization_id();
  if new.organization_id is null then
    raise exception 'You must belong to an organization to do this';
  end if;

  if not new.is_head_office then
    perform record_product_event('chapter_created', jsonb_build_object('code', new.code));
  end if;

  return new;
end $$;

-- 4. A draft, and 5. a submission. Both on the voucher's own guard trigger and
--    submit function rather than on the actions that call them.
create or replace function guard_voucher_organization() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if tg_op = 'INSERT' then
    new.organization_id := my_organization_id();
    if new.organization_id is null then
      raise exception 'You must belong to an organization to do this';
    end if;
    perform record_product_event('voucher_drafted', null);
  end if;

  if new.chapter_id is not null then
    select organization_id into v_org from chapters where id = new.chapter_id;
    if v_org is distinct from new.organization_id then
      raise exception 'That chapter does not belong to your organization';
    end if;
  end if;

  if new.paid_by_chapter_id is not null then
    select organization_id into v_org from chapters where id = new.paid_by_chapter_id;
    if v_org is distinct from new.organization_id then
      raise exception 'That paying chapter does not belong to your organization';
    end if;
  end if;

  if new.event_id is not null then
    select organization_id into v_org from events where id = new.event_id;
    if v_org is distinct from new.organization_id then
      raise exception 'That event does not belong to your organization';
    end if;
  end if;

  return new;
end $$;

-- 6. An invite that was actually taken up. The count that says whether
--    copy-a-link is working as a way of getting a team in.
create or replace function accept_invite(p_token text)
returns organizations
language plpgsql security definer set search_path = public as $$
declare v_invite organization_invites; v_org organizations; v_email text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invite';
  end if;

  select * into v_invite from organization_invites where token = p_token for update;
  if not found then raise exception 'That invite link is not valid'; end if;
  if v_invite.accepted_at is not null then raise exception 'That invite has already been used'; end if;
  if v_invite.expires_at < now() then raise exception 'That invite link has expired'; end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email <> v_invite.email then
    raise exception 'This invite was sent to a different email address. Sign in as % to accept it.',
      v_invite.email;
  end if;

  if (select organization_id from profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to an organisation';
  end if;

  update profiles set organization_id = v_invite.organization_id, role = v_invite.role
    where id = auth.uid();

  update organization_invites set accepted_at = now() where id = v_invite.id;

  perform record_product_event('invite_accepted', jsonb_build_object('role', v_invite.role));

  select * into v_org from organizations where id = v_invite.organization_id;
  return v_org;
end $$;

-- submit_voucher keeps the body 0020 gave it, with one line added at the end.
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
  perform record_product_event(
    'voucher_submitted',
    jsonb_build_object('went_to', v_to, 'resubmitted', v_from = 'rejected')
  );
  return v;
end $$;


grant execute on function record_product_event(text, jsonb) to authenticated;
