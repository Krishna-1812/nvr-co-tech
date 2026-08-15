-- ============================================================================
-- Rate limiting and error logging that hold across serverless instances
--
-- /api/assist already has a rate limiter (see src/lib/assist/ratelimit.ts), and
-- its own comments are honest about what it is: a counter in the memory of one
-- warm instance, which is fine for stopping one stuck retry loop and nothing
-- more. The other endpoints an anonymous caller can reach at all — the beacon
-- and the identity webhook chief among them — had no ceiling whatsoever. A
-- limit that has to hold a real number across however many instances Vercel
-- happens to have warm can only live somewhere all of them share, which on
-- this project means here.
--
-- Error reporting had the same gap from the other direction: `error.tsx` and
-- `global-error.tsx` already catch what breaks, but only ever `console.error`
-- it. That is a message nobody but the person holding that exact browser tab
-- will ever read. `record_error` gives both the client boundaries and the
-- routes that swallow their own failures (by design — a tracking beacon must
-- never surface a 500 to a visitor) somewhere to write the failure down
-- without changing what the visitor sees.
--
-- Both follow the shape 0010 already settled on: a SECURITY DEFINER function
-- as the only door, because the anon key is public by design and a bare insert
-- policy would let anybody holding it write whatever they liked; reads gated
-- by the same `is_analytics_admin()` every other operational table uses,
-- because this is one more thing nobody's role in the voucher workflow has any
-- bearing on.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- rate_limits — a fixed-window counter, shared by every instance
--
-- Fixed window rather than the sliding window the in-memory version uses: a
-- sliding window needs an array of timestamps per key, which is exactly the
-- unbounded-growth shape 0010's caches were careful to avoid, and a fixed
-- window is one row, one UPSERT, one round trip. The cost is the well-known
-- boundary case — a burst either side of a window edge can briefly allow
-- roughly double the stated limit — which is an acceptable trade for the same
-- reason the in-memory limiter's own comment gives: this is a cost and abuse
-- control, not a control anything security-critical leans on.
-- ---------------------------------------------------------------------------
create table rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  count        integer not null default 0
);

comment on table rate_limits is
  'A shared counter per rate-limit key (e.g. "atrack:203.0.113.4"), reset every '
  'time check_rate_limit is called after its window has elapsed.';

-- SECURITY DEFINER so it can write regardless of who is calling — including
-- the anon role, which is the only role an unauthenticated beacon or webhook
-- ever has. STABLE would be wrong here: this writes on every call.
create or replace function check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = public as $$
declare
  v_now          timestamptz := now();
  v_window_start timestamptz;
  v_count        integer;
begin
  insert into rate_limits (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set count = case
          when rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else rate_limits.count + 1
        end,
        window_start = case
          when rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else rate_limits.window_start
        end
  returning rate_limits.window_start, rate_limits.count into v_window_start, v_count;

  -- Swept on write, the same way the in-memory limiter is: a call that lands
  -- with roughly 1-in-500 odds also clears out keys whose window closed over a
  -- day ago, so a table fed by distinct visitor IPs does not grow forever
  -- without a scheduled job to remember to run.
  if random() < 0.002 then
    delete from rate_limits where window_start < v_now - interval '1 day';
  end if;

  if v_count <= p_limit then
    return query select true, 0;
  else
    return query select
      false,
      greatest(
        1,
        ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::integer
      );
  end if;
end $$;

comment on function check_rate_limit(text, integer, integer) is
  'A cost and abuse control, not a security control. Counts requests per key in '
  'a fixed window shared by every serverless instance. Returns whether this one '
  'is allowed and, if not, how many seconds until the window resets.';

grant execute on function check_rate_limit(text, integer, integer) to anon, authenticated;

alter table rate_limits enable row level security;
-- No policy at all: with RLS on and none declared, every direct table access
-- is denied to anon and authenticated alike. The function above is the only
-- door, exactly as 0010's event tables are only reachable through theirs.


-- ---------------------------------------------------------------------------
-- error_log — what actually broke, and where
--
-- One table for both halves of the app: a client-side render that threw
-- (`scope = 'client'`, from error.tsx / global-error.tsx) and a route handler
-- that caught something it would otherwise have swallowed or let become a bare
-- 500 (`scope = 'server'`). Kept together because the question this answers —
-- "is something actually broken right now" — does not care which half failed.
-- ---------------------------------------------------------------------------
create table error_log (
  id          bigserial primary key,
  occurred_at timestamptz not null default now(),
  scope       text not null check (scope in ('client', 'server')),
  route       text,
  message     text not null,
  digest      text,
  stack       text,
  user_email  text,
  extra       jsonb
);

create index error_log_when_idx on error_log (occurred_at desc);

comment on table error_log is
  'Errors caught by error.tsx/global-error.tsx or by a route handler that would '
  'otherwise have swallowed the failure. Written only through record_error().';

create or replace function record_error(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_scope text := nullif(btrim(coalesce(p ->> 'scope', '')), '');
  v_message text := nullif(btrim(coalesce(p ->> 'message', '')), '');
begin
  -- Nothing to report without a message, and 'client' or 'server' is the whole
  -- of what scope is allowed to mean — see the check constraint above, which
  -- this guards against tripping and aborting the caller's transaction.
  if v_message is null or v_scope not in ('client', 'server') then return; end if;

  insert into error_log (scope, route, message, digest, stack, user_email, extra)
  values (
    v_scope,
    nullif(btrim(coalesce(p ->> 'route', '')), ''),
    left(v_message, 2000),
    nullif(btrim(coalesce(p ->> 'digest', '')), ''),
    left(nullif(btrim(coalesce(p ->> 'stack', '')), ''), 8000),
    nullif(lower(btrim(coalesce(p ->> 'user_email', ''))), ''),
    p -> 'extra'
  );
end $$;

comment on function record_error(jsonb) is
  'The only way to write to error_log. Silently does nothing given no message '
  'or an unrecognised scope, rather than raising into code that is already '
  'inside its own failure path.';

grant execute on function record_error(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- prune_errors — retention, not editing, same stance as prune_analytics
-- ---------------------------------------------------------------------------
create or replace function prune_errors(p_days integer default 90)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_removed integer;
begin
  if not is_analytics_admin() then
    raise exception 'Only an analytics administrator can prune the error log';
  end if;
  if p_days is null or p_days < 7 then
    raise exception 'Retention must be at least 7 days';
  end if;

  delete from error_log where occurred_at < now() - make_interval(days => p_days);
  get diagnostics v_removed = row_count;
  return v_removed;
end $$;

alter table error_log enable row level security;

create policy error_log_read on error_log
  for select using (is_analytics_admin());

revoke update, delete on error_log from anon, authenticated;
