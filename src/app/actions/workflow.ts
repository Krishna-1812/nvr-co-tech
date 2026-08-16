'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Workflow actions.
 *
 * Each is a thin wrapper over the SECURITY DEFINER function of the same name in
 * supabase/migrations/0002_workflow.sql. The rules — segregation of duties,
 * mandatory rejection reasons, immutability once approved — are enforced in
 * Postgres, so these cannot be bypassed by calling the API directly. What we do
 * here is turn a database exception into a message worth reading.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Postgres raises these as bare exceptions. Their messages are already written
 * for humans (see the migration), so pass them through rather than inventing a
 * generic "something went wrong".
 */
function toMessage(error: { message?: string; code?: string } | null, fallback: string): string {
  if (error?.code === '23505' && error.message?.includes('vouchers_no_unique')) {
    return 'That voucher number is already in use — choose a different one.';
  }
  const raw = error?.message ?? '';
  if (!raw) return fallback;
  // Strip the PL/pgSQL context noise Supabase sometimes appends.
  return raw.split('\nCONTEXT:')[0].replace(/^ERROR:\s*/, '').trim() || fallback;
}

/*
 * Every screen whose figures a workflow step can change.
 *
 * `/` was in this list from when `/` was the dashboard. It has been the public
 * home page for a while and is now doubly wrong, so the two screens that actually
 * count vouchers are named instead: the dashboard's pipeline and stat cards, and
 * the hub's live card. Getting this list right matters more than it used to, since
 * the router now holds a page for thirty seconds unless something invalidates it.
 */
function refresh(id?: string) {
  revalidatePath('/hub');
  revalidatePath('/dashboard');
  revalidatePath('/vouchers');
  revalidatePath('/approvals');
  if (id) revalidatePath(`/vouchers/${id}`);
}

// ─── Submit ──────────────────────────────────────────────────────────────────

export async function submitVoucher(id: string): Promise<ActionResult<{ voucherNo: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_voucher', { p_id: id });

  if (error) return { ok: false, error: toMessage(error, 'Could not submit this voucher.') };
  refresh(id);
  return { ok: true, data: { voucherNo: data?.voucher_no ?? '' } };
}

// ─── Approve ─────────────────────────────────────────────────────────────────

const approveSchema = z.object({
  id: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});

export async function approveVoucher(input: {
  id: string;
  note?: string;
}): Promise<ActionResult<{ status: string }>> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid request.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('approve_voucher', {
    p_id: parsed.data.id,
    p_note: parsed.data.note || undefined,
  });

  if (error) return { ok: false, error: toMessage(error, 'Could not approve this voucher.') };
  refresh(parsed.data.id);
  return { ok: true, data: { status: data?.status ?? '' } };
}

// ─── Reject ──────────────────────────────────────────────────────────────────

const rejectSchema = z.object({
  id: z.string().uuid(),
  // A reason is mandatory: the whole point is that the voucher can be corrected.
  reason: z.string().trim().min(3, 'Please say what needs fixing.').max(500),
});

export async function rejectVoucher(input: {
  id: string;
  reason: string;
}): Promise<ActionResult> {
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid request.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_voucher', {
    p_id: parsed.data.id,
    p_reason: parsed.data.reason,
  });

  if (error) return { ok: false, error: toMessage(error, 'Could not send this voucher back.') };
  refresh(parsed.data.id);
  return { ok: true, data: undefined };
}

// ─── Reopen ──────────────────────────────────────────────────────────────────

export async function reopenVoucher(input: {
  id: string;
  reason?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('reopen_voucher', {
    p_id: input.id,
    p_reason: input.reason?.trim() || undefined,
  });

  if (error) return { ok: false, error: toMessage(error, 'Could not reopen this voucher.') };
  refresh(input.id);
  return { ok: true, data: undefined };
}

// ─── Mark paid ───────────────────────────────────────────────────────────────

const paidSchema = z.object({
  id: z.string().uuid(),
  utr: z.string().trim().min(3, 'Enter the UTR or reference number.').max(64),
  paymentDate: z.string().optional(),
});

export async function markVoucherPaid(input: {
  id: string;
  utr: string;
  paymentDate?: string;
}): Promise<ActionResult> {
  const parsed = paidSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid request.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_voucher_paid', {
    p_id: parsed.data.id,
    p_utr: parsed.data.utr,
    p_payment_date: parsed.data.paymentDate || undefined,
  });

  if (error) return { ok: false, error: toMessage(error, 'Could not mark this voucher paid.') };
  refresh(parsed.data.id);
  return { ok: true, data: undefined };
}

// ─── Soft delete / restore ───────────────────────────────────────────────────

/**
 * Deletion goes through `soft_delete_voucher` / `restore_voucher` rather than a
 * direct UPDATE.
 *
 * A plain update cannot work: `vouchers_update` requires `deleted_at is null`,
 * so a binned row is invisible to it and restore always failed. The functions
 * also audit the transition and let an admin bin a voucher that has already
 * entered the approval workflow, which the edit policy forbids by design.
 */
export async function softDeleteVoucher(id: string, reason?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('soft_delete_voucher', {
    p_id: id,
    p_reason: reason?.trim() || null,
  });

  if (error) return { ok: false, error: toMessage(error, 'Could not delete this voucher.') };
  refresh(id);
  return { ok: true, data: undefined };
}

export async function restoreVoucher(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('restore_voucher', { p_id: id });

  if (error) return { ok: false, error: toMessage(error, 'Could not restore this voucher.') };
  refresh(id);
  return { ok: true, data: undefined };
}
