'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { USER_ROLES, type UserRole } from '@/lib/domain/workflow';
import { SITE_URL } from '@/lib/marketing/content';
import type { ActionResult } from './workflow';

/**
 * Administration.
 *
 * Every mutation here goes through a SECURITY DEFINER function whose rules live
 * in the migrations, so the permission checks hold regardless of client. These
 * actions exist to call them and translate their messages.
 */

function toMessage(error: { message?: string } | null, fallback: string): string {
  const raw = error?.message ?? '';
  if (!raw) return fallback;
  return raw.split('\nCONTEXT:')[0].replace(/^ERROR:\s*/, '').trim() || fallback;
}

function refreshAdmin() {
  revalidatePath('/admin');
  revalidatePath('/admin/chapters');
  revalidatePath('/admin/deleted');
}

// ─── Roles ───────────────────────────────────────────────────────────────────

const roleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(USER_ROLES),
});

/**
 * Only an owner may change roles, never their own, and never another owner's —
 * enforced in `set_user_role`, carried over from v1's rule.
 */
export async function setUserRole(input: {
  userId: string;
  role: string;
}): Promise<ActionResult> {
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'That is not a valid role.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_user_role', {
    p_user: parsed.data.userId,
    p_role: parsed.data.role,
  });

  if (error) return { ok: false, error: toMessage(error, 'Could not change that role.') };

  refreshAdmin();
  // The nav and approval queue both key off roles.
  revalidatePath('/', 'layout');
  return { ok: true, data: undefined };
}

// ─── Inviting a teammate ─────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.email('Give a valid email address.'),
  role: z.enum(USER_ROLES.filter((r) => r !== 'owner') as [UserRole, ...UserRole[]]),
});

/**
 * Copy-a-link, not send-an-email — there is no transactional email provider
 * wired into this project, and the invite is only ever as sensitive as its
 * token: accept_invite (migration 0012) checks it against the accepting
 * person's own verified address regardless of who ends up holding the link.
 */
export async function inviteUser(input: {
  email: string;
  role: string;
}): Promise<ActionResult<{ link: string; email: string }>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid invite.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('invite_user', {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });

  if (error || !data) {
    return { ok: false, error: toMessage(error, 'Could not create that invite.') };
  }

  return {
    ok: true,
    data: { link: `${SITE_URL}/onboarding?invite=${data.token}`, email: data.email },
  };
}

// ─── Chapters ────────────────────────────────────────────────────────────────

const createChapterSchema = z.object({
  name: z.string().trim().min(2, 'Give the chapter a name.').max(120),
  // The code is embedded in every voucher number this chapter ever issues, so
  // it is fixed at creation and never editable afterwards.
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Codes are 2–6 letters.')
    .max(6, 'Codes are 2–6 letters.')
    .regex(/^[A-Z0-9]+$/, 'Use letters and numbers only.'),
});

export async function createChapter(input: {
  name: string;
  code: string;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = createChapterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid chapter.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('chapters')
    .insert({ name: parsed.data.name, code: parsed.data.code })
    .select('id')
    .single();

  if (error || !data) {
    const msg = error?.message ?? '';
    if (msg.includes('chapters_name_key')) {
      return { ok: false, error: 'A chapter with that name already exists.' };
    }
    if (msg.includes('chapters_code_key')) {
      return { ok: false, error: `The code ${parsed.data.code} is already in use.` };
    }
    return { ok: false, error: toMessage(error, 'Could not create that chapter.') };
  }

  refreshAdmin();
  revalidatePath('/vouchers');
  return { ok: true, data: { id: data.id } };
}

export async function renameChapter(input: {
  id: string;
  name: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('rename_chapter', {
    p_id: input.id,
    p_name: input.name,
  });

  if (error) return { ok: false, error: toMessage(error, 'Could not rename that chapter.') };
  refreshAdmin();
  return { ok: true, data: undefined };
}

/**
 * Chapters are retired, not deleted — historical vouchers reference them
 * (ON DELETE RESTRICT), so removal would either fail or orphan records.
 */
export async function setChapterActive(input: {
  id: string;
  active: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_chapter_active', {
    p_id: input.id,
    p_active: input.active,
  });

  if (error) return { ok: false, error: toMessage(error, 'Could not update that chapter.') };
  refreshAdmin();
  revalidatePath('/vouchers');
  return { ok: true, data: undefined };
}

// ─── The recycle bin ─────────────────────────────────────────────────────────

export async function purgeVoucher(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('purge_voucher', { p_id: id });

  if (error) return { ok: false, error: toMessage(error, 'Could not delete that voucher.') };
  refreshAdmin();
  revalidatePath('/vouchers');
  return { ok: true, data: undefined };
}
