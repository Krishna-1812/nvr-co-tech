'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAnalyticsAdmin } from '@/lib/analytics/admin';
import type { ActionResult } from './workflow';

/**
 * Tax Notice Watch's one write: marking a proceeding dealt with, or not
 * (migration 0037). Asked of `isAnalyticsAdmin()` here and again inside
 * `itd_set_handled()`, as the Admin settings writes are. A later notice on
 * the same proceeding clears the mark; the morning check does that.
 */

const input = z.object({
  key: z.string().min(1).max(64),
  handled: z.boolean(),
  note: z.string().max(500).optional(),
});

export async function setNoticeHandled(raw: { key: string; handled: boolean; note?: string }): Promise<ActionResult> {
  if (!(await isAnalyticsAdmin())) return { ok: false, error: 'Only an admin can change this.' };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'That proceeding could not be found.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('itd_set_handled', {
    p_key: parsed.data.key,
    p_handled: parsed.data.handled,
    p_note: parsed.data.note?.trim() || null,
  });
  if (error) {
    return { ok: false, error: /does not exist|PGRST202/i.test(error.message) ? 'This needs migration 0037 to be run first.' : error.message.replace(/^ERROR:\s*/i, '') };
  }
  revalidatePath('/tax-notices');
  return { ok: true, data: undefined };
}
