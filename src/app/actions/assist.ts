'use server';

import { revalidatePath } from 'next/cache';
import {
  clearConversations,
  deleteConversation,
  listConversations,
  readConversation,
} from '@/lib/assist/store';
import {
  NO_HISTORY_TABLE,
  type ConversationSummary,
  type SavedConversation,
} from '@/lib/assist/history';
import type { ActionResult } from './workflow';

/**
 * Saved conversations, as the interface reaches them.
 *
 * Server actions rather than API routes, and for the reads as much as the
 * writes. The two places that need this list are the history page, which is a
 * Server Component and could call the store directly, and the dropdown inside
 * the assistant panel, which is a client component and cannot. An action is the
 * one shape both can use, so there is no second copy of "what a conversation
 * looks like on the wire" to keep in step.
 *
 * Every one of these is scoped to the signed-in person by the policies in
 * migration 0009. Nothing here takes a user id, so there is no parameter an
 * attacker could put somebody else's in.
 */

/**
 * The list, or the reason there is not one.
 *
 * A failure here is nearly always the same failure: migration 0009 has not been
 * applied to this project and the table is simply not there. That is worth
 * saying, because it is a thing somebody can go and fix, and the assistant
 * works perfectly well in the meantime.
 */
export async function fetchConversations(): Promise<ActionResult<ConversationSummary[]>> {
  const conversations = await listConversations();
  if (!conversations) return { ok: false, error: NO_HISTORY_TABLE };
  return { ok: true, data: conversations };
}

export async function openConversation(id: string): Promise<ActionResult<SavedConversation>> {
  const conversation = await readConversation(id);
  if (!conversation) return { ok: false, error: 'That conversation is no longer here.' };
  return { ok: true, data: conversation };
}

export async function removeConversation(id: string): Promise<ActionResult> {
  if (!(await deleteConversation(id))) {
    return { ok: false, error: 'Could not delete that conversation.' };
  }

  revalidatePath('/ask/history');
  return { ok: true, data: undefined };
}

/** The retention control: everything, at once, on purpose. */
export async function removeAllConversations(): Promise<ActionResult> {
  if (!(await clearConversations())) {
    return { ok: false, error: 'Could not clear your history.' };
  }

  revalidatePath('/ask/history');
  return { ok: true, data: undefined };
}
