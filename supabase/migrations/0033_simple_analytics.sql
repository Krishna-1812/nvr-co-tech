-- ============================================================================
-- Simple analytics: one visitor table, one page-view table, one writer
--
-- The owner asked for the analytics to be replaced with something simple: how
-- many people visit, who they are when they are signed in, a lasting ID for
-- them when they are not, their earlier visits joined to their account when
-- they sign in, the time each spends, access requests and sign-in details, on
-- one Admin screen.
--
-- ── How a visitor is known ──────────────────────────────────────────────────
-- The browser keeps a random ID in the first-party `fi_vid` cookie (one year;
-- the same cookie the old tracker used, so people already seen keep their ID).
-- Coming back with the cookie is the same row in `site_visitors`. Signing in
-- stamps that row with the account, and every earlier view from it is moved
-- under the account in the same statement: that is the "map previous visits to
-- the profile" step. Signing in on a second device gives a second visitor row
-- with the same `user_id`, and the Admin screen adds them up per person.
--
-- ── Who can write and read ──────────────────────────────────────────────────
-- Nobody inserts directly. `track_hit()` is the only writer, SECURITY DEFINER,
-- callable by the anonymous key because visitors are anonymous. It never takes
-- a user id from its caller: the account comes from `auth.uid()`, i.e. from the
-- session cookie the server forwarded, so a visitor cannot attach their visits
-- to somebody else's account. Reading is for `is_analytics_admin()` only, the
-- platform admin list (0010, 0032).
--
-- `admin_accounts()` lists every account with its sign-up date, last sign-in
-- and sign-in method from `auth.users`, again for admins only.
--
-- The old analytics tables (0010 onwards) are no longer written or read. They
-- are left in place rather than dropped here, so nothing is lost by running
-- this; dropping them is a separate decision.
--
-- Re-runnable.
-- ============================================================================

create table if not exists site_visitors (
  id              uuid        primary key,
  first_seen      timestamptz not null default now(),
  last_seen       timestamptz not null default now(),
  user_id         uuid        references auth.users (id) on delete set null,
  email           text,
  first_path      text,
  first_referrer  text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  browser         text,
  os              text,
  device          text,
  screen          text,
  language        text,
  timezone        text,
  country         text,
  region          text,
  city            text,
  ip              text,
  user_agent      text
);

create index if not exists site_visitors_last_seen on site_visitors (last_seen desc);
create index if not exists site_visitors_user on site_visitors (user_id);

create table if not exists site_views (
  id          uuid        primary key,
  visitor_id  uuid        not null references site_visitors (id) on delete cascade,
  session_id  text,
  user_id     uuid        references auth.users (id) on delete set null,
  path        text        not null,
  title       text,
  referrer    text,
  started_at  timestamptz not null default now(),
  seconds     integer     not null default 0 check (seconds >= 0)
);

create index if not exists site_views_started on site_views (started_at desc);
create index if not exists site_views_visitor on site_views (visitor_id);

alter table site_visitors enable row level security;
alter table site_views    enable row level security;

drop policy if exists site_visitors_admin_read on site_visitors;
create policy site_visitors_admin_read on site_visitors for select using (is_analytics_admin());

drop policy if exists site_views_admin_read on site_views;
create policy site_views_admin_read on site_views for select using (is_analytics_admin());

revoke insert, update, delete on site_visitors from anon, authenticated;
revoke insert, update, delete on site_views    from anon, authenticated;
grant select on site_visitors, site_views to authenticated;

-- Text from the browser, trimmed to a sane length, or null.
create or replace function analytics_text(v text, n integer) returns text
language sql immutable as $$
  select nullif(left(btrim(coalesce(v, '')), n), '');
$$;

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
    update site_views set user_id = v_uid where visitor_id = v_vid and user_id is null;
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

create or replace function admin_accounts()
returns table (
  id uuid, email text, full_name text, created_at timestamptz,
  last_sign_in_at timestamptz, provider text
)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text, pr.full_name, u.created_at, u.last_sign_in_at,
         coalesce(u.raw_app_meta_data ->> 'provider', 'email')
    from auth.users u
    left join profiles pr on pr.id = u.id
   where is_analytics_admin()
   order by u.created_at desc;
$$;

revoke all on function admin_accounts() from public;
grant execute on function admin_accounts() to authenticated;
