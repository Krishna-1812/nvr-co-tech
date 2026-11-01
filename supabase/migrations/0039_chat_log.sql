-- ============================================================================
-- The chat, recorded: every question, every answer, and whose they were
--
-- The owner asked (29 Oct 2026) for the analytics to record everything,
-- including which visitor asked the chat what and what it answered, and for
-- all of a visitor's earlier activity to be put under their name once they
-- sign in. They were told this reverses what the chat and the Privacy page
-- said ("keeps nothing", "lives in this tab only"); the public wording is
-- changed in the same release so the site says what it does.
--
-- ── site_chats ──────────────────────────────────────────────────────────────
-- One row per question: what was asked, the answer as it was streamed back,
-- the pages it leaned on, the calculations it ran, how it ended (answered,
-- stopped by the reader, failed, refused, rate limited), how long the first
-- word and the whole answer took, the model, the page it was asked on and how
-- it was asked (typed, a suggestion, the greeting). `conversation` is the
-- browser's own id for one chat, so the Admin screen can show a thread.
-- `mode` says which assistant answered: the public one or the signed-in one.
-- Written by the server (app/api/chat, app/api/assist) once the answer has
-- finished, never by the browser, so the answer stored is the answer sent.
--
-- ── Putting it under a name ─────────────────────────────────────────────────
-- 0033 already moved a browser's earlier page views under the account on its
-- first signed-in page. `claim_visitor()` now does the same for everything
-- else that browser did: its form fields and clicks, its tool work and its
-- chats. Every writer calls it whenever the session is signed in, and the end
-- of this file runs it once over what is already stored.
--
-- ── 0036, if it never ran ───────────────────────────────────────────────────
-- The form-and-click capture (0036) was written on 18 Oct and is not recorded
-- as applied. Its tables and writer are repeated here, guarded, so this one
-- file is enough on its own, whether or not 0036 ran.
--
-- ── Who writes and reads ────────────────────────────────────────────────────
-- As before: SECURITY DEFINER writers open to the anonymous key, the account
-- always taken from auth.uid() and never from the caller, reading for
-- is_analytics_admin() only. Everything hangs off site_visitors, so removing
-- a visitor removes their chats too, and reset_site_analytics() empties them.
--
-- Re-runnable.
-- ============================================================================

-- ── 0036's tables, if missing ───────────────────────────────────────────────

create table if not exists site_tool_data (
  visitor_id  uuid        not null references site_visitors (id) on delete cascade,
  tool        text        not null check (tool in ('wealth-tracker', 'true-property-cost')),
  user_id     uuid        references auth.users (id) on delete set null,
  body        text        not null check (length(body) <= 2000000),
  sealed      boolean     not null default false,
  first_at    timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  saves       integer     not null default 1,
  primary key (visitor_id, tool)
);

create index if not exists site_tool_data_updated on site_tool_data (updated_at desc);

create table if not exists site_events (
  id          bigint      generated always as identity primary key,
  visitor_id  uuid        not null references site_visitors (id) on delete cascade,
  user_id     uuid        references auth.users (id) on delete set null,
  session_id  text,
  path        text        not null,
  kind        text        not null check (kind in ('field', 'click')),
  label       text,
  value       text,
  at          timestamptz not null default now()
);

create index if not exists site_events_at on site_events (at desc);
create index if not exists site_events_visitor on site_events (visitor_id);

alter table site_tool_data enable row level security;
alter table site_events    enable row level security;

drop policy if exists site_tool_data_admin_read on site_tool_data;
create policy site_tool_data_admin_read on site_tool_data for select using (is_analytics_admin());

drop policy if exists site_events_admin_read on site_events;
create policy site_events_admin_read on site_events for select using (is_analytics_admin());

revoke insert, update, delete on site_tool_data from anon, authenticated;
revoke insert, update, delete on site_events    from anon, authenticated;
grant select on site_tool_data, site_events to authenticated;

-- ── The chat log ────────────────────────────────────────────────────────────

create table if not exists site_chats (
  id            uuid        primary key,
  visitor_id    uuid        references site_visitors (id) on delete cascade,
  user_id       uuid        references auth.users (id) on delete set null,
  session_id    text,
  conversation  text,
  mode          text        not null check (mode in ('visitor', 'member')),
  path          text,
  via           text,
  question      text        not null,
  answer        text,
  sources       jsonb       not null default '[]'::jsonb,
  tools         jsonb       not null default '[]'::jsonb,
  outcome       text        not null check (outcome in ('answered', 'stopped', 'error', 'offline', 'refused', 'limited', 'unavailable')),
  error         text,
  model         text,
  first_ms      integer     check (first_ms >= 0),
  total_ms      integer     check (total_ms >= 0),
  at            timestamptz not null default now()
);

create index if not exists site_chats_at on site_chats (at desc);
create index if not exists site_chats_visitor on site_chats (visitor_id);
create index if not exists site_chats_user on site_chats (user_id);
create index if not exists site_chats_conversation on site_chats (conversation);

alter table site_chats enable row level security;

drop policy if exists site_chats_admin_read on site_chats;
create policy site_chats_admin_read on site_chats for select using (is_analytics_admin());

revoke insert, update, delete on site_chats from anon, authenticated;
grant select on site_chats to authenticated;

-- ── Everything a browser did, put under the account it signed in to ─────────

create or replace function claim_visitor(v_vid uuid, v_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if v_vid is null or v_uid is null then return; end if;
  update site_visitors  set user_id = v_uid where id = v_vid and user_id is null;
  update site_views     set user_id = v_uid where visitor_id = v_vid and user_id is null;
  update site_events    set user_id = v_uid where visitor_id = v_vid and user_id is null;
  update site_tool_data set user_id = v_uid where visitor_id = v_vid and user_id is null;
  update site_chats     set user_id = v_uid where visitor_id = v_vid and user_id is null;
end;
$$;

-- Only the writers below call it; nobody may call it directly.
revoke all on function claim_visitor(uuid, uuid) from public, anon, authenticated;

-- ── The writers, now claiming as they go ────────────────────────────────────

create or replace function track_hit(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_vid  uuid;
  v_view uuid;
  v_uid  uuid := auth.uid();
begin
  begin
    v_vid := (p ->> 'vid')::uuid;
    v_view := nullif(p ->> 'view_id', '')::uuid;
  exception when others then
    return;
  end;
  if v_vid is null then return; end if;

  insert into site_visitors as s (
    id, first_path, first_referrer, utm_source, utm_medium, utm_campaign,
    browser, os, device, screen, language, timezone, country, region, city, ip, user_agent,
    user_id, email
  ) values (
    v_vid,
    analytics_text(p ->> 'path', 500), analytics_text(p ->> 'referrer', 500),
    analytics_text(p ->> 'utm_source', 120), analytics_text(p ->> 'utm_medium', 120), analytics_text(p ->> 'utm_campaign', 120),
    analytics_text(p ->> 'browser', 60), analytics_text(p ->> 'os', 60), analytics_text(p ->> 'device', 20),
    analytics_text(p ->> 'screen', 20), analytics_text(p ->> 'language', 40), analytics_text(p ->> 'timezone', 60),
    analytics_text(p ->> 'country', 8), analytics_text(p ->> 'region', 80), analytics_text(p ->> 'city', 120),
    analytics_text(p ->> 'ip', 60), analytics_text(p ->> 'user_agent', 400),
    v_uid, case when v_uid is not null then auth.jwt() ->> 'email' end
  )
  on conflict (id) do update set
    last_seen  = now(),
    browser    = coalesce(excluded.browser, s.browser),
    os         = coalesce(excluded.os, s.os),
    device     = coalesce(excluded.device, s.device),
    screen     = coalesce(excluded.screen, s.screen),
    language   = coalesce(excluded.language, s.language),
    timezone   = coalesce(excluded.timezone, s.timezone),
    country    = coalesce(excluded.country, s.country),
    region     = coalesce(excluded.region, s.region),
    city       = coalesce(excluded.city, s.city),
    ip         = coalesce(excluded.ip, s.ip),
    user_agent = coalesce(excluded.user_agent, s.user_agent),
    user_id    = coalesce(excluded.user_id, s.user_id),
    email      = coalesce(excluded.email, s.email);

  -- Signed in: everything this browser did before belongs to the account now.
  if v_uid is not null then
    perform claim_visitor(v_vid, v_uid);
  end if;

  if p ->> 'type' = 'view' and v_view is not null then
    insert into site_views (id, visitor_id, session_id, user_id, path, title, referrer)
    values (
      v_view, v_vid, analytics_text(p ->> 'sid', 64), v_uid,
      coalesce(analytics_text(p ->> 'path', 500), '/'),
      analytics_text(p ->> 'title', 200), analytics_text(p ->> 'referrer', 500)
    )
    on conflict (id) do nothing;
  elsif p ->> 'type' = 'time' and v_view is not null then
    -- Time only ever grows, and one view is capped at six hours.
    update site_views
       set seconds = greatest(seconds, least(coalesce((p ->> 'seconds')::integer, 0), 21600))
     where id = v_view and visitor_id = v_vid;
  end if;
exception when others then
  -- Measurement must never be why a page fails.
  return;
end;
$$;

revoke all on function track_hit(jsonb) from public;
grant execute on function track_hit(jsonb) to anon, authenticated;

create or replace function track_input(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_vid  uuid;
  v_uid  uuid := auth.uid();
  v_body text;
  v_at   timestamptz;
  e      jsonb;
  n      integer := 0;
begin
  begin
    v_vid := (p ->> 'vid')::uuid;
  exception when others then
    return;
  end;
  if v_vid is null then return; end if;

  -- The page view normally arrives first; if this beats it, the visitor row
  -- is started here and track_hit fills in the rest.
  insert into site_visitors (id, user_id, email)
  values (v_vid, v_uid, case when v_uid is not null then auth.jwt() ->> 'email' end)
  on conflict (id) do update set
    last_seen = now(),
    user_id   = coalesce(excluded.user_id, site_visitors.user_id),
    email     = coalesce(excluded.email, site_visitors.email);

  if v_uid is not null then perform claim_visitor(v_vid, v_uid); end if;

  if p ->> 'type' = 'tool' then
    v_body := p ->> 'body';
    if v_body is null or length(v_body) > 2000000 or (p ->> 'tool') is null or (p ->> 'tool') not in ('wealth-tracker', 'true-property-cost') then
      return;
    end if;
    insert into site_tool_data as d (visitor_id, tool, user_id, body, sealed)
    values (v_vid, p ->> 'tool', v_uid, v_body, coalesce((p ->> 'sealed')::boolean, false))
    on conflict (visitor_id, tool) do update set
      body       = excluded.body,
      sealed     = excluded.sealed,
      user_id    = coalesce(excluded.user_id, d.user_id),
      updated_at = now(),
      saves      = d.saves + 1;
  elsif p ->> 'type' = 'events' and jsonb_typeof(p -> 'events') = 'array' then
    for e in select * from jsonb_array_elements(p -> 'events') loop
      n := n + 1;
      exit when n > 100;
      if (e ->> 'kind') is null or (e ->> 'kind') not in ('field', 'click') then continue; end if;
      -- The browser's clock, within a day of ours, so a batch keeps its order.
      begin
        v_at := (e ->> 'at')::timestamptz;
      exception when others then
        v_at := null;
      end;
      if v_at is null or v_at not between now() - interval '1 day' and now() + interval '5 minutes' then
        v_at := now();
      end if;
      insert into site_events (visitor_id, user_id, session_id, path, kind, label, value, at)
      values (
        v_vid, v_uid, analytics_text(p ->> 'sid', 64),
        coalesce(analytics_text(e ->> 'path', 500), '/'),
        e ->> 'kind',
        analytics_text(e ->> 'label', 200),
        analytics_text(e ->> 'value', 4000),
        v_at
      );
    end loop;
  end if;
exception when others then
  -- Measurement must never be why a page fails.
  return;
end;
$$;

revoke all on function track_input(jsonb) from public;
grant execute on function track_input(jsonb) to anon, authenticated;

create or replace function track_chat(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_vid  uuid;
  v_uid  uuid := auth.uid();
  v_q    text;
begin
  begin
    v_id  := (p ->> 'id')::uuid;
    v_vid := nullif(p ->> 'vid', '')::uuid;
  exception when others then
    return;
  end;
  v_q := analytics_text(p ->> 'question', 4000);
  if v_id is null or v_q is null then return; end if;
  -- A chat with nobody to file it under is not kept.
  if v_vid is null and v_uid is null then return; end if;

  if v_vid is not null then
    insert into site_visitors (id, user_id, email)
    values (v_vid, v_uid, case when v_uid is not null then auth.jwt() ->> 'email' end)
    on conflict (id) do update set
      last_seen = now(),
      user_id   = coalesce(excluded.user_id, site_visitors.user_id),
      email     = coalesce(excluded.email, site_visitors.email);
    if v_uid is not null then perform claim_visitor(v_vid, v_uid); end if;
  end if;

  insert into site_chats (
    id, visitor_id, user_id, session_id, conversation, mode, path, via,
    question, answer, sources, tools, outcome, error, model, first_ms, total_ms
  ) values (
    v_id, v_vid, v_uid,
    analytics_text(p ->> 'sid', 64),
    analytics_text(p ->> 'conversation', 80),
    case when p ->> 'mode' = 'member' then 'member' else 'visitor' end,
    analytics_text(p ->> 'path', 500),
    analytics_text(p ->> 'via', 40),
    v_q,
    left(p ->> 'answer', 40000),
    case when jsonb_typeof(p -> 'sources') = 'array' then p -> 'sources' else '[]'::jsonb end,
    case when jsonb_typeof(p -> 'tools') = 'array' then p -> 'tools' else '[]'::jsonb end,
    case when p ->> 'outcome' in ('answered', 'stopped', 'error', 'offline', 'refused', 'limited', 'unavailable')
         then p ->> 'outcome' else 'answered' end,
    analytics_text(p ->> 'error', 500),
    analytics_text(p ->> 'model', 80),
    least(greatest(coalesce((p ->> 'first_ms')::integer, 0), 0), 3600000),
    least(greatest(coalesce((p ->> 'total_ms')::integer, 0), 0), 3600000)
  )
  on conflict (id) do nothing;
exception when others then
  -- Recording must never be why an answer fails.
  return;
end;
$$;

revoke all on function track_chat(jsonb) from public;
grant execute on function track_chat(jsonb) to anon, authenticated;

-- ── Clearing the visit data clears the chats too ─────────────────────────────

create or replace function reset_site_analytics() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_analytics_admin() then raise exception 'Only an admin can clear the visit data'; end if;
  truncate table site_chats, site_events, site_tool_data, site_views, site_visitors;
end;
$$;

revoke all on function reset_site_analytics() from public;
grant execute on function reset_site_analytics() to authenticated;

-- ── Everything known about an account ───────────────────────────────────────
-- 0033's list, with the rest of what the site holds about a person: their
-- photo, organisation and role, phone and when their address was confirmed.
-- The return type grows, so the old function is dropped first.

drop function if exists admin_accounts();

create function admin_accounts()
returns table (
  id uuid, email text, full_name text, created_at timestamptz,
  last_sign_in_at timestamptz, provider text,
  avatar_url text, organization text, role text, phone text, confirmed_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text, coalesce(pr.full_name, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
         u.created_at, u.last_sign_in_at,
         coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
         coalesce(pr.avatar_url, u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture'),
         o.name, pr.role::text, nullif(u.phone::text, ''), u.email_confirmed_at
    from auth.users u
    left join profiles pr on pr.id = u.id
    left join organizations o on o.id = pr.organization_id
   where is_analytics_admin()
   order by u.created_at desc;
$$;

revoke all on function admin_accounts() from public;
grant execute on function admin_accounts() to authenticated;

-- ── Once, over what is already stored ───────────────────────────────────────
-- Browsers that have signed in at some point: everything they did before,
-- under the account.

update site_views w     set user_id = v.user_id from site_visitors v where w.visitor_id = v.id and w.user_id is null and v.user_id is not null;
update site_events e    set user_id = v.user_id from site_visitors v where e.visitor_id = v.id and e.user_id is null and v.user_id is not null;
update site_tool_data d set user_id = v.user_id from site_visitors v where d.visitor_id = v.id and d.user_id is null and v.user_id is not null;
update site_chats c     set user_id = v.user_id from site_visitors v where c.visitor_id = v.id and c.user_id is null and v.user_id is not null;

-- ── To check it ran ─────────────────────────────────────────────────────────
-- select to_regclass('site_chats'), to_regclass('site_events'), to_regclass('site_tool_data'),
--        to_regprocedure('track_chat(jsonb)'), to_regprocedure('claim_visitor(uuid,uuid)');
-- Expect five non-null values.
