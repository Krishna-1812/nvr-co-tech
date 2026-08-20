-- ---------------------------------------------------------------------------
-- 0023 — the three things the analytics section could not measure
--
-- The admin analytics rebuild needs three event streams this database has never
-- carried. Each one is a write path first and a dashboard second, which is the
-- order they are built in here: a page that charts a table nobody writes to is
-- an elaborate way of drawing a zero.
--
--   1. agent_runs — one row per open of a metered tool, so "who is using what,
--      and who has hit their limit" is answerable at all. Runs are also the
--      strongest buying signal this product has, which is why the flagship
--      people table sorts on them ahead of logins.
--
--   2. access_requests — the public "request access" form. Anonymous or signed
--      in, from the marketing site.
--
--   3. feature_requests — a signed-in person asking for a tool that is not live
--      yet. Deduplicated at write time so one person asking twice is one row,
--      which is what lets a button read "request sent" without a second table
--      to remember that it did.
--
-- Same pattern as every other table in this schema: RLS on, no insert policy at
-- all, and a SECURITY DEFINER function as the only door. Reading is limited to
-- the analytics allowlist, except for the one narrow case where a person needs
-- to know what they themselves have already asked for.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- The cap
--
-- One number, defined once, in the database rather than in the application.
-- Both the enforcement below and the dashboard that reports on it read this, so
-- there is no way for the figure on screen to drift from the figure being
-- enforced. Changing the limit is a migration, deliberately: it is a commercial
-- decision, not a setting, and the analytics page says so in as many words so
-- nobody goes hunting for a toggle that does not exist.
-- ---------------------------------------------------------------------------
create or replace function agent_run_cap()
returns integer
language sql immutable as $$ select 10 $$;


-- ---------------------------------------------------------------------------
-- 1. agent_runs
--
-- The slug is stored exactly as it was recorded, never normalised on the way
-- in. A tool gets renamed roughly once in its life, and when it does, the
-- honest record of what the thing was called at the time is worth more than a
-- tidy one. Read paths resolve old slugs to current ones through the alias map
-- in src/lib/analytics/aliases.ts, which is where every other "this used to be
-- called something else" problem in this codebase is already solved.
-- ---------------------------------------------------------------------------
create table if not exists agent_runs (
  id              bigserial primary key,
  actor_id        uuid references profiles(id) on delete set null,
  -- Denormalised on purpose: a run that happened is a fact about an address, and
  -- it should survive the profile row being deleted.
  email           text not null,
  feature_slug    text not null,
  organization_id uuid references organizations(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists agent_runs_email_idx   on agent_runs (email, feature_slug);
create index if not exists agent_runs_feature_idx on agent_runs (feature_slug, created_at desc);
create index if not exists agent_runs_org_idx     on agent_runs (organization_id);

comment on table agent_runs is
  'One row per open of a metered tool. A run is exactly that — an open. This '
  'system cannot see inside a tool session, and the analytics pages say so '
  'rather than implying the number measures work done.';

alter table agent_runs enable row level security;

create policy agent_runs_read on agent_runs
  for select using (is_analytics_admin());


-- ---------------------------------------------------------------------------
-- record_agent_run — the only writer, and the cap's only enforcement point
--
-- Returns the outcome rather than raising when somebody is at their limit.
-- Being at a cap is an ordinary, expected state that the calling screen has to
-- render a sensible message for; an exception would make routine behaviour look
-- like a fault in the logs and would cost the caller a try/catch to handle the
-- normal case.
--
-- Counted per feature per account, never as one account-wide total: ten runs of
-- one tool must not exhaust a different tool that has not been touched.
-- ---------------------------------------------------------------------------
create or replace function record_agent_run(p_slug text)
returns table(allowed boolean, used integer, cap integer)
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_slug  text;
  v_cap   integer := agent_run_cap();
  v_used  integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to use this tool';
  end if;

  v_slug := lower(trim(coalesce(p_slug, '')));
  if v_slug = '' then raise exception 'Which tool?'; end if;

  select p.email into v_email from profiles p where p.id = auth.uid();
  if v_email is null then raise exception 'We could not read your profile'; end if;

  -- Serialised per (person, tool) so two tabs opening the same tool at once
  -- cannot both read nine and both write a tenth.
  --
  -- An advisory lock rather than SELECT ... FOR UPDATE, for two reasons: row
  -- locks cannot be taken alongside an aggregate at all (Postgres rejects FOR
  -- UPDATE with count()), and there is nothing to lock on the first run of a
  -- tool anyway, which is exactly when two clicks are most likely to race. The
  -- lock is transaction-scoped, so it is released whether this commits or not.
  perform pg_advisory_xact_lock(hashtext(v_email || ':' || v_slug));

  select count(*) into v_used
    from agent_runs r
    where r.email = v_email and r.feature_slug = v_slug;

  if v_used >= v_cap then
    return query select false, v_used, v_cap;
    return;
  end if;

  insert into agent_runs (actor_id, email, feature_slug, organization_id)
  values (auth.uid(), v_email, v_slug, my_organization_id());

  return query select true, v_used + 1, v_cap;
end $$;


-- ---------------------------------------------------------------------------
-- 2. access_requests — the public form
--
-- No actor column: the whole point is that somebody who has no account can ask
-- for one. The visitor id is kept so a request can be joined back to whatever
-- browsing the person did before submitting it, which is the difference between
-- a name in a list and a name with an intent score attached.
-- ---------------------------------------------------------------------------
create table if not exists access_requests (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  name       text not null,
  email      text not null,
  company    text,
  -- Which of the offered reasons they picked. Free text rather than an enum
  -- because the list of reasons is editorial and changes without a migration.
  interest   text,
  message    text,
  ip         text,
  source     text,
  visitor_id text
);

create index if not exists access_requests_when_idx on access_requests (created_at desc);

alter table access_requests enable row level security;

create policy access_requests_read on access_requests
  for select using (is_analytics_admin());


create or replace function submit_access_request(
  p_name       text,
  p_email      text,
  p_company    text default null,
  p_interest   text default null,
  p_message    text default null,
  p_ip         text default null,
  p_source     text default null,
  p_visitor_id text default null
)
returns access_requests
language plpgsql security definer set search_path = public as $$
declare v_row access_requests; v_email text;
begin
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'Give a valid email address';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Give your name';
  end if;

  insert into access_requests (name, email, company, interest, message, ip, source, visitor_id)
  values (
    trim(p_name), v_email, nullif(trim(coalesce(p_company, '')), ''),
    nullif(trim(coalesce(p_interest, '')), ''), nullif(trim(coalesce(p_message, '')), ''),
    nullif(trim(coalesce(p_ip, '')), ''), nullif(trim(coalesce(p_source, '')), ''),
    nullif(trim(coalesce(p_visitor_id, '')), '')
  )
  returning * into v_row;

  return v_row;
end $$;


-- ---------------------------------------------------------------------------
-- 3. feature_requests
--
-- The unique index is the deduplication. Doing it in the schema rather than in
-- a read-time DISTINCT means the "already asked" state is a fact about one row
-- existing, which is cheap to check and impossible to get wrong.
-- ---------------------------------------------------------------------------
create table if not exists feature_requests (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  actor_id     uuid references profiles(id) on delete set null,
  email        text not null,
  name         text,
  feature_slug text not null,
  reason       text
);

create unique index if not exists feature_requests_once
  on feature_requests (email, feature_slug);

create index if not exists feature_requests_when_idx on feature_requests (created_at desc);

alter table feature_requests enable row level security;

create policy feature_requests_read on feature_requests
  for select using (is_analytics_admin());


create or replace function submit_feature_request(
  p_slug   text,
  p_reason text default null
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_email text; v_name text; v_slug text; v_inserted boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to request a tool';
  end if;

  v_slug := lower(trim(coalesce(p_slug, '')));
  if v_slug = '' then raise exception 'Which tool?'; end if;

  select p.email, p.full_name into v_email, v_name from profiles p where p.id = auth.uid();
  if v_email is null then raise exception 'We could not read your profile'; end if;

  insert into feature_requests (actor_id, email, name, feature_slug, reason)
  values (auth.uid(), v_email, v_name, v_slug, nullif(trim(coalesce(p_reason, '')), ''))
  on conflict (email, feature_slug) do nothing;

  -- False means "you had already asked", which the caller renders as a settled
  -- state rather than an error. It is not a failure and must not read like one.
  v_inserted := found;
  return v_inserted;
end $$;


-- ---------------------------------------------------------------------------
-- requested_features — what I have already asked for
--
-- The one read that is not gated on the analytics allowlist, because it is not
-- analytics: it is what lets a tool's button say "request sent" to the person
-- who sent it. Scoped to the caller's own address and returns nothing else.
-- ---------------------------------------------------------------------------
create or replace function requested_features()
returns setof text
language sql security definer set search_path = public as $$
  select f.feature_slug
    from feature_requests f
    join profiles p on p.id = auth.uid()
   where f.email = p.email
$$;


grant execute on function agent_run_cap()                to authenticated;
grant execute on function record_agent_run(text)         to authenticated;
grant execute on function submit_feature_request(text, text) to authenticated;
grant execute on function requested_features()          to authenticated;

-- The public form is the one thing here a stranger has to be able to call.
grant execute on function submit_access_request(text, text, text, text, text, text, text, text)
  to anon, authenticated;
