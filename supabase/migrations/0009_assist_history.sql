-- ============================================================================
-- Ask — saved conversations
--
-- Until now the assistant forgot everything the moment the panel closed, and
-- that was written down as a deliberate choice: history is a table, a retention
-- decision, and somewhere a pasted bank statement comes to rest. This migration
-- is that decision made explicitly rather than the feature added quietly.
--
-- What is stored, and what is not:
--
--   * The questions and the answers, as they were shown. Nothing is
--     paraphrased or summarised on the way in, because a history that differs
--     from what was on screen is worse than no history.
--
--   * NOT the retrieved documents' text, the system prompt, or anything the
--     model was given beyond the conversation. `sources` is a handful of
--     titles and ids so the chips can be drawn again; the corpus itself is
--     generated from the codebase and is not somebody's data.
--
--   * NOT failed turns. A network error or a rate limit is a thing that
--     happened to the interface, not a thing that was said, and it is dropped
--     on the way in. The exchange is written once the answer is complete, so a
--     question never sits in the history with nothing under it.
--
-- Retention is: yours until you delete it. There is no expiry job behind this,
-- and adding one silently would be the same mistake in the other direction. The
-- product gives one control to delete a conversation and one to delete the lot,
-- and both are a plain DELETE against the policies below.
--
-- Private to the person who asked, in the strongest sense the database can
-- express. Unlike a voucher, which moves through other people's hands, a
-- conversation has no second reader: there is no approver branch, no admin
-- branch, and no policy that would let one person read another's. An admin who
-- needs this is a subpoena, not a screen.
-- ============================================================================

create table assist_conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references profiles(id) on delete cascade,

  -- Cut from the first question, in application code, so the list can be
  -- rendered without reading a single turn. Not written by a model: a title
  -- that cost an API call and might paraphrase the question is a worse title.
  title text not null check (char_length(btrim(title)) between 1 and 160),

  -- The roster slug of the tool the panel was opened from, or null on /ask.
  -- Kept so that resuming a conversation resumes its subject: a chat begun
  -- inside Voucher Desk goes on being pinned to Voucher Desk. Deliberately not
  -- a foreign key — the roster lives in TypeScript, not in a table, and a slug
  -- that is retired later should leave the conversation readable.
  agent text,

  -- Maintained by the trigger below, never by the client. The list shows both,
  -- and neither is worth a second query per row.
  turn_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table assist_conversations is
  'One saved conversation with the assistant. Private to whoever had it, kept '
  'until they delete it.';

create table assist_turns (
  id bigserial primary key,
  conversation_id uuid not null references assist_conversations(id) on delete cascade,

  role text not null check (role in ('user', 'assistant')),
  content text not null,

  -- Both are the interface's own shapes, stored whole: Source[] and ToolTrace[]
  -- from src/lib/assist/types. Written once, read whole, never queried across,
  -- which is the same test migration 0008 applied to a stored reconciliation.
  -- Normalising a chip into three columns would only be a slower way to get the
  -- same array back.
  sources jsonb,
  tools jsonb,

  -- Set when the turn did not come from the model. Only 'offline' is storable:
  -- an error turn is never written at all, and a sample answer that came back
  -- from history without its label would be passed off as a real one.
  note text check (note in ('offline')),

  created_at timestamptz not null default now()
);

comment on table assist_turns is
  'The turns of a conversation, in insertion order. There is no sequence column '
  'because id is one: a turn is only ever appended.';

-- The history list, newest activity first, for one person.
create index assist_conversations_mine_idx
  on assist_conversations (created_by, updated_at desc);

-- Reading one conversation back, in the order it was said.
create index assist_turns_conversation_idx on assist_turns (conversation_id, id);

-- ---------------------------------------------------------------------------
-- Keeping the parent row honest.
--
-- turn_count and updated_at are derived from the turns, so nothing outside this
-- trigger is allowed to write them — the grant below makes that literal. It is
-- SECURITY DEFINER for the same reason the workflow functions in 0002 are: it
-- runs as the table owner, so it can perform an UPDATE that the caller has
-- neither a policy nor a column grant for, and the only way to reach it is by
-- inserting a turn the policies already allowed.
-- ---------------------------------------------------------------------------
create or replace function bump_assist_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update assist_conversations
     set turn_count = turn_count + 1,
         updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger assist_turns_bump
  after insert on assist_turns
  for each row execute function bump_assist_conversation();

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Yours and nobody else's. As in 0008, note what is absent: there is no update
-- policy on either table, and with RLS enabled a command without a policy is
-- denied to everyone. A turn is a record of something that was said, so it is
-- append-only for the same reason voucher_audit is.
-- ---------------------------------------------------------------------------
alter table assist_conversations enable row level security;
alter table assist_turns         enable row level security;

create policy assist_conversations_read_own on assist_conversations
  for select using (created_by = auth.uid());

create policy assist_conversations_insert_own on assist_conversations
  for insert with check (created_by = auth.uid());

create policy assist_conversations_delete_own on assist_conversations
  for delete using (created_by = auth.uid());

-- A turn belongs to whoever owns its conversation. There is no created_by
-- column here on purpose: two places to state the same ownership is two places
-- for it to disagree, and the one that matters is the parent.
create policy assist_turns_read_own on assist_turns
  for select using (
    exists (
      select 1 from assist_conversations c
       where c.id = assist_turns.conversation_id
         and c.created_by = auth.uid()
    )
  );

create policy assist_turns_insert_own on assist_turns
  for insert with check (
    exists (
      select 1 from assist_conversations c
       where c.id = assist_turns.conversation_id
         and c.created_by = auth.uid()
    )
  );

-- Deleting a conversation deletes its turns, by the cascade above rather than by
-- a policy. That is the only way a turn goes: there is no delete policy here, so
-- nobody can quietly remove one question from the middle of an exchange.

-- Belt and braces alongside the missing update policies: even if one were added
-- later by mistake, there is no column grant behind it, and turn_count and
-- updated_at stay the trigger's alone.
revoke update on assist_conversations from authenticated;
revoke update on assist_turns         from authenticated;
