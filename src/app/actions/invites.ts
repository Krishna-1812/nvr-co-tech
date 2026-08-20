'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/marketing/content';
import { emailConfigured, sendEmail } from '@/lib/notify';
import { invited } from '@/lib/notify/templates';
import { ROLE_META, type UserRole } from '@/lib/domain/workflow';
import type { ActionResult } from './workflow';

/**
 * The invite lifecycle, past the point of creating one.
 *
 * Its own module rather than more of admin.ts, because an invite now has a life
 * beyond the moment it is minted: it can be listed, emailed, and taken back.
 * Until 0021 it had none of those. The link existed only in the browser tab that
 * created it, so refreshing /admin lost it for good — nothing read the invites
 * table, though it has had a read policy since 0012 — and the only recourse was
 * to mint a second one, which the old invite_user() would happily do.
 */

function toMessage(error: { message?: string } | null, fallback: string): string {
  const raw = error?.message ?? '';
  if (!raw) return fallback;
  return raw.split('\nCONTEXT:')[0].replace(/^ERROR:\s*/, '').trim() || fallback;
}

export type PendingInvite = {
  id: string;
  email: string;
  role: UserRole;
  link: string;
  createdAt: string;
  expiresAt: string;
};

/**
 * Everything still outstanding, newest first.
 *
 * Accepted and expired invites are left out: this list exists to answer "who
 * have we asked, and is the link still good", and a row that can no longer be
 * used is only noise. The token is included because the whole point of a
 * copy-a-link invite is being able to copy the link again later.
 */
export async function listPendingInvites(): Promise<PendingInvite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_invites')
    .select('id, email, role, token, created_at, expires_at')
    .is('accepted_at', null)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    link: `${SITE_URL}/onboarding?invite=${row.token}`,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

export async function revokeInvite(id: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Invalid request.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_invite', { p_id: parsed.data });

  if (error) return { ok: false, error: toMessage(error, 'Could not revoke that invite.') };
  revalidatePath('/admin');
  return { ok: true, data: undefined };
}

/**
 * Send (or re-send) the invite email for an outstanding invite.
 *
 * Awaited rather than fire-and-forget, unlike the workflow notifications: here
 * the whole point of pressing the button is to find out whether it went, and
 * the admin needs to know to fall back to copying the link if it did not.
 */
export async function emailInvite(id: string): Promise<ActionResult<{ to: string }>> {
  if (!emailConfigured()) {
    return {
      ok: false,
      error: 'Email is not set up on this deployment. Copy the link and send it yourself.',
    };
  }

  const supabase = await createClient();

  const { data: invite, error } = await supabase
    .from('organization_invites')
    .select(
      'email, role, token, expires_at, organization:organizations(name), inviter:profiles!organization_invites_invited_by_fkey(full_name, email)',
    )
    .eq('id', id)
    .is('accepted_at', null)
    .maybeSingle();

  if (error) return { ok: false, error: toMessage(error, 'Could not read that invite.') };
  if (!invite) return { ok: false, error: 'That invite has already been used, or no longer exists.' };

  const org = invite.organization as { name?: string | null } | null;
  const inviter = invite.inviter as { full_name?: string | null; email?: string | null } | null;

  const res = await sendEmail({
    to: invite.email,
    ...invited({
      organisation: org?.name ?? 'your organisation',
      invitedBy: inviter?.full_name || inviter?.email || 'An administrator',
      role: ROLE_META[invite.role].label.toLowerCase(),
      link: `${SITE_URL}/onboarding?invite=${invite.token}`,
      expires: new Date(invite.expires_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    }),
  });

  if (!res.sent) {
    return { ok: false, error: 'The email could not be sent. Copy the link and send it yourself.' };
  }
  return { ok: true, data: { to: invite.email } };
}
