'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { draftSchema } from '@/lib/domain/schema';
import type { ActionResult } from './workflow';

/**
 * Draft lifecycle.
 *
 * "New voucher" creates an empty draft row immediately and redirects to its
 * editor, which gives autosave a stable target. v1 kept 32 fields in component
 * state with no persistence, so a refresh lost the lot.
 */

function toMessage(error: { message?: string } | null, fallback: string): string {
  const raw = error?.message ?? '';
  if (!raw) return fallback;
  return raw.split('\nCONTEXT:')[0].replace(/^ERROR:\s*/, '').trim() || fallback;
}

export async function createDraft(): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data, error } = await supabase
    .from('vouchers')
    .insert({
      created_by: user.id,
      status: 'draft',
      // Default to today — the overwhelmingly common case, and still editable.
      date: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: toMessage(error, 'Could not start a voucher.') };

  // Best-effort: a missed 'created' entry is a smaller loss than blocking the
  // voucher itself on it, so its own error is swallowed rather than surfaced.
  await supabase.rpc('log_voucher_change', { p_id: data.id, p_action: 'created' });

  revalidatePath('/vouchers');
  return { ok: true, data: { id: data.id } };
}

/**
 * Autosave. Called on a debounce from the form, so it must be cheap and must
 * never throw for a half-typed field — hence the permissive draft schema.
 *
 * Generated columns (net_total, grand_total) are deliberately not sent: Postgres
 * owns them, which is how the client and the database can never disagree.
 */
export async function saveDraft(
  id: string,
  patch: unknown,
): Promise<ActionResult<{ savedAt: string }>> {
  const parsed = draftSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Some values look wrong.' };
  }

  const supabase = await createClient();
  const fields = Object.keys(parsed.data);

  // Read the old values for exactly the fields this save touches, so the
  // audit entry can carry what actually changed rather than just that a save
  // happened. Fetched before the update, since afterwards there is no "before".
  const { data: before } = fields.length
    ? await supabase.from('vouchers').select(fields.join(',')).eq('id', id).maybeSingle()
    : { data: null };

  const { error } = await supabase.from('vouchers').update(parsed.data).eq('id', id);

  if (error) {
    // RLS blocks edits once a voucher leaves draft/rejected — say so plainly.
    return { ok: false, error: toMessage(error, 'Could not save. This voucher may be locked.') };
  }

  const changed = diffFields(before as Record<string, unknown> | null, parsed.data);
  if (changed) {
    await supabase.rpc('log_voucher_change', { p_id: id, p_action: 'updated', p_changed: changed });
  }

  return { ok: true, data: { savedAt: new Date().toISOString() } };
}

/** Only the fields whose value actually moved, `before` → `after`. Null if none did. */
function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): Record<string, { before: unknown; after: unknown }> | null {
  if (!before) return null;
  const changed: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of Object.keys(after)) {
    const prev = before[key] ?? null;
    const next = after[key] ?? null;
    if (prev !== next) changed[key] = { before: prev, after: next };
  }
  return Object.keys(changed).length ? changed : null;
}

// ─── Inline creation of events and chapters ──────────────────────────────────

const eventSchema = z.object({
  name: z.string().trim().min(2, 'Give the event a name.').max(200),
  chapter_id: z.uuid().nullable().optional(),
  date_of_event: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(''))
    .optional(),
});

export async function createEvent(input: {
  name: string;
  chapter_id?: string | null;
  date_of_event?: string;
}): Promise<ActionResult<{ id: string; name: string; date_of_event: string | null; chapter_id: string | null }>> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid event.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data, error } = await supabase
    .from('events')
    .insert({
      name: parsed.data.name,
      chapter_id: parsed.data.chapter_id ?? null,
      date_of_event: parsed.data.date_of_event || null,
      created_by: user.id,
    })
    .select('id, name, date_of_event, chapter_id')
    .single();

  if (error || !data) return { ok: false, error: toMessage(error, 'Could not create the event.') };

  revalidatePath('/vouchers');
  return { ok: true, data };
}

// ─── Deleting a draft ────────────────────────────────────────────────────────

/**
 * Goes through `soft_delete_voucher` rather than a direct UPDATE, same as
 * every other deletion path (see workflow.ts's softDeleteVoucher) — a raw
 * update here left no audit entry at all, unlike deleting from the recycle bin.
 */
export async function deleteDraft(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('soft_delete_voucher', { p_id: id, p_reason: null });

  if (error) return { ok: false, error: toMessage(error, 'Could not delete this voucher.') };

  revalidatePath('/vouchers');
  return { ok: true, data: undefined };
}
