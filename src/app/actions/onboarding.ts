'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './workflow';

/**
 * Joining or creating an organization.
 *
 * Both wrap a SECURITY DEFINER function (see migration 0012): create_organization
 * only succeeds while the caller's profile has no organization yet, and
 * accept_invite checks the invite's email against the caller's own verified
 * address. Neither rule is re-checked here — it cannot be bypassed by calling
 * the API directly, so there is nothing for this layer to enforce beyond
 * turning a database exception into a message worth reading.
 */

function toMessage(error: { message?: string } | null, fallback: string): string {
  const raw = error?.message ?? '';
  if (!raw) return fallback;
  return raw.split('\nCONTEXT:')[0].replace(/^ERROR:\s*/, '').trim() || fallback;
}

export async function createOrganization(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { ok: false, error: 'Give your organisation a name.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_organization', { p_name: trimmed });

  if (error) return { ok: false, error: toMessage(error, 'Could not create your organisation.') };
  return { ok: true, data: undefined };
}

export async function acceptInvite(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_invite', { p_token: token });

  if (error) return { ok: false, error: toMessage(error, 'Could not accept that invite.') };
  return { ok: true, data: undefined };
}
