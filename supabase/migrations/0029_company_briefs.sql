-- ============================================================================
-- company_briefs — a generated research note, cached once per company
--
-- The Comparables screen shows what the registry knows about a company: the
-- filed figures, the market quote, the multiples. It has never shown what the
-- company IS — what it makes, what just happened to it, who it competes with.
-- That is not something a filing carries, so it cannot come from the registry;
-- it comes from an LLM call with web search, and that call costs real money
-- and takes several seconds.
--
-- So it is generated once and kept, the same shape of decision as every other
-- shared table in 0028: a company is paid for once, ever, and every reader
-- after that is free. `unique (company_id)` is what makes that true — a second
-- generation for the same company overwrites the first rather than piling up
-- rows nobody reads.
--
-- This is shared, not tenant, data for the same reason companies itself is:
-- what Reuters and the SEC and a company's own site say about it does not
-- depend on who is asking. It follows the identical read-only-to-everyone,
-- written-only-through-a-function shape as the rest of the registry.
-- ============================================================================

create table company_briefs (
  id bigserial primary key,
  company_id uuid not null references companies(id) on delete cascade,

  -- The brief itself, as markdown — rendered with the same parser the
  -- assistant's answers already go through (src/lib/assist/markdown.ts).
  markdown text not null,

  -- What the web search actually cited, so a reader can check the source
  -- rather than take the model's word for it. [{ "title": "...", "url": "..." }]
  citations jsonb not null default '[]'::jsonb,

  model text not null,
  input_tokens integer,
  output_tokens integer,

  generated_at timestamptz not null default now(),

  unique (company_id)
);

comment on table company_briefs is
  'A generated research note for one company: the registry''s own figures read '
  'alongside an LLM call with web search. Cached, one row per company, so the '
  'same company is never regenerated on every click. Shared across every '
  'tenant, same as companies; written only through record_company_brief().';

comment on column company_briefs.citations is
  'What the web search actually cited: [{"title","url"}]. Not a copy of the '
  'pages themselves — see source_documents'' comment in 0028 for why this '
  'platform records that a source exists rather than redistributing it.';

create index company_briefs_company_idx on company_briefs (company_id);

-- Same shape as the rest of the shared registry: readable by anybody signed
-- in, writable by nobody directly.
alter table company_briefs enable row level security;

create policy company_briefs_read on company_briefs
  for select using (auth.uid() is not null);

revoke insert, update, delete on company_briefs from authenticated;


-- ---------------------------------------------------------------------------
-- record_company_brief — the only door in.
--
-- On conflict the row is replaced outright rather than merged, unlike
-- upsert_company: a regenerated brief is a newer read of the same company, not
-- a second source adding detail to the first, so the newer text is simply the
-- true one.
-- ---------------------------------------------------------------------------
create or replace function record_company_brief(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into company_briefs (
    company_id, markdown, citations, model, input_tokens, output_tokens
  ) values (
    (p ->> 'company_id')::uuid,
    p ->> 'markdown',
    coalesce(p -> 'citations', '[]'::jsonb),
    coalesce(p ->> 'model', 'unknown'),
    (p ->> 'input_tokens')::integer,
    (p ->> 'output_tokens')::integer
  )
  on conflict (company_id) do update set
    markdown      = excluded.markdown,
    citations     = excluded.citations,
    model         = excluded.model,
    input_tokens  = excluded.input_tokens,
    output_tokens = excluded.output_tokens,
    generated_at  = now()
  returning id into v_id;

  return v_id;
end $$;

comment on function record_company_brief(jsonb) is
  'Writes or replaces the one cached brief for a company. Replaces rather than '
  'merges: a regeneration is a newer read, not a second source.';

grant execute on function record_company_brief(jsonb) to authenticated;


-- ============================================================================
-- Verification — run these after applying, and read the answers.
--
--   -- 1. The table exists, with its one policy and it is a SELECT.
--   select tablename, policyname, cmd from pg_policies
--    where tablename = 'company_briefs';
--
--   -- 2. The function exists and is callable.
--   select proname from pg_proc where proname = 'record_company_brief';
--
--   -- 3. Insert then replace, in one transaction, rolled back so it leaves
--   --    nothing behind. Expect one row both times, with the second markdown.
--   begin;
--     with c as (
--       select upsert_company('{"name":"Brief cache check","source":"verification"}'::jsonb) as id
--     )
--     select record_company_brief(jsonb_build_object(
--              'company_id', c.id, 'markdown', '## Overview\nFirst pass.',
--              'model', 'test')) from c;
--
--     with c as (select id from companies where name = 'Brief cache check')
--     select record_company_brief(jsonb_build_object(
--              'company_id', c.id, 'markdown', '## Overview\nSecond pass.',
--              'model', 'test')) from c;
--
--     select count(*) from company_briefs cb
--       join companies c on c.id = cb.company_id
--      where c.name = 'Brief cache check';   -- expect 1
--   rollback;
-- ============================================================================
