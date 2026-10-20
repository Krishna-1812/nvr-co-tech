-- ============================================================================
-- Income tax notice watcher: what the daily check finds on the e-Filing portal
--
-- The owner asked (20 Oct 2026) for an agent that logs in to each client's
-- account on the Income Tax e-Filing portal every morning, reads Pending
-- Actions → e-Proceedings, downloads the notices, shows them on a dashboard
-- and emails the team the moment something new appears, because notices that
-- go unseen turn into penalties. The agent is a separate worker
-- (workers/itd-notices) that runs on a server in the morning; this is where
-- it writes, and the Admin screen's Tax notices page (/analytics/notices) is
-- where it is read.
--
-- ── What is kept, and what is not ───────────────────────────────────────────
-- Passwords are NOT kept here. They stay in the owner's Google Sheet and pass
-- through the worker's memory for the length of one login. What is kept is
-- what the portal showed: each proceeding (name, years, dates, notice count),
-- the notices' files (in the private `itd-notices` storage bucket), every
-- check and its outcome, and every alert raised.
--
-- ── Who writes and reads ────────────────────────────────────────────────────
-- Only the worker writes, with the service-role key, which passes row-level
-- security by design; nobody else is granted a write. Reading is for
-- `is_analytics_admin()` (0010), the same list as the rest of the Admin
-- screen. The one thing an admin changes, "handled", goes through
-- `itd_set_handled()`, which checks that list again.
--
-- Re-runnable.
-- ============================================================================

create table if not exists itd_accounts (
  pan               text        primary key,
  name              text,
  notify            text[]      not null default '{}',
  status            text,
  message           text,
  last_checked_at   timestamptz,
  last_ok_at        timestamptz,
  first_ok_at       timestamptz,
  action_count      integer,
  information_count integer,
  in_sheet          boolean     not null default true,
  updated_at        timestamptz not null default now()
);

create table if not exists itd_runs (
  id          bigint      generated always as identity primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  host        text,
  accounts    integer     not null default 0,
  ok          integer     not null default 0,
  failed      integer     not null default 0,
  alerts      integer     not null default 0,
  emailed     boolean     not null default false,
  status      text        not null default 'running' check (status in ('running', 'done', 'crashed')),
  note        text
);

create index if not exists itd_runs_started on itd_runs (started_at desc);

create table if not exists itd_checks (
  id          bigint      generated always as identity primary key,
  run_id      bigint      references itd_runs (id) on delete cascade,
  pan         text        not null references itd_accounts (pan) on delete cascade,
  status      text        not null,
  message     text,
  proceedings integer,
  took_ms     integer,
  shot_path   text,
  at          timestamptz not null default now()
);

create index if not exists itd_checks_pan on itd_checks (pan, at desc);

create table if not exists itd_proceedings (
  key            text        primary key,
  pan            text        not null references itd_accounts (pan) on delete cascade,
  tab            text        check (tab in ('action', 'information')),
  name           text        not null,
  ay             text,
  fy             text,
  act            text,
  assessee       text,
  dates          jsonb       not null default '[]',
  notice_count   integer,
  marked_new     boolean     not null default false,
  due_on         date,
  notice_text    text,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  last_change_at timestamptz,
  gone_at        timestamptz,
  handled_at     timestamptz,
  handled_by     text,
  handled_note   text
);

create index if not exists itd_proceedings_pan on itd_proceedings (pan);
create index if not exists itd_proceedings_due on itd_proceedings (due_on) where gone_at is null and handled_at is null;

create table if not exists itd_documents (
  id             bigint      generated always as identity primary key,
  proceeding_key text        not null references itd_proceedings (key) on delete cascade,
  pan            text        not null,
  label          text,
  file_name      text,
  storage_path   text        not null,
  size_bytes     integer,
  sha256         text        not null,
  first_seen_at  timestamptz not null default now(),
  unique (proceeding_key, sha256)
);

create table if not exists itd_alerts (
  id             bigint      generated always as identity primary key,
  run_id         bigint      references itd_runs (id) on delete set null,
  pan            text        not null references itd_accounts (pan) on delete cascade,
  proceeding_key text        references itd_proceedings (key) on delete cascade,
  kind           text        not null check (kind in ('new-proceeding', 'more-notices', 'new-date')),
  detail         text        not null,
  at             timestamptz not null default now(),
  emailed_at     timestamptz
);

create index if not exists itd_alerts_at on itd_alerts (at desc);

alter table itd_accounts    enable row level security;
alter table itd_runs        enable row level security;
alter table itd_checks      enable row level security;
alter table itd_proceedings enable row level security;
alter table itd_documents   enable row level security;
alter table itd_alerts      enable row level security;

drop policy if exists itd_accounts_admin_read on itd_accounts;
create policy itd_accounts_admin_read on itd_accounts for select using (is_analytics_admin());
drop policy if exists itd_runs_admin_read on itd_runs;
create policy itd_runs_admin_read on itd_runs for select using (is_analytics_admin());
drop policy if exists itd_checks_admin_read on itd_checks;
create policy itd_checks_admin_read on itd_checks for select using (is_analytics_admin());
drop policy if exists itd_proceedings_admin_read on itd_proceedings;
create policy itd_proceedings_admin_read on itd_proceedings for select using (is_analytics_admin());
drop policy if exists itd_documents_admin_read on itd_documents;
create policy itd_documents_admin_read on itd_documents for select using (is_analytics_admin());
drop policy if exists itd_alerts_admin_read on itd_alerts;
create policy itd_alerts_admin_read on itd_alerts for select using (is_analytics_admin());

revoke insert, update, delete on itd_accounts, itd_runs, itd_checks, itd_proceedings, itd_documents, itd_alerts from anon, authenticated;
grant select on itd_accounts, itd_runs, itd_checks, itd_proceedings, itd_documents, itd_alerts to authenticated;

-- An admin marks a proceeding dealt with (or not). A later notice on the same
-- proceeding clears it again; the worker does that when it raises an alert.
create or replace function itd_set_handled(p_key text, p_handled boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_analytics_admin() then raise exception 'Only an admin can change this'; end if;
  update itd_proceedings set
    handled_at   = case when p_handled then now() end,
    handled_by   = case when p_handled then auth.jwt() ->> 'email' end,
    handled_note = case when p_handled then nullif(left(coalesce(p_note, ''), 500), '') end
  where key = p_key;
end;
$$;

revoke all on function itd_set_handled(text, boolean, text) from public;
grant execute on function itd_set_handled(text, boolean, text) to authenticated;

-- The notices' files and the screenshots of failed checks: private, admins read.
insert into storage.buckets (id, name, public)
values ('itd-notices', 'itd-notices', false)
on conflict (id) do nothing;

drop policy if exists itd_notices_admin_read on storage.objects;
create policy itd_notices_admin_read on storage.objects for select
  using (bucket_id = 'itd-notices' and public.is_analytics_admin());
