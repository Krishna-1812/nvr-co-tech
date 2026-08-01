'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { BUCKET } from '@/lib/domain/attachments';
import type { ActionResult } from './workflow';

/**
 * Attachment bookkeeping.
 *
 * The file bytes never pass through the server: the browser uploads straight to
 * Supabase Storage under the user's own session, so the storage policies in
 * 0003_rls.sql are what actually authorise the write. These actions record and
 * remove the metadata row, and mint short-lived signed URLs for reading.
 */

function toMessage(error: { message?: string } | null, fallback: string): string {
  const raw = error?.message ?? '';
  if (!raw) return fallback;
  return raw.split('\nCONTEXT:')[0].replace(/^ERROR:\s*/, '').trim() || fallback;
}

export type AttachmentRow = {
  id: string;
  voucher_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export async function recordAttachment(input: {
  voucher_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}): Promise<ActionResult<AttachmentRow>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data, error } = await supabase
    .from('voucher_attachments')
    .insert({ ...input, uploaded_by: user.id })
    .select('id, voucher_id, storage_path, file_name, mime_type, size_bytes, created_at')
    .single();

  if (error || !data) {
    // The row is rejected by RLS once the voucher leaves draft/rejected. If that
    // happens the object is already uploaded, so clean it up rather than leaving
    // an orphan nobody can see or delete.
    await supabase.storage.from(BUCKET).remove([input.storage_path]);
    return { ok: false, error: toMessage(error, 'Could not attach that file.') };
  }

  revalidatePath(`/vouchers/${input.voucher_id}`);
  return { ok: true, data: data as AttachmentRow };
}

export async function deleteAttachment(id: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from('voucher_attachments')
    .select('storage_path, voucher_id')
    .eq('id', id)
    .maybeSingle();

  if (!row) return { ok: false, error: 'That file is no longer there.' };

  // Delete the row first: it is the record of truth, and RLS decides whether
  // this person may remove it at all. A leftover object is harmless; a leftover
  // row pointing at nothing is not.
  const { error } = await supabase.from('voucher_attachments').delete().eq('id', id);
  if (error) {
    return { ok: false, error: toMessage(error, 'Could not remove that file.') };
  }

  await supabase.storage.from(BUCKET).remove([row.storage_path]);

  revalidatePath(`/vouchers/${row.voucher_id}`);
  return { ok: true, data: undefined };
}

/**
 * A short-lived signed URL for viewing. The bucket is private, so this is the
 * only way to read a file — and because the lookup runs as the signed-in user,
 * RLS decides whether they get a URL at all.
 */
export async function getAttachmentUrl(id: string): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from('voucher_attachments')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();

  if (!row) return { ok: false, error: 'That file is no longer there.' };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 300); // five minutes is ample to open it

  if (error || !data) {
    return { ok: false, error: toMessage(error, 'Could not open that file.') };
  }

  return { ok: true, data: { url: data.signedUrl } };
}
