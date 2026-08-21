-- ---------------------------------------------------------------------------
-- 0026 — finish the activation funnel, and let the operator see across tenants
--        without letting the operator read a customer's vouchers
--
-- Two halves, and they are here together because neither is much use alone.
--
-- ── Half one: the events that were missing ─────────────────────────────────
--
-- 0022 recorded six moments: account_created, organisation_created,
-- chapter_created, voucher_drafted, voucher_submitted, invite_accepted. Enough
-- to see people arriving and starting work, and nothing at all about whether
-- the work finishes. For an approval product that is the wrong half of the
-- funnel to have.
--
-- So: invite_sent (without which invite_accepted has no denominator and there
-- is no acceptance rate), the three voucher outcomes, and reconciliation_saved
-- (Ledger Reconciliation was only ever counted by agent_runs, which counts
-- opens — opened-and-abandoned and used-successfully looked identical).
--
-- Added as AFTER triggers rather than by rewriting the functions that cause
-- them. 0022 had to rewrite submit_voucher and accept_invite because it wanted
-- the event inside their transaction with access to their locals, and it paid
-- for that by reproducing two long function bodies — the comment above
-- handle_new_user() there says exactly why that is dangerous. Nothing here
-- needs a local variable the row itself does not carry, so nothing here
-- rewrites a function. A trigger cannot drift from a body it does not copy.
--
-- ── Half two: the operator's view across tenants ───────────────────────────
--
-- Every screen in the analytics section that is about tenants is currently
-- blind. `organizations_read` is `using (id = my_organization_id())` and
-- `profiles_read_self` is scoped the same way, so an operator reading those
-- tables sees exactly one organisation — their own — however many customers
-- have signed up. /analytics/orgs has been rendering one row and calling it the
-- tenant list.
--
-- The tempting fix is a policy: `create policy ... using (is_analytics_admin())`
-- on organizations, profiles and vouchers. That is refused here, deliberately.
-- It would make the operator a reader of every customer's payment records —
-- vendor names, amounts, invoice numbers — as a side effect of wanting to know
-- how many vouchers got approved. No dashboard is worth that, and a policy,
-- once added, is available to every query anybody writes afterwards.
--
-- Instead: five SECURITY DEFINER functions that each return an aggregate or a
-- deliberately narrow projection, and nothing else. The boundary is enforced by
-- what the function selects. Somebody adding a screen next month cannot widen
-- it by accident, because there is no wider thing to select from — they would
-- have to come here and change a function body, which is a visible act.
--
-- What is exposed: organisation names and dates, member emails and names, event
-- counts, and durations between status changes. What is not, and must not be:
-- paid_to, grand_total, invoice_no, voucher_no, any attachment, any note. Read
-- that list as the specification for anything added to this file later.
-- ---------------------------------------------------------------------------


-- ═══════════════════════════════════════════════════════════════════════════
-- HALF ONE — the missing events
-- ═══════════════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------------------
-- invite_sent — the denominator for invite_accepted
--
-- On insert rather than inside invite_user(), so an invite created by any route
-- is counted. record_product_event() stamps the inviter's organisation, which
-- is the right attribution: the invite belongs to the org doing the inviting.
-- ---------------------------------------------------------------------------
create or replace function count_invite_sent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform record_product_event('invite_sent', jsonb_build_object('role', new.role));
  return null;
end $$;

drop trigger if exists invite_sent_event on organization_invites;
create trigger invite_sent_event
  after insert on organization_invites
  for each row execute function count_invite_sent();


-- ---------------------------------------------------------------------------
-- The three voucher outcomes
--
-- One trigger on the status column rather than three edits to three functions.
-- It fires only when the status actually moved, so an ordinary edit that
-- rewrites a row without changing its state records nothing.
--
-- Two details worth knowing before reading the counts:
--
--   * An organisation with requires_approval = false goes draft → paid in one
--     update, so that update legitimately records both voucher_submitted (from
--     0022, inside submit_voucher) and voucher_paid (here). Both happened. The
--     skipped_approval flag is what lets a funnel tell the two shapes apart
--     rather than showing an approval step a third of tenants never use.
--
--   * A rejected voucher that is fixed and resubmitted passes through these
--     states again, and is counted again. That is correct for "how many
--     approvals happened" and wrong for "how many vouchers were approved". The
--     meta carries the voucher id so a screen can count either, and the funnel
--     counts distinct vouchers wherever that is what it means.
-- ---------------------------------------------------------------------------
create or replace function count_voucher_outcome() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_meta jsonb;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  v_meta := jsonb_build_object('from', old.status, 'voucher', new.id);

  if new.status = 'approved' then
    perform record_product_event('voucher_approved', v_meta);
  elsif new.status = 'rejected' then
    perform record_product_event('voucher_rejected', v_meta);
  elsif new.status = 'paid' then
    perform record_product_event(
      'voucher_paid',
      v_meta || jsonb_build_object('skipped_approval', old.status in ('draft', 'rejected'))
    );
  end if;

  return null;
end $$;

drop trigger if exists voucher_outcome_event on vouchers;
create trigger voucher_outcome_event
  after update of status on vouchers
  for each row execute function count_voucher_outcome();


-- ---------------------------------------------------------------------------
-- reconciliation_saved — a run that produced something worth keeping
-- ---------------------------------------------------------------------------
create or replace function count_reconciliation_saved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform record_product_event(
    'reconciliation_saved',
    jsonb_build_object('status', new.status)
  );
  return null;
end $$;

drop trigger if exists reconciliation_saved_event on reconciliations;
create trigger reconciliation_saved_event
  after insert on reconciliations
  for each row execute function count_reconciliation_saved();


-- ═══════════════════════════════════════════════════════════════════════════
-- HALF TWO — the operator's cross-tenant view
-- ═══════════════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------------------
-- operator_tenants — one row per organisation, counts only
--
-- Every figure comes from product_events, which means this function never
-- touches the vouchers table at all. That is not an optimisation: it is what
-- makes the privacy claim above checkable by reading twenty lines rather than
-- by trusting a comment.
-- ---------------------------------------------------------------------------
create or replace function operator_tenants()
returns table (
  organization_id uuid,
  name text,
  created_at timestamptz,
  members bigint,
  first_event timestamptz,
  last_event timestamptz,
  chapters_created bigint,
  invites_sent bigint,
  invites_accepted bigint,
  vouchers_drafted bigint,
  vouchers_submitted bigint,
  vouchers_approved bigint,
  vouchers_rejected bigint,
  vouchers_paid bigint,
  reconciliations_saved bigint
)
language sql stable security definer set search_path = public as $$
  select
    o.id,
    o.name,
    o.created_at,
    (select count(*) from profiles p where p.organization_id = o.id),
    min(e.created_at),
    max(e.created_at),
    count(*) filter (where e.name = 'chapter_created'),
    count(*) filter (where e.name = 'invite_sent'),
    count(*) filter (where e.name = 'invite_accepted'),
    count(*) filter (where e.name = 'voucher_drafted'),
    count(*) filter (where e.name = 'voucher_submitted'),
    count(*) filter (where e.name = 'voucher_approved'),
    count(*) filter (where e.name = 'voucher_rejected'),
    count(*) filter (where e.name = 'voucher_paid'),
    count(*) filter (where e.name = 'reconciliation_saved')
  from organizations o
  left join product_events e on e.organization_id = o.id
  where is_analytics_admin()
  group by o.id, o.name, o.created_at
  order by o.created_at;
$$;

-- ---------------------------------------------------------------------------
-- operator_members — the platform's own user list, with org attribution
--
-- Replaces readProfileDirectory() for operator screens, which was reading
-- `profiles` directly and therefore seeing only the operator's own colleagues.
-- That is why every customer on the usage screens shows as a bare email with
-- no organisation against it.
--
-- Emails and display names, which the operator already holds in auth.users, and
-- the organisation each person belongs to. No role: nothing on these screens
-- needs to know who can approve a payment inside somebody else's company.
-- ---------------------------------------------------------------------------
create or replace function operator_members()
returns table (
  email text,
  full_name text,
  avatar_url text,
  organization_id uuid,
  organization_name text,
  joined_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.email, p.full_name, p.avatar_url, p.organization_id, o.name, p.created_at
  from profiles p
  left join organizations o on o.id = p.organization_id
  where is_analytics_admin() and p.email is not null
  order by p.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- operator_onboarding — accounts that never joined an organisation
--
-- The one place a projection rather than a count is returned, and the reason it
-- is defensible: a row here belongs to nobody's tenant by definition, so there
-- is no customer whose privacy is at stake. These are people who signed up to
-- this platform, reached the onboarding screen and stopped. Every address on
-- the list is somebody who could usefully be emailed today, which is the entire
-- point of measuring it.
-- ---------------------------------------------------------------------------
create or replace function operator_onboarding()
returns table (email text, full_name text, signed_up_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.email, p.full_name, p.created_at
  from profiles p
  where is_analytics_admin()
    and p.organization_id is null
    and p.email is not null
  order by p.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- operator_workflow_stages — how long each step of the workflow takes
--
-- The only function here that reads voucher_audit, and it reads two columns of
-- it: which action, and when. Never the note, never the field-level diff.
--
-- Median and p90 rather than a mean, because these distributions have a long
-- tail made of vouchers somebody forgot about, and a mean would report that
-- tail as though it were the normal experience.
--
-- The fourth stage exists because an organisation with approval switched off
-- goes submitted → paid with no approval row, and folding those into the
-- approval stages would either drop them or invent a step they never took.
-- ---------------------------------------------------------------------------
create or replace function operator_workflow_stages()
returns table (stage text, samples bigint, median_hours numeric, p90_hours numeric)
language sql stable security definer set search_path = public as $$
  with steps as (
    select
      v.id,
      v.created_at as drafted,
      max(a.created_at) filter (where a.action = 'submitted') as submitted,
      max(a.created_at) filter (where a.action in ('approved_first', 'approved_second')) as approved,
      max(a.created_at) filter (where a.action = 'marked_paid') as paid
    from vouchers v
    join voucher_audit a on a.voucher_id = v.id
    where is_analytics_admin()
    group by v.id, v.created_at
  ),
  spans as (
    select 'Draft to submitted' as stage,
           extract(epoch from (submitted - drafted)) / 3600 as hours
      from steps where submitted is not null
    union all
    select 'Submitted to approved',
           extract(epoch from (approved - submitted)) / 3600
      from steps where approved is not null and submitted is not null
    union all
    select 'Approved to paid',
           extract(epoch from (paid - approved)) / 3600
      from steps where paid is not null and approved is not null
    union all
    select 'Submitted to paid, no approval step',
           extract(epoch from (paid - submitted)) / 3600
      from steps where paid is not null and submitted is not null and approved is null
  )
  select
    stage,
    count(*),
    round(percentile_cont(0.5) within group (order by hours)::numeric, 1),
    round(percentile_cont(0.9) within group (order by hours)::numeric, 1)
  from spans
  where hours >= 0
  group by stage;
$$;

-- ---------------------------------------------------------------------------
-- operator_stuck_vouchers — work that has stopped moving
--
-- Counts and an age, per organisation, per state. No voucher is identified,
-- because the operator does not need to know which one: the actionable fact is
-- that a named tenant has four things waiting and the oldest has been waiting
-- eleven days. Whose signature it is waiting for is that tenant's own business,
-- and their own approvals screen already tells them.
--
-- Written now rather than alongside the notification work because it stands in
-- for the notifications that are switched off. Nothing currently tells an
-- approver a voucher is waiting, so nothing currently tells anybody that
-- nobody was told.
-- ---------------------------------------------------------------------------
create or replace function operator_stuck_vouchers(p_days integer default 7)
returns table (
  organization_id uuid,
  organization_name text,
  status voucher_status,
  waiting bigint,
  oldest_days integer
)
language sql stable security definer set search_path = public as $$
  select
    v.organization_id,
    o.name,
    v.status,
    count(*),
    max(extract(day from (now() - coalesce(v.submitted_at, v.created_at))))::integer
  from vouchers v
  join organizations o on o.id = v.organization_id
  where is_analytics_admin()
    and v.deleted_at is null
    and v.status in ('draft', 'pending_first', 'pending_second', 'approved', 'rejected')
    and coalesce(v.submitted_at, v.created_at) < now() - make_interval(days => greatest(p_days, 1))
  group by v.organization_id, o.name, v.status
  order by o.name, v.status;
$$;


-- ---------------------------------------------------------------------------
-- Callable by any signed-in user, because every one of them checks
-- is_analytics_admin() for itself and returns nothing to anybody else.
--
-- Returning an empty set rather than raising is deliberate: these back a
-- dashboard, and a screen that renders "no tenants" for somebody who should
-- never have reached it is a better failure than one that shows an error box
-- confirming there is something there to be denied.
-- ---------------------------------------------------------------------------
grant execute on function operator_tenants() to authenticated;
grant execute on function operator_members() to authenticated;
grant execute on function operator_onboarding() to authenticated;
grant execute on function operator_workflow_stages() to authenticated;
grant execute on function operator_stuck_vouchers(integer) to authenticated;
