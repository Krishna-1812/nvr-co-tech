-- ============================================================================
-- Admin settings: who is an admin, who has a locked tool, how the counting runs
--
-- The Admin area got a settings screen of its own (/analytics/settings). Each
-- section there is backed by something here, and every change goes through a
-- SECURITY DEFINER function that checks `is_analytics_admin()` first, so the
-- screen is never the only gate.
--
--   analytics_admins (0010)  add and remove admins. The owner's five addresses
--                            are also written into the code (src/lib/access.ts)
--                            and cannot be removed from the screen; removing
--                            the last admin, or yourself, is refused.
--   tool_grants              a locked tool opened to one person by email, the
--                            "yes" to a Request access. Voucher Desk, Ledger
--                            Reconciliation and Valuation Desk only: Contact
--                            Finder spends platform credits and its caches hold
--                            revealed contact details, so it stays admins-only.
--   platform_settings        small switches, as key -> jsonb. Today one key:
--                            `exclude_admins` (leave admins' own visits out of
--                            the Admin figures).
--   reset_site_analytics()   empties site_visitors and site_views (0033).
--
-- Re-runnable.
-- ============================================================================

create table if not exists tool_grants (
  email      text        not null check (position('@' in email) > 1),
  tool       text        not null check (tool in ('voucher-desk', 'ledger-reconciliation', 'valuation-desk')),
  note       text,
  granted_by text,
  granted_at timestamptz not null default now(),
  primary key (email, tool)
);

alter table tool_grants enable row level security;

-- Admins see every grant; a person sees their own, which is how the app knows
-- to open the tool for them.
drop policy if exists tool_grants_read on tool_grants;
create policy tool_grants_read on tool_grants
  for select using (is_analytics_admin() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

revoke insert, update, delete on tool_grants from anon, authenticated;
grant select on tool_grants to authenticated;

create table if not exists platform_settings (
  key        text        primary key,
  value      jsonb       not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table platform_settings enable row level security;
drop policy if exists platform_settings_read on platform_settings;
create policy platform_settings_read on platform_settings for select using (is_analytics_admin());
revoke insert, update, delete on platform_settings from anon, authenticated;
grant select on platform_settings to authenticated;

create or replace function admin_add(p_email text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_analytics_admin() then raise exception 'Only an admin can add an admin'; end if;
  if p_email is null or position('@' in p_email) < 2 then raise exception 'Give a valid email address'; end if;
  insert into analytics_admins (email, note)
  values (lower(btrim(p_email)), coalesce(nullif(btrim(p_note), ''), 'Added by ' || coalesce(auth.jwt() ->> 'email', 'an admin')))
  on conflict (email) do nothing;
end;
$$;

create or replace function admin_remove(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_analytics_admin() then raise exception 'Only an admin can remove an admin'; end if;
  if lower(btrim(p_email)) = lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'You cannot remove yourself';
  end if;
  if (select count(*) from analytics_admins) <= 1 then
    raise exception 'There must always be at least one admin';
  end if;
  delete from analytics_admins where lower(email) = lower(btrim(p_email));
end;
$$;

create or replace function grant_tool(p_email text, p_tool text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_analytics_admin() then raise exception 'Only an admin can open a tool for someone'; end if;
  insert into tool_grants (email, tool, note, granted_by)
  values (lower(btrim(p_email)), p_tool, nullif(btrim(p_note), ''), auth.jwt() ->> 'email')
  on conflict (email, tool) do update set note = excluded.note, granted_by = excluded.granted_by, granted_at = now();
end;
$$;

create or replace function revoke_tool(p_email text, p_tool text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_analytics_admin() then raise exception 'Only an admin can close a tool for someone'; end if;
  delete from tool_grants where lower(email) = lower(btrim(p_email)) and tool = p_tool;
end;
$$;

create or replace function set_platform_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_analytics_admin() then raise exception 'Only an admin can change settings'; end if;
  if p_key not in ('exclude_admins') then raise exception 'Unknown setting'; end if;
  insert into platform_settings (key, value, updated_by) values (p_key, p_value, auth.jwt() ->> 'email')
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

create or replace function reset_site_analytics() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_analytics_admin() then raise exception 'Only an admin can clear the visit data'; end if;
  truncate table site_views, site_visitors;
end;
$$;

revoke all on function admin_add(text, text), admin_remove(text), grant_tool(text, text, text),
  revoke_tool(text, text), set_platform_setting(text, jsonb), reset_site_analytics() from public;
grant execute on function admin_add(text, text), admin_remove(text), grant_tool(text, text, text),
  revoke_tool(text, text), set_platform_setting(text, jsonb), reset_site_analytics() to authenticated;
