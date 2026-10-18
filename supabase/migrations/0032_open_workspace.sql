-- ============================================================================
-- The open workspace: platform admins, and somewhere to keep a person's work
--
-- From 18 October 2026 nobody needs an account to use the workspace. Anybody
-- may use True Property Cost and Wealth Tracker; the other four live tools are
-- for the platform's admins, and everybody else is asked to request access.
-- Signing in is now what keeps your work: this migration is where it is kept.
--
-- ── 1. The owner's admin list ───────────────────────────────────────────────
--
-- `analytics_admins` has always been the one list of platform people (0010).
-- The application now also treats everybody on it as an admin of the tools
-- (src/lib/access.ts), and holds the owner's five addresses in code so they
-- work the moment the code deploys. They are added here as well because
-- Contact Finder's routes and caches ask `is_analytics_admin()` inside
-- Postgres (0031), and a code list cannot answer that. Being on this list also
-- opens Visitor Intelligence, which is the point of it being one list.
--
-- ── 2. tool_saves ───────────────────────────────────────────────────────────
--
-- One row per person per tool, holding what that tool keeps in the browser,
-- as the same text the browser keeps. Both tools that use it still work out
-- everything in the browser; this is only the copy that follows a signed-in
-- person to another device.
--
-- Wealth Tracker's record is the sensitive one (account numbers, folios,
-- nominees). With a passcode set the browser stores ciphertext (AES-GCM, key
-- derived from the passcode, which never leaves the browser), and that same
-- ciphertext is what is saved here, so this table then holds nothing anybody
-- here can read. Without a passcode it is plain JSON, readable only by its
-- owner under the policies below and by nobody else — there is no admin
-- override, as with reconciliations (0008) and Ask history (0009).
--
-- `body` is capped at 2 MB of text, far above any real record, so a broken or
-- hostile client cannot fill the database through one row.
--
-- Re-runnable: everything is `if not exists`, `on conflict do nothing`, or
-- dropped and re-created.
-- ============================================================================

insert into analytics_admins (email, note) values
  ('vivekgaggar@yahoo.com',            'Platform admin (open workspace, 18 Oct 2026).'),
  ('triptigaggar@yahoo.com',           'Platform admin (open workspace, 18 Oct 2026).'),
  ('vivek.gaggar@nvrandco.com',        'Platform admin (open workspace, 18 Oct 2026).'),
  ('ladhakrishna2022@gmail.com',       'Platform admin (open workspace, 18 Oct 2026).'),
  ('team@thefinanceintelligence.com',  'Platform admin (open workspace, 18 Oct 2026).')
on conflict (email) do nothing;

create table if not exists tool_saves (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  tool       text        not null check (tool in ('wealth-tracker', 'true-property-cost')),
  body       text        not null check (length(body) <= 2000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, tool)
);

comment on table tool_saves is
  'What a browser-side tool keeps, saved for its signed-in owner so it follows '
  'them to another device. Owner-only; no admin override. A Wealth Tracker '
  'record with a passcode is stored here as the same ciphertext the browser holds.';

alter table tool_saves enable row level security;

drop policy if exists tool_saves_read_own on tool_saves;
create policy tool_saves_read_own on tool_saves
  for select using (user_id = auth.uid());

drop policy if exists tool_saves_insert_own on tool_saves;
create policy tool_saves_insert_own on tool_saves
  for insert with check (user_id = auth.uid());

drop policy if exists tool_saves_update_own on tool_saves;
create policy tool_saves_update_own on tool_saves
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists tool_saves_delete_own on tool_saves;
create policy tool_saves_delete_own on tool_saves
  for delete using (user_id = auth.uid());

-- The anonymous key can do nothing at all here; a signed-in person only what
-- the policies above allow.
revoke all on tool_saves from anon;
grant select, insert, update, delete on tool_saves to authenticated;

-- The server stamps the time, so the "saved at" a device compares against is
-- never a browser's clock.
create or replace function tool_saves_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tool_saves_touch on tool_saves;
create trigger tool_saves_touch
  before insert or update on tool_saves
  for each row execute function tool_saves_touch();
