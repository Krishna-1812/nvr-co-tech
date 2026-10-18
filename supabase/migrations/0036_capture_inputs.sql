-- ============================================================================
-- What people enter: the two open tools' work, and every form and click
--
-- The owner asked (18 Oct 2026) for the Admin screen to show everything a
-- visitor does, not only the pages they open: which tool they used and what
-- they filled in. They were told this reverses what the Privacy page and both
-- tools promised ("never sent to a server of ours", "not an administrator"),
-- chose it anyway, and the public wording was changed in the same release so
-- the site says what it does.
--
-- ── site_tool_data ──────────────────────────────────────────────────────────
-- One row per browser per open tool (True Property Cost, Wealth Tracker): the
-- text that tool keeps in the browser, exactly as kept, replaced on every save
-- a moment after typing pauses. It is the same text `tool_saves` (0032) holds
-- for a signed-in person, but kept for everybody and readable by admins. A
-- Wealth Tracker record locked with a passcode is ciphertext in the browser,
-- so it arrives as ciphertext here too and `sealed` says so: that one promise
-- still holds, because nobody but its owner has the passcode.
--
-- ── site_events ─────────────────────────────────────────────────────────────
-- What a visitor does on a page, in order: a form field filled ("field", with
-- its label and the value), and a button or link pressed ("click", with its
-- words). Passwords, one-time codes, file pickers and anything marked private
-- in the page are never read by the browser side; the two open tools' own
-- fields are left to site_tool_data, so a locked record's contents are not
-- leaked one field at a time.
--
-- ── Who writes and reads ────────────────────────────────────────────────────
-- As with track_hit (0033): `track_input()` is the only writer, SECURITY
-- DEFINER, open to the anonymous key, and it takes the account from
-- `auth.uid()`, never from the caller. Reading is for `is_analytics_admin()`.
-- Both tables hang off site_visitors, so a visitor removed takes everything
-- with them, and `reset_site_analytics()` (0035) now empties all four.
--
-- Re-runnable.
-- ============================================================================

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

create or replace function reset_site_analytics() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_analytics_admin() then raise exception 'Only an admin can clear the visit data'; end if;
  truncate table site_events, site_tool_data, site_views, site_visitors;
end;
$$;

revoke all on function reset_site_analytics() from public;
grant execute on function reset_site_analytics() to authenticated;
