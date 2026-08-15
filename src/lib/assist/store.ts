import { createClient } from '@/lib/supabase/server';
import {
  titleFor,
  turnsFromRows,
  type ConversationSummary,
  type SavedConversation,
  type StoredTurn,
} from './history';
import type { Source, ToolTrace, TurnNote } from './types';

/**
 * Saved conversations, as queries.
 *
 * Server only: everything here builds a Supabase client from the request's
 * cookies, so every one of these runs as the signed-in person and the policies
 * in migration 0009 are what actually decide what they can touch. The filters
 * on `created_by` below are belt and braces, not the enforcement.
 *
 * One rule runs through the whole file: nothing here may break a conversation.
 * History is a convenience laid over the assistant, and if the table is missing,
 * the migration has not been applied, or the write simply fails, the answer on
 * screen is still a good answer. So these return null or an empty list rather
 * than throwing, and the caller carries on.
 */

/** The signed-in person, or null. Nothing here works without one. */
async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

/**
 * Keep one question and the answer it got.
 *
 * Written as a pair, at the end, rather than the question up front and the
 * answer later. A question saved on its own would sit in the history with
 * nothing under it whenever an answer failed or was stopped, which reads as a
 * bug in the assistant rather than as a record of what happened.
 *
 * The first exchange of a conversation creates it. Later ones are appended to
 * the id the browser sends back, after checking it is still there and still
 * theirs: a conversation deleted in another tab should start a new one rather
 * than fail silently for the rest of the session.
 */
export async function saveExchange({
  conversationId,
  agent,
  question,
  answer,
  sources,
  tools,
  note,
}: {
  conversationId: string | null;
  agent: string | null;
  question: string;
  answer: string;
  sources: Source[];
  tools: ToolTrace[];
  note?: TurnNote;
}): Promise<{ id: string; title: string } | null> {
  const session = await me();
  if (!session) return null;
  const { supabase, userId } = session;

  try {
    let id: string | null = null;
    let title = titleFor(question);

    if (conversationId) {
      const { data } = await supabase
        .from('assist_conversations')
        .select('id, title')
        .eq('id', conversationId)
        .eq('created_by', userId)
        .maybeSingle();

      if (data) {
        id = data.id;
        title = data.title;
      }
    }

    if (!id) {
      const { data, error } = await supabase
        .from('assist_conversations')
        .insert({ created_by: userId, title, agent })
        .select('id')
        .single();

      if (error || !data) return null;
      id = data.id;
    }

    /*
     * Both turns in one statement, so the order they are read back in is the
     * order they were said. There is no sequence column: ids come from one
     * sequence and are assigned in array order, which is the same guarantee for
     * less machinery.
     */
    const { error } = await supabase.from('assist_turns').insert([
      { conversation_id: id, role: 'user' as const, content: question },
      {
        conversation_id: id,
        role: 'assistant' as const,
        content: answer,
        // jsonb columns, so an empty array is stored as null rather than as an
        // empty array somebody later has to remember means the same thing.
        sources: sources.length ? sources : null,
        tools: tools.length ? tools : null,
        note: note ?? null,
      },
    ]);

    if (error) return null;
    return { id, title };
  } catch {
    // The likeliest cause by a distance is that 0009 has not been applied to
    // this project yet. The answer the reader is looking at is unaffected.
    return null;
  }
}

/**
 * Conversations you have had, most recently used first.
 *
 * Null rather than an empty list when the table cannot be read at all. The two
 * are worth telling apart on screen: "you have not asked anything yet" and
 * "migration 0009 has not been applied to this project" look identical to a
 * reader and only one of them is something they can act on.
 */
export async function listConversations(limit = 50): Promise<ConversationSummary[] | null> {
  const session = await me();
  if (!session) return null;
  const { supabase, userId } = session;

  try {
    const { data, error } = await supabase
      .from('assist_conversations')
      .select('id, title, agent, turn_count, updated_at')
      .eq('created_by', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) return null;

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      agent: row.agent,
      turnCount: row.turn_count,
      updatedAt: row.updated_at,
    }));
  } catch {
    return null;
  }
}

/** One conversation, whole, in the order it was said. */
export async function readConversation(id: string): Promise<SavedConversation | null> {
  const session = await me();
  if (!session) return null;
  const { supabase, userId } = session;

  try {
    const { data: conversation } = await supabase
      .from('assist_conversations')
      .select('id, title, agent')
      .eq('id', id)
      .eq('created_by', userId)
      .maybeSingle();

    if (!conversation) return null;

    /*
     * A second query rather than an embedded join. The turns are the bulk of
     * this and the join would repeat the conversation's columns on every one of
     * them; more to the point, the two are ordered differently and read by
     * different code paths.
     */
    const { data: rows } = await supabase
      .from('assist_turns')
      .select('id, role, content, sources, tools, note')
      .eq('conversation_id', id)
      .order('id', { ascending: true });

    return {
      id: conversation.id,
      title: conversation.title,
      agent: conversation.agent,
      turns: turnsFromRows((rows ?? []) as StoredTurn[]),
    };
  } catch {
    return null;
  }
}

/** Delete one. The turns go with it, by the cascade in 0009. */
export async function deleteConversation(id: string): Promise<boolean> {
  const session = await me();
  if (!session) return false;
  const { supabase, userId } = session;

  try {
    const { error } = await supabase
      .from('assist_conversations')
      .delete()
      .eq('id', id)
      .eq('created_by', userId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Delete the lot.
 *
 * The retention control. Nothing expires on its own — see the note at the top
 * of 0009 — so this is how somebody who does not want a record of what they
 * asked gets rid of it, in one action rather than one row at a time.
 */
export async function clearConversations(): Promise<boolean> {
  const session = await me();
  if (!session) return false;
  const { supabase, userId } = session;

  try {
    const { error } = await supabase
      .from('assist_conversations')
      .delete()
      .eq('created_by', userId);

    return !error;
  } catch {
    return false;
  }
}
