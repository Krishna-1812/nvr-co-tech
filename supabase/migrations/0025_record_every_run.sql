-- ---------------------------------------------------------------------------
-- 0025 — record every run, and report the cap rather than enforce it
--
-- 0023 wrote record_agent_run so that a person at their cap got no row: the
-- function returned allowed = false and inserted nothing. That is the right
-- shape for a hard gate, and the wrong shape for this product, for two separate
-- reasons.
--
-- The first is measurement. If the eleventh run is not recorded, then "total
-- runs" on the usage screen is not total runs — it silently becomes "runs up to
-- ten per person per tool", and the people using a tool most are exactly the
-- ones whose usage stops being counted. The number would be least accurate
-- precisely where it matters most.
--
-- The second is that nobody has decided to gate anything. Reconciliation and the
-- assistant are live tools that customers use; refusing the eleventh
-- reconciliation of the month would be a change to what the product does, and
-- that is a commercial decision, not a side effect of building a dashboard.
--
-- So: always insert, and return whether this run was inside the cap. The screen
-- can report who has passed it, and enforcement — if it is ever wanted — becomes
-- one explicit check at the call site rather than something buried in a
-- measurement function.
-- ---------------------------------------------------------------------------

create or replace function record_agent_run(p_slug text)
returns table(allowed boolean, used integer, cap integer)
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_slug  text;
  v_cap   integer := agent_run_cap();
  v_used  integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to use this tool';
  end if;

  v_slug := lower(trim(coalesce(p_slug, '')));
  if v_slug = '' then raise exception 'Which tool?'; end if;

  select p.email into v_email from profiles p where p.id = auth.uid();
  if v_email is null then raise exception 'We could not read your profile'; end if;

  -- Still serialised per (person, tool). The count is now reported rather than
  -- gated on, but two tabs racing would otherwise both report the same number
  -- back, and a screen that says "9 of 10" twice for the ninth and tenth run is
  -- wrong in a way somebody will notice.
  perform pg_advisory_xact_lock(hashtext(v_email || ':' || v_slug));

  insert into agent_runs (actor_id, email, feature_slug, organization_id)
  values (auth.uid(), v_email, v_slug, my_organization_id());

  select count(*) into v_used
    from agent_runs r
    where r.email = v_email and r.feature_slug = v_slug;

  -- allowed describes the run that just happened: true while the person is
  -- within their allowance, false once they are past it. Nothing is refused.
  return query select v_used <= v_cap, v_used, v_cap;
end $$;
