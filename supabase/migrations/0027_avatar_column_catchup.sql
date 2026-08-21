-- ---------------------------------------------------------------------------
-- 0027 — bring the live database up to what 0006 was supposed to have done
--
-- `profiles.avatar_url` does not exist in production. It was added by 0006, and
-- 0006 was never applied there — discovered on 2026-08-21 when 0026's
-- `operator_members()` failed to create with
--
--     ERROR 42703: column p.avatar_url does not exist
--
-- and worth noticing that the error came from a function body rather than from a
-- query. `operator_members` is `language sql`, and PostgreSQL parses and
-- validates an SQL-language body at creation time. A `language plpgsql` body is
-- not checked until it runs, which is the whole reason this went unnoticed for
-- as long as it did — see the live risk below.
--
-- ── Why this is a new migration rather than "just run 0006" ─────────────────
--
-- Because running 0006 now would take the database backwards. 0006 also carries
-- a `create or replace function handle_new_user()`, and 0022 replaced that same
-- function with a newer version that records the `account_created` product
-- event. Re-running 0006 would silently reinstate the version without it, and
-- the top of the activation funnel would stop being recorded — with nothing
-- failing to say so.
--
-- So this file is 0006 minus that one function: the column, the guard on who may
-- write it, the function that keeps it current, and the backfill. Anything in
-- 0006 that a later migration has since superseded is deliberately absent.
--
-- ── The live risk this fixes ────────────────────────────────────────────────
--
-- 0022's `handle_new_user()` inserts into `profiles (id, email, full_name,
-- avatar_url)`. It is plpgsql, so creating it succeeded even though the column
-- was missing, and it will only fail when it runs — which is on the trigger
-- behind every signup. Any account created between 0022 being applied and this
-- file being applied would have failed at the database. The column has to exist
-- for signup to work at all, which makes this the more urgent half of the paste
-- it arrives in.
--
-- The application itself was written to tolerate the column's absence — the
-- session profile types it as optional, and the OAuth callback swallows a
-- missing `sync_own_avatar` on purpose — so nothing else here was broken by it,
-- only quietly degraded to initials instead of faces.
-- ---------------------------------------------------------------------------

alter table profiles add column if not exists avatar_url text;

comment on column profiles.avatar_url is
  'Profile picture from the identity provider. Written only by handle_new_user() '
  'and sync_own_avatar(), both of which read it from auth.users. Never accepted '
  'from a client, because it is rendered in other users'' browsers.';


-- ---------------------------------------------------------------------------
-- Keep it current on the way back in.
--
-- 0006's function verbatim. It takes no arguments on purpose: the obvious
-- design, sync_avatar(p_url text), would trust the caller with a URL that other
-- people's browsers will fetch. This reads it from auth.users under SECURITY
-- DEFINER instead, so the only possible value is the one the identity provider
-- actually issued, and only over https.
-- ---------------------------------------------------------------------------
create or replace function sync_own_avatar() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  select nullif(
           coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
           ''
         )
    into v_url
  from auth.users u
  where u.id = auth.uid();

  -- Only https. A provider should never hand us anything else, and this string is
  -- going into an img src.
  if v_url is null or v_url not like 'https://%' then
    return null;
  end if;

  update profiles
     set avatar_url = v_url,
         updated_at = now()
   where id = auth.uid()
     and coalesce(avatar_url, '') <> v_url;

  return v_url;
end $$;

revoke all on function sync_own_avatar() from public;
grant execute on function sync_own_avatar() to authenticated;


-- ---------------------------------------------------------------------------
-- Not self-writable.
--
-- 0003 already granted UPDATE on exactly one column. Restating the whole grant
-- makes it explicit that adding a column did not widen what a user may write:
-- avatar_url is absent from this list deliberately, because the string ends up
-- in an <img src> on other people's screens.
--
-- Idempotent, and safe even though 0003 was applied: revoking and re-granting
-- the same single column leaves the same state.
-- ---------------------------------------------------------------------------
revoke update on profiles from authenticated;
grant  update (full_name) on profiles to authenticated;


-- ---------------------------------------------------------------------------
-- Backfill everyone who has already signed in with an identity provider.
--
-- Without it, existing accounts show initials until each person happens to sign
-- in again. Re-runnable: the `avatar_url is null` guard means a second run
-- touches nothing.
-- ---------------------------------------------------------------------------
update profiles p
   set avatar_url = v.url
  from (
    select u.id,
           nullif(coalesce(u.raw_user_meta_data->>'avatar_url',
                           u.raw_user_meta_data->>'picture'), '') as url
      from auth.users u
  ) v
 where v.id = p.id
   and p.avatar_url is null
   and v.url like 'https://%';
