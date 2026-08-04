-- ---------------------------------------------------------------------------
-- 0006 — profile pictures
--
-- The picture already existed: anyone who signs in with Google hands one over in
-- their identity token, and Supabase keeps it in auth.users.raw_user_meta_data.
-- Reading it from the session showed you your own face and nobody else's, because
-- a session only contains one user. To put a face next to a name in the audit
-- trail, the approval queue or the people list, it has to live on the row that
-- names them.
--
-- Nothing here lets a client choose the URL. That matters: this string ends up in
-- an <img src> on other people's screens, so a user who could write it freely
-- could point every colleague's browser at a server of their choosing. So the
-- column is not self-writable, and the two things that populate it both read the
-- value out of auth.users rather than taking it as an argument.
-- ---------------------------------------------------------------------------

alter table profiles add column if not exists avatar_url text;

comment on column profiles.avatar_url is
  'Profile picture from the identity provider. Written only by handle_new_user() '
  'and sync_own_avatar(), both of which read it from auth.users. Never accepted '
  'from a client, because it is rendered in other users'' browsers.';

-- ---------------------------------------------------------------------------
-- New users: copy the picture in with the name, at sign-up.
--
-- Google puts it in `picture`; Supabase normalises it to `avatar_url` for some
-- providers, so both are read, the same way full_name already falls back to name.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    nullif(
      coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Returning users: keep it current.
--
-- A picture changed in a Google account should follow the person here. The app
-- calls this once per sign-in, from the OAuth callback.
--
-- It takes no arguments on purpose. The obvious design — sync_avatar(p_url text)
-- — would trust the caller with a URL that other people's browsers will fetch.
-- This reads it from auth.users under SECURITY DEFINER instead, so the only
-- possible value is the one the identity provider actually issued.
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
-- Backfill: everyone who has already signed in with Google.
--
-- Without this, existing accounts would show initials until each person happened
-- to sign in again.
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

-- ---------------------------------------------------------------------------
-- Not self-writable.
--
-- 0003 granted UPDATE on exactly one column, full_name. Restating it here as the
-- whole grant makes it explicit that adding a column did not widen what a user
-- may write: avatar_url is absent from this list deliberately.
-- ---------------------------------------------------------------------------
revoke update on profiles from authenticated;
grant  update (full_name) on profiles to authenticated;
