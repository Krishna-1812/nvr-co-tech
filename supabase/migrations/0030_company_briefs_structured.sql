-- ============================================================================
-- company_briefs, restructured: a card the reader can scan, not a markdown
-- essay
-- ============================================================================
--
-- 0029 stored the brief as one markdown blob and rendered it through the
-- assistant's own markdown parser. In practice that produced exactly what a
-- markdown-rendered LLM answer always produces: long paragraphs under four
-- headings, which reads fine in a chat window and poorly in a drawer meant to
-- be scanned in a few seconds next to the registry's own figures.
--
-- This replaces the one text column with `content jsonb`: an object with
-- fixed fields (overview, highlights, recentDevelopments, competitivePosition,
-- keyRisks) that the drawer renders as tiles, a timeline and tagged lists
-- instead of prose. The shape lives in `src/lib/comps/brief.ts`
-- (`BriefContent`) — this column is deliberately untyped jsonb rather than a
-- row of columns because it is a cache of one LLM call's structured answer,
-- not a fact the platform reasons about in SQL; `parseBriefContent()` is
-- where the shape is actually enforced, on the way in and on the way out.
--
-- `markdown` is dropped outright rather than kept alongside the new column.
-- This table is a cache, not a record: every row in it can be regenerated for
-- the cost of one more LLM call, so there is nothing to migrate and nothing
-- lost by clearing it — a customer who opens a company that only has an old
-- row simply gets a cache miss and a fresh brief, exactly the same path
-- `STALE_AFTER_DAYS` already sends every brief down eventually. The API route
-- treats an old row missing `content` as a miss for the same reason.
-- ============================================================================

alter table company_briefs drop column markdown;

alter table company_briefs add column content jsonb not null default '{}'::jsonb;

comment on column company_briefs.content is
  'The structured brief: {overview, highlights, recentDevelopments, '
  'competitivePosition, keyRisks} — see BriefContent in src/lib/comps/brief.ts. '
  'A row from before this migration has ''{}'' here, which parseBriefContent() '
  'treats as absent, so the API route regenerates it rather than rendering an '
  'empty card.';

create or replace function record_company_brief(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into company_briefs (
    company_id, content, citations, model, input_tokens, output_tokens
  ) values (
    (p ->> 'company_id')::uuid,
    coalesce(p -> 'content', '{}'::jsonb),
    coalesce(p -> 'citations', '[]'::jsonb),
    coalesce(p ->> 'model', 'unknown'),
    (p ->> 'input_tokens')::integer,
    (p ->> 'output_tokens')::integer
  )
  on conflict (company_id) do update set
    content       = excluded.content,
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
  'merges: a regeneration is a newer read, not a second source. p.content is '
  'the structured BriefContent object, not markdown (see 0030).';


-- ============================================================================
-- Verification — run these after applying, and read the answers.
--
--   -- 1. markdown is gone, content is there and not null.
--   select column_name, is_nullable from information_schema.columns
--    where table_name = 'company_briefs' and column_name in ('markdown', 'content');
--   -- expect one row: content | NO
--
--   -- 2. Insert then replace, in one transaction, rolled back so it leaves
--   --    nothing behind. Expect one row both times, with the second content.
--   begin;
--     with c as (
--       select upsert_company('{"name":"Brief cache check","source":"verification"}'::jsonb) as id
--     )
--     select record_company_brief(jsonb_build_object(
--              'company_id', c.id,
--              'content', jsonb_build_object('overview', 'First pass.', 'highlights', '[]'::jsonb,
--                'recentDevelopments', '[]'::jsonb,
--                'competitivePosition', jsonb_build_object('summary','','strengths','[]'::jsonb,'challenges','[]'::jsonb),
--                'keyRisks', '[]'::jsonb),
--              'model', 'test')) from c;
--
--     with c as (select id from companies where name = 'Brief cache check')
--     select record_company_brief(jsonb_build_object(
--              'company_id', c.id,
--              'content', jsonb_build_object('overview', 'Second pass.', 'highlights', '[]'::jsonb,
--                'recentDevelopments', '[]'::jsonb,
--                'competitivePosition', jsonb_build_object('summary','','strengths','[]'::jsonb,'challenges','[]'::jsonb),
--                'keyRisks', '[]'::jsonb),
--              'model', 'test')) from c;
--
--     select count(*), (array_agg(cb.content ->> 'overview'))[1] from company_briefs cb
--       join companies c on c.id = cb.company_id
--      where c.name = 'Brief cache check';   -- expect 1 row, 'Second pass.'
--   rollback;
-- ============================================================================
