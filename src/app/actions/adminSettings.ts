'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAnalyticsAdmin } from '@/lib/analytics/admin';
import { ADMIN_EMAILS, GRANTABLE_TOOLS } from '@/lib/access';
import type { ActionResult } from './workflow';

/**
 * The Admin settings screen's writes (migration 0035).
 *
 * Each one asks `isAnalyticsAdmin()` here and then calls a database function
 * that asks the same question again, so neither this file nor the screen is
 * the only gate. Errors from Postgres come back in words ("You cannot remove
 * yourself") and are shown as they are.
 */

const email = z.email('Give a valid email address.').max(200);

async function gate(): Promise<string | null> {
  return (await isAnalyticsAdmin()) ? null : 'Only an admin can change these settings.';
}

function done(): ActionResult {
  revalidatePath('/analytics/settings');
  revalidatePath('/analytics');
  return { ok: true, data: undefined };
}

function words(message: string): string {
  if (/function .* does not exist|PGRST202/i.test(message)) return 'These settings need migration 0035 to be run first.';
  return message.replace(/^ERROR:\s*/i, '');
}

export async function addAdmin(input: { email: string; note?: string }): Promise<ActionResult> {
  const refused = await gate();
  if (refused) return { ok: false, error: refused };
  const parsed = email.safeParse(input.email.trim());
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Give a valid email address.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_add', { p_email: parsed.data, p_note: input.note ?? null });
  return error ? { ok: false, error: words(error.message) } : done();
}

export async function removeAdmin(target: string): Promise<ActionResult> {
  const refused = await gate();
  if (refused) return { ok: false, error: refused };
  if (ADMIN_EMAILS.includes(target.trim().toLowerCase())) {
    return { ok: false, error: 'This address is built into the platform and cannot be removed here.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_remove', { p_email: target });
  return error ? { ok: false, error: words(error.message) } : done();
}

export async function grantTool(input: { email: string; tool: string; note?: string }): Promise<ActionResult> {
  const refused = await gate();
  if (refused) return { ok: false, error: refused };
  const parsed = email.safeParse(input.email.trim());
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Give a valid email address.' };
  if (!GRANTABLE_TOOLS.includes(input.tool)) return { ok: false, error: 'That tool cannot be opened for one person.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('grant_tool', { p_email: parsed.data, p_tool: input.tool, p_note: input.note ?? null });
  return error ? { ok: false, error: words(error.message) } : done();
}

export async function revokeTool(input: { email: string; tool: string }): Promise<ActionResult> {
  const refused = await gate();
  if (refused) return { ok: false, error: refused };
  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_tool', { p_email: input.email, p_tool: input.tool });
  return error ? { ok: false, error: words(error.message) } : done();
}

export async function setExcludeAdmins(value: boolean): Promise<ActionResult> {
  const refused = await gate();
  if (refused) return { ok: false, error: refused };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_platform_setting', { p_key: 'exclude_admins', p_value: value });
  return error ? { ok: false, error: words(error.message) } : done();
}

export async function resetVisits(confirm: string): Promise<ActionResult> {
  const refused = await gate();
  if (refused) return { ok: false, error: refused };
  if (confirm.trim().toLowerCase() !== 'clear') return { ok: false, error: 'Type "clear" to confirm.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('reset_site_analytics');
  return error ? { ok: false, error: words(error.message) } : done();
}
