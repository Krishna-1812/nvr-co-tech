'use server';

import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { PREVIEW } from '@/lib/preview';
import type { ToolSaveRow } from '@/lib/supabase/types';
import { acceptsBody } from '@/lib/cloud/guard';
import type { ActionResult } from './workflow';

/**
 * A signed-in person's saved work for the browser-side tools (migration 0032;
 * Will Maker from 0038, and only ever as ciphertext: see lib/cloud/guard).
 *
 * The browser does all the work and keeps its own copy; these three calls only
 * move that copy to and from the account, as text, unread. lib/cloud decides
 * when. Every call is the caller's own row under RLS, so there is no id to pass
 * and nothing anybody could ask for but their own.
 *
 * `missing` means the table is not there yet (0032 not applied). The tools then
 * say they are saving in this browser only, which is true, rather than failing.
 */

export type SavedCopy = { body: string; updatedAt: string } | null;
type Tool = ToolSaveRow['tool'];
type Result<T> = ActionResult<T> | { ok: false; error: string; missing: true };

const TOOLS: readonly Tool[] = ['wealth-tracker', 'true-property-cost', 'will-maker'];
const MAX = 2_000_000;

/** PostgREST's "no such table" (cache miss) and Postgres's own. */
const MISSING = new Set(['PGRST205', '42P01']);

/*
 * Preview has no database, so the account copy is a map in this server
 * process: enough to watch a save happen and a second tab pick it up.
 */
const previewSaves: Map<string, { body: string; updatedAt: string }> =
  ((globalThis as Record<string, unknown>).__tfiPreviewSaves as Map<string, { body: string; updatedAt: string }>) ??
  ((globalThis as Record<string, unknown>).__tfiPreviewSaves = new Map());

async function who(tool: string): Promise<{ userId: string } | { error: string }> {
  if (!TOOLS.includes(tool as Tool)) return { error: 'Not a tool that saves to an account.' };
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { error: 'Sign in to save to your account.' };
  return { userId: user.id };
}

export async function readSave(tool: Tool): Promise<Result<SavedCopy>> {
  const me = await who(tool);
  if ('error' in me) return { ok: false, error: me.error };
  if (PREVIEW) return { ok: true, data: previewSaves.get(`${me.userId}:${tool}`) ?? null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tool_saves')
    .select('body, updated_at')
    .eq('user_id', me.userId)
    .eq('tool', tool)
    .maybeSingle();
  if (error) {
    return MISSING.has(error.code) ? { ok: false, error: error.message, missing: true } : { ok: false, error: 'Could not reach your account.' };
  }
  return { ok: true, data: data ? { body: data.body, updatedAt: data.updated_at } : null };
}

export async function writeSave(tool: Tool, body: string): Promise<Result<{ updatedAt: string }>> {
  const me = await who(tool);
  if ('error' in me) return { ok: false, error: me.error };
  if (typeof body !== 'string' || body.length > MAX) return { ok: false, error: 'Too large to save to your account.' };
  if (!acceptsBody(tool, body)) return { ok: false, error: 'A will is only saved to your account once it is locked with a passcode.' };
  if (PREVIEW) {
    const updatedAt = new Date().toISOString();
    previewSaves.set(`${me.userId}:${tool}`, { body, updatedAt });
    return { ok: true, data: { updatedAt } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tool_saves')
    .upsert({ user_id: me.userId, tool, body }, { onConflict: 'user_id,tool' })
    .select('updated_at')
    .single();
  if (error) {
    return MISSING.has(error.code) ? { ok: false, error: error.message, missing: true } : { ok: false, error: 'Could not save to your account.' };
  }
  return { ok: true, data: { updatedAt: data.updated_at } };
}

/** Removes the account copy. The browser's own copy is the caller's business. */
export async function clearSave(tool: Tool): Promise<Result<void>> {
  const me = await who(tool);
  if ('error' in me) return { ok: false, error: me.error };
  if (PREVIEW) {
    previewSaves.delete(`${me.userId}:${tool}`);
    return { ok: true, data: undefined };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('tool_saves').delete().eq('user_id', me.userId).eq('tool', tool);
  if (error) {
    return MISSING.has(error.code) ? { ok: false, error: error.message, missing: true } : { ok: false, error: 'Could not remove it from your account.' };
  }
  return { ok: true, data: undefined };
}
