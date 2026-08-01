'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './workflow';

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Please give your full name.')
  .max(120, 'That name is too long.');

/**
 * Update your own display name — the one printed on vouchers as "Initiated By"
 * and "Approved By".
 *
 * Only full_name is sent. `role` and `is_active` are not writable from here at
 * all: 0003 revokes column UPDATE on them, so even a hand-rolled REST call with
 * a valid session cannot escalate. They move only through set_user_role().
 */
export async function updateFullName(input: { fullName: string }): Promise<ActionResult> {
  const parsed = nameSchema.safeParse(input.fullName);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'That name is not valid.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'Could not save that name.' };

  // The name shows in the shell, on the dashboard greeting and on every voucher.
  revalidatePath('/', 'layout');
  return { ok: true, data: undefined };
}
