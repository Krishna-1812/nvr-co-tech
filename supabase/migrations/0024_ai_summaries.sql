-- ---------------------------------------------------------------------------
-- 0024 — a cache for the written-by-a-model summary of a person
--
-- The customer usage screen shows a two-sentence read of each person, generated
-- from facts this database already holds. Generating one costs a model call, and
-- the same person gets opened repeatedly, so it has to be cached. What is
-- interesting is what it is keyed on.
--
-- Not time. A time-to-live is the wrong instrument here, because it answers a
-- question nobody asked ("is this old?") instead of the one that matters ("is
-- this still true?"). A summary of somebody who has done nothing for three
-- months is not stale, and one written before they ran a reconciliation
-- yesterday is, however recent it is.
--
-- So the key is a hash of the exact facts that went in, plus the version of the
-- prompt that shaped them. A person doing something new changes the facts and
-- therefore the key, and the next read misses and regenerates. Improving the
-- prompt changes the version and invalidates every summary at once. Neither
-- needs anybody to remember to purge anything, and there is no window during
-- which the screen knowingly shows something it believes to be wrong.
-- ---------------------------------------------------------------------------

create table if not exists ai_summaries (
  -- The hash is the identity of the thing, so it is the key. Two people with
  -- identical facts would legitimately share a summary.
  fact_hash   text primary key,
  subject     text not null,
  headline    text not null,
  summary     text not null,
  intent      text not null check (intent in ('high', 'medium', 'low')),
  model       text,
  created_at  timestamptz not null default now()
);

create index if not exists ai_summaries_subject_idx on ai_summaries (subject);

comment on table ai_summaries is
  'Model-written reads of a person, keyed by a hash of the facts that produced '
  'them plus the prompt version — never by time, so a summary is regenerated '
  'when it stops being true rather than when it gets old.';

alter table ai_summaries enable row level security;

create policy ai_summaries_read on ai_summaries
  for select using (is_analytics_admin());


-- ---------------------------------------------------------------------------
-- cache_ai_summary — the only writer
--
-- Idempotent on the hash: two admins opening the same profile at the same
-- moment both generate, and the second write is a no-op rather than a conflict.
-- Restricted to the analytics allowlist because writing here costs money at the
-- provider, and an unauthenticated writer would be a way to spend it.
-- ---------------------------------------------------------------------------
create or replace function cache_ai_summary(
  p_hash     text,
  p_subject  text,
  p_headline text,
  p_summary  text,
  p_intent   text,
  p_model    text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_analytics_admin() then
    raise exception 'Not allowed';
  end if;

  insert into ai_summaries (fact_hash, subject, headline, summary, intent, model)
  values (p_hash, p_subject, p_headline, p_summary, p_intent, p_model)
  on conflict (fact_hash) do nothing;
end $$;


grant execute on function cache_ai_summary(text, text, text, text, text, text) to authenticated;
