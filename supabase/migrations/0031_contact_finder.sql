-- ============================================================================
-- Contact Finder — eight tables: five caches, three records
--
-- The tool searches a third party's contact database. Almost everything here
-- exists to avoid paying for the same answer twice, and the rest exists so a
-- person can see what they collected and what it cost.
--
-- ── Two gates, because the tables answer to two different questions ─────────
--
-- The five caches hold what the vendor said about companies and people. They
-- are shared: what Apollo holds about Acme does not depend on who is asking,
-- and a per-tenant copy would mean paying per tenant for the same row. They are
-- gated on `is_analytics_admin()` — the same platform allowlist the tool itself
-- is behind — and NOT on `auth.uid() is not null`, which is what the shared
-- company registry in 0028 uses. The difference matters: one of these caches
-- holds revealed email addresses and phone numbers, and "anybody with a
-- session" is not a list that should be able to read those.
--
-- The three records are per person: what you searched, what you collected, what
-- you spent. Those are scoped by `user_id = auth.uid()` and stay yours whatever
-- happens to the allowlist afterwards.
--
-- ── Retention is a privacy control, not a size control ──────────────────────
--
-- finder_search_history and finder_list_rows can hold revealed contact details,
-- so both expire at 90 days. Crucially the sweep runs on READ and covers EVERY
-- user, not only the reader. Pruning on write covers only the person writing,
-- which made ninety days conditional on continued use: somebody who stopped
-- using the tool kept their revealed contacts indefinitely, because nothing
-- they did triggered their own cleanup. Now any use of the tool by anyone
-- retires everyone's expired rows. It is cheap, because the table is capped at
-- 60 entries per person.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Learned vocabulary. Two tables, one idea.
--
-- Apollo has no endpoint that enumerates its industries or its technology
-- names, so the pickers are seeded from a file. These tables hold what Apollo
-- has actually been seen to return, which is correct by construction: Apollo
-- said it. They are merged over the seed at read time, so if Apollo renames,
-- adds or retires a value the picker follows with no deploy, and a seeded value
-- that never turns up in real data is visibly never confirmed.
--
-- NAICS and SIC are deliberately absent. The free people search does not return
-- those fields, so there is nothing to learn from and those two pickers stay
-- seed-only. A limitation of the plan, not an oversight.
-- ---------------------------------------------------------------------------
create table if not exists finder_industry_seen (
  value      text primary key,
  hits       integer not null default 1,
  last_seen  timestamptz not null default now()
);

comment on table finder_industry_seen is
  'Industry strings Apollo has actually returned. Merged over the seeded '
  'taxonomy at read time so the picker only ever offers values Apollo uses.';

create table if not exists finder_vocab_seen (
  kind       text not null check (kind in ('technology', 'location')),
  value      text not null,
  hits       integer not null default 1,
  last_seen  timestamptz not null default now(),
  primary key (kind, value)
);

comment on table finder_vocab_seen is
  'Technology and place strings Apollo has actually returned. Locations are '
  'recorded at all three levels the picker offers: country, "State, Country" '
  'and "City, State".';


-- ---------------------------------------------------------------------------
-- finder_org_firmo — employer firmographics, 30 days.
--
-- The big one, and the reason a page of people can be rich without being
-- expensive. Apollo's free people search returns seven fields per person and
-- almost nothing about the employer. Every API that hands company data over is
-- paid — but the company search bills per CALL, not per company, so one request
-- filtered to a page's distinct organisation ids describes all of them for a
-- single credit. Cached here for 30 days, most pages then spend nothing.
--
-- Positive-only, and that is a rule across every cache in this tool: a company
-- search that returns nothing costs zero credits, so there is no credit to save
-- by caching a miss, only staleness to risk.
-- ---------------------------------------------------------------------------
create table if not exists finder_org_firmo (
  org_id      text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

comment on table finder_org_firmo is
  'Apollo firmographics keyed by organisation id, 30-day TTL enforced by the '
  'reader. Positive results only: a miss costs nothing, so caching one buys '
  'nothing and risks staleness.';


-- ---------------------------------------------------------------------------
-- finder_person_enrichment — revealed people, 90 days.
--
-- Holds RAW Apollo person records, not the normalised profile shape, which is
-- why it carries its own shape stamp. A version stamp guarding a cache must be
-- written by the same code path that reads it: this cache once checked for a
-- stamp that a different function applied and that therefore was never present
-- here, so every cached row failed the gate, the cache returned nothing ever,
-- and bulk enrich re-bought people it had already paid for while honestly
-- reporting "cached: 0".
--
-- This is the table that makes the allowlist gate above necessary rather than
-- tidy: these rows can contain email addresses and phone numbers.
-- ---------------------------------------------------------------------------
create table if not exists finder_person_enrichment (
  apollo_id   text primary key,
  payload     jsonb not null,
  -- The shape this row was written in. Bumped when the stored shape changes,
  -- so a reader can ignore rows it would misread rather than misreading them.
  shape       integer not null default 1,
  updated_at  timestamptz not null default now()
);

comment on table finder_person_enrichment is
  'Raw Apollo person records that a credit has already been spent on, 90-day '
  'TTL. Can hold revealed emails and phone numbers, which is why every policy '
  'on it checks the platform allowlist rather than merely a session.';


-- ---------------------------------------------------------------------------
-- finder_org_resolve — a typed company name to an Apollo organisation, 24h.
--
-- Made durable rather than left in memory for one specific reason: the process
-- restarts on every deploy, so an in-memory tier was blind to its own point —
-- the first question about a company after a deploy always re-paid.
--
-- One resolution is written under several keys: the query that was searched,
-- the resolved organisation's own domain, and its normalised name. A later
-- question naming the same company a different way then still hits.
-- ---------------------------------------------------------------------------
create table if not exists finder_org_resolve (
  cache_key   text primary key,
  org         jsonb,
  choices     jsonb,
  updated_at  timestamptz not null default now()
);

comment on table finder_org_resolve is
  'Company-name and domain resolutions, 24-hour TTL. Written under every alias '
  'key a later question might arrive by.';


-- ---------------------------------------------------------------------------
-- The three per-person records.
-- ---------------------------------------------------------------------------
create table if not exists finder_search_history (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- people | companies | chat | contact | company_profile | revealed
  entity      text not null,
  label       text,
  filters     jsonb not null default '{}'::jsonb,
  total       integer,
  rows        jsonb not null default '[]'::jsonb,
  -- Chat entries carry prose rather than rows.
  answer      text,
  credits     integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists finder_history_user_idx
  on finder_search_history (user_id, created_at desc);

comment on table finder_search_history is
  'Searches, answers and enriched contacts, per person, 90-day TTL. Reopening '
  'an entry costs nothing, which is the point: it is how a paid reveal is not '
  'paid for twice.';

create table if not exists finder_list_rows (
  user_id     uuid not null references auth.users(id) on delete cascade,
  entity      text not null,
  dedupe_key  text not null,
  row         jsonb not null,
  added_at    timestamptz not null default now(),
  primary key (user_id, entity, dedupe_key)
);

create index if not exists finder_list_user_idx
  on finder_list_rows (user_id, added_at desc);

comment on table finder_list_rows is
  'The working list: rows kept across searches and tabs, capped at 500 per '
  'person, 90-day TTL.';

create table if not exists finder_credit_ledger (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- search-people | search-companies | company-resolve | enrich | enrich-bulk | chat
  action      text not null,
  credits     integer not null,
  created_at  timestamptz not null default now()
);

create index if not exists finder_ledger_at_idx
  on finder_credit_ledger (created_at desc);

-- Deliberately not called a balance. No endpoint reachable with this key
-- reports the account total, and the same key funds other features, so a number
-- called "remaining" would be a guess. This records what THIS tool spent, which
-- it knows exactly.
comment on table finder_credit_ledger is
  'What Contact Finder spent, per person. Not a balance: the vendor exposes no '
  'account total to this key, so a "remaining" figure would be invented.';


-- ---------------------------------------------------------------------------
-- Row-level security. Shared caches answer to the allowlist; personal records
-- answer to the person.
-- ---------------------------------------------------------------------------
alter table finder_industry_seen     enable row level security;
alter table finder_vocab_seen        enable row level security;
alter table finder_org_firmo         enable row level security;
alter table finder_person_enrichment enable row level security;
alter table finder_org_resolve       enable row level security;
alter table finder_search_history    enable row level security;
alter table finder_list_rows         enable row level security;
alter table finder_credit_ledger     enable row level security;

drop policy if exists finder_industry_seen_read on finder_industry_seen;
create policy finder_industry_seen_read on finder_industry_seen
  for select using (is_analytics_admin());

drop policy if exists finder_vocab_seen_read on finder_vocab_seen;
create policy finder_vocab_seen_read on finder_vocab_seen
  for select using (is_analytics_admin());

drop policy if exists finder_org_firmo_read on finder_org_firmo;
create policy finder_org_firmo_read on finder_org_firmo
  for select using (is_analytics_admin());

drop policy if exists finder_person_enrichment_read on finder_person_enrichment;
create policy finder_person_enrichment_read on finder_person_enrichment
  for select using (is_analytics_admin());

drop policy if exists finder_org_resolve_read on finder_org_resolve;
create policy finder_org_resolve_read on finder_org_resolve
  for select using (is_analytics_admin());

-- Authorisation in the WHERE clause, never fetch-then-check in the
-- application: a guessed id belonging to somebody else matches no row at all.
drop policy if exists finder_history_read on finder_search_history;
create policy finder_history_read on finder_search_history
  for select using (user_id = auth.uid());

drop policy if exists finder_history_delete on finder_search_history;
create policy finder_history_delete on finder_search_history
  for delete using (user_id = auth.uid());

drop policy if exists finder_list_read on finder_list_rows;
create policy finder_list_read on finder_list_rows
  for select using (user_id = auth.uid());

drop policy if exists finder_list_delete on finder_list_rows;
create policy finder_list_delete on finder_list_rows
  for delete using (user_id = auth.uid());

drop policy if exists finder_ledger_read on finder_credit_ledger;
create policy finder_ledger_read on finder_credit_ledger
  for select using (user_id = auth.uid());

-- Every insert and update goes through a function below, so that identity comes
-- from auth.uid() and the caps are enforced in the same transaction as the
-- write rather than by a client that might not.
revoke insert, update, delete on finder_industry_seen     from authenticated;
revoke insert, update, delete on finder_vocab_seen        from authenticated;
revoke insert, update, delete on finder_org_firmo         from authenticated;
revoke insert, update, delete on finder_person_enrichment from authenticated;
revoke insert, update, delete on finder_org_resolve       from authenticated;
revoke insert, update           on finder_search_history  from authenticated;
revoke insert, update           on finder_list_rows       from authenticated;
revoke insert, update, delete on finder_credit_ledger     from authenticated;


-- ---------------------------------------------------------------------------
-- finder_learn_industries / finder_learn_vocab
--
-- p = {"values": ["hospital & health care", ...]}
-- p = {"values": [{"kind":"technology","value":"Google Analytics"}, ...]}
--
-- Write-throttled by the caller rather than here: a page of 100 companies can
-- carry over a thousand technology names, and the first search after a deploy
-- would otherwise do a thousand inserts inside one request. Whatever is left
-- arrives on the next search. This only fills a dropdown, so it has all the
-- time in the world.
-- ---------------------------------------------------------------------------
create or replace function finder_learn_industries(p jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not is_analytics_admin() then
    raise exception 'Only a platform admin can record Contact Finder vocabulary.';
  end if;

  with incoming as (
    select distinct left(btrim(value), 80) as value
      from jsonb_array_elements_text(coalesce(p -> 'values', '[]'::jsonb)) as t(value)
     where btrim(value) <> ''
  ), written as (
    insert into finder_industry_seen (value)
    select value from incoming
    on conflict (value) do update
      set hits = finder_industry_seen.hits + 1, last_seen = now()
    returning 1
  )
  select count(*) into v_n from written;

  return v_n;
end $$;

grant execute on function finder_learn_industries(jsonb) to authenticated;

create or replace function finder_learn_vocab(p jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not is_analytics_admin() then
    raise exception 'Only a platform admin can record Contact Finder vocabulary.';
  end if;

  with incoming as (
    select distinct
           e ->> 'kind'              as kind,
           left(btrim(e ->> 'value'), 120) as value
      from jsonb_array_elements(coalesce(p -> 'values', '[]'::jsonb)) as e
     where e ->> 'kind' in ('technology', 'location')
       and btrim(coalesce(e ->> 'value', '')) <> ''
  ), written as (
    insert into finder_vocab_seen (kind, value)
    select kind, value from incoming
    on conflict (kind, value) do update
      set hits = finder_vocab_seen.hits + 1, last_seen = now()
    returning 1
  )
  select count(*) into v_n from written;

  return v_n;
end $$;

grant execute on function finder_learn_vocab(jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- The three caches, written the same way.
--
-- p = {"rows": [{"org_id": "...", "payload": {...}}, ...]}
-- p = {"rows": [{"apollo_id": "...", "payload": {...}}, ...]}
-- p = {"keys": ["d:acme.com", "n:acme"], "org": {...}, "choices": [...]}
-- ---------------------------------------------------------------------------
create or replace function finder_cache_org_firmo(p jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not is_analytics_admin() then
    raise exception 'Only a platform admin can write the Contact Finder cache.';
  end if;

  with written as (
    insert into finder_org_firmo (org_id, payload)
    select e ->> 'org_id', e -> 'payload'
      from jsonb_array_elements(coalesce(p -> 'rows', '[]'::jsonb)) as e
     where coalesce(e ->> 'org_id', '') <> ''
       and jsonb_typeof(e -> 'payload') = 'object'
    on conflict (org_id) do update
      set payload = excluded.payload, updated_at = now()
    returning 1
  )
  select count(*) into v_n from written;

  return v_n;
end $$;

grant execute on function finder_cache_org_firmo(jsonb) to authenticated;

create or replace function finder_cache_person(p jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not is_analytics_admin() then
    raise exception 'Only a platform admin can write the Contact Finder cache.';
  end if;

  with written as (
    insert into finder_person_enrichment (apollo_id, payload, shape)
    select e ->> 'apollo_id', e -> 'payload', coalesce((e ->> 'shape')::integer, 1)
      from jsonb_array_elements(coalesce(p -> 'rows', '[]'::jsonb)) as e
     where coalesce(e ->> 'apollo_id', '') <> ''
       and jsonb_typeof(e -> 'payload') = 'object'
    on conflict (apollo_id) do update
      set payload = excluded.payload, shape = excluded.shape, updated_at = now()
    returning 1
  )
  select count(*) into v_n from written;

  return v_n;
end $$;

grant execute on function finder_cache_person(jsonb) to authenticated;

create or replace function finder_cache_org_resolve(p jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not is_analytics_admin() then
    raise exception 'Only a platform admin can write the Contact Finder cache.';
  end if;

  with written as (
    insert into finder_org_resolve (cache_key, org, choices)
    select distinct btrim(k), p -> 'org', p -> 'choices'
      from jsonb_array_elements_text(coalesce(p -> 'keys', '[]'::jsonb)) as t(k)
     where btrim(k) <> ''
    on conflict (cache_key) do update
      set org = excluded.org, choices = excluded.choices, updated_at = now()
    returning 1
  )
  select count(*) into v_n from written;

  return v_n;
end $$;

grant execute on function finder_cache_org_resolve(jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- finder_expire — the read-side sweep, for everybody.
--
-- Called whenever the history or the working list is opened, by whoever opens
-- it. See the header: pruning only on write made retention conditional on
-- continued use, which is the one thing a privacy control must not be.
-- ---------------------------------------------------------------------------
create or replace function finder_expire()
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from finder_search_history where created_at < now() - interval '90 days';
  delete from finder_list_rows       where added_at   < now() - interval '90 days';
  delete from finder_credit_ledger   where created_at < now() - interval '400 days';
end $$;

comment on function finder_expire() is
  'Retires expired rows for EVERY user, not only the caller. Cheap, because '
  'the tables are capped per person.';

grant execute on function finder_expire() to authenticated;


-- ---------------------------------------------------------------------------
-- finder_save_history
--
-- p = {"entity", "label", "filters", "total", "rows", "answer", "credits",
--      "replace_id"}
--
-- `replace_id` is how "Load more" GROWS the entry it already owns rather than
-- writing a second near-identical row. Without it, paging three deep wrote
-- three entries holding 24, 48 and 72 rows and evicted real history against the
-- 60-entry cap. Credits are ADDED on a replace rather than overwritten, because
-- the second page cost what it cost.
-- ---------------------------------------------------------------------------
create or replace function finder_save_history(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id      bigint;
  v_user    uuid := auth.uid();
  v_rows    jsonb;
  v_credits integer := coalesce((p ->> 'credits')::integer, 0);
begin
  if v_user is null then
    raise exception 'You are not signed in.';
  end if;

  -- Capped here rather than trusted from the client: this is the row a reader
  -- reopens, and an unbounded array is how one search fills the table.
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_rows
    from (
      select e from jsonb_array_elements(coalesce(p -> 'rows', '[]'::jsonb)) as e
      limit 120
    ) capped;

  if coalesce((p ->> 'replace_id')::bigint, 0) > 0 then
    update finder_search_history
       set rows    = v_rows,
           total   = coalesce((p ->> 'total')::integer, total),
           label   = coalesce(left(p ->> 'label', 160), label),
           answer  = coalesce(left(p ->> 'answer', 8000), answer),
           filters = coalesce(p -> 'filters', filters),
           credits = credits + v_credits
     where id = (p ->> 'replace_id')::bigint
       and user_id = v_user
    returning id into v_id;
  end if;

  if v_id is null then
    insert into finder_search_history (
      user_id, entity, label, filters, total, rows, answer, credits
    ) values (
      v_user,
      coalesce(p ->> 'entity', 'people'),
      left(p ->> 'label', 160),
      coalesce(p -> 'filters', '{}'::jsonb),
      (p ->> 'total')::integer,
      v_rows,
      left(p ->> 'answer', 8000),
      v_credits
    )
    returning id into v_id;
  end if;

  -- Newest 60 kept, the rest retired, in the same transaction as the insert.
  delete from finder_search_history
   where user_id = v_user
     and id not in (
       select id from finder_search_history
        where user_id = v_user
        order by created_at desc
        limit 60
     );

  return v_id;
end $$;

grant execute on function finder_save_history(jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- finder_list_add
--
-- p = {"entity": "people", "rows": [{"dedupe_key": "...", "row": {...}}, ...]}
--
-- ON CONFLICT DO NOTHING, deliberately not DO UPDATE: a row already on the list
-- may have been enriched since, and overwriting it with the un-enriched search
-- row would throw away a reveal somebody paid for.
--
-- The 500 cap is enforced by the prune at the end rather than by the count at
-- the start. The pre-check is a plain check-then-act, so two concurrent posts
-- from the same person can each read the same count and each insert up to their
-- own room; the prune runs in the same transaction and holds the cap
-- regardless. The pre-check exists only to answer "full" honestly in the common
-- case where nothing is racing.
-- ---------------------------------------------------------------------------
create or replace function finder_list_add(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_entity text := coalesce(p ->> 'entity', 'people');
  v_room   integer;
  v_added  integer;
  v_count  integer;
begin
  if v_user is null then
    raise exception 'You are not signed in.';
  end if;

  select 500 - count(*) into v_room from finder_list_rows where user_id = v_user;

  with incoming as (
    select e ->> 'dedupe_key' as dedupe_key, e -> 'row' as row
      from jsonb_array_elements(coalesce(p -> 'rows', '[]'::jsonb)) as e
     where coalesce(e ->> 'dedupe_key', '') <> ''
       and jsonb_typeof(e -> 'row') = 'object'
     limit greatest(v_room, 0)
  ), written as (
    insert into finder_list_rows (user_id, entity, dedupe_key, row)
    select v_user, v_entity, dedupe_key, row from incoming
    on conflict (user_id, entity, dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_added from written;

  delete from finder_list_rows
   where user_id = v_user
     and (entity, dedupe_key) not in (
       select entity, dedupe_key from finder_list_rows
        where user_id = v_user
        order by added_at desc
        limit 500
     );

  select count(*) into v_count from finder_list_rows where user_id = v_user;

  return jsonb_build_object('added', v_added, 'count', v_count, 'full', v_count >= 500);
end $$;

grant execute on function finder_list_add(jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- finder_record_credits
--
-- p = {"action": "search-companies", "credits": 1}
--
-- A zero is never written. A cache hit is not a purchase, and rows of zeroes
-- would make the ledger read as activity rather than as spend.
-- ---------------------------------------------------------------------------
create or replace function finder_record_credits(p jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid := auth.uid();
  v_credits integer := coalesce((p ->> 'credits')::integer, 0);
begin
  if v_user is null or v_credits <= 0 then
    return;
  end if;

  insert into finder_credit_ledger (user_id, action, credits)
  values (v_user, left(coalesce(p ->> 'action', 'unknown'), 40), v_credits);
end $$;

grant execute on function finder_record_credits(jsonb) to authenticated;


-- ============================================================================
-- Verification — run these after applying, and read the answers.
--
--   -- 1. All eight tables exist and every one has RLS on.
--   select tablename, rowsecurity from pg_tables
--    where tablename like 'finder\_%' order by tablename;      -- expect 8, all t
--
--   -- 2. The shared caches check the allowlist; the personal ones check you.
--   select tablename, policyname, cmd, qual from pg_policies
--    where tablename like 'finder\_%' order by tablename, policyname;
--
--   -- 3. Nobody may write these tables directly.
--   select table_name, privilege_type from information_schema.role_table_grants
--    where grantee = 'authenticated' and table_name like 'finder\_%'
--      and privilege_type in ('INSERT','UPDATE')
--    order by table_name;                                       -- expect 0 rows
--
--   -- 4. The nine functions exist.
--   select proname from pg_proc where proname like 'finder\_%' order by proname;
--
--   -- 5. Round-trip the history cap, rolled back so it leaves nothing behind.
--   --    Expect 60, not 65.
--   begin;
--     select finder_save_history(jsonb_build_object(
--              'entity','people','label','cap check ' || g,
--              'rows', '[]'::jsonb))
--       from generate_series(1, 65) as g;
--     select count(*) from finder_search_history where user_id = auth.uid();
--   rollback;
-- ============================================================================
