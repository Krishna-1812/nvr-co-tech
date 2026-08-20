'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notify';
import {
  awaitingApproval,
  sentBack,
  approved as approvedMail,
} from '@/lib/notify/templates';
import { fmtRupees } from '@/lib/domain/voucher';

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

  // Only when it is actually waiting on somebody. With approval off (0014)
  // submit pays the voucher outright, and there is nobody to tell.
  if (data?.status === 'pending_first' || data?.status === 'pending_second') {
    await tellApprovers(id);
  }

  refresh(id);
  return { ok: true, data: { voucherNo: data?.voucher_no ?? '' } };
}

/**
 * Tell everyone who could approve this that it is there.
 *
 * There is no assignment model — a submitted voucher enters a pool visible to
 * anyone with approver rank or above — so the notification goes to the same
 * pool, minus the person who raised it, who is not allowed to approve their own
 * work and does not need telling about it either.
 */
async function tellApprovers(id: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: voucher } = await supabase
      .from('vouchers')
      .select(
        'voucher_no, paid_to, grand_total, created_by, initiator:profiles!vouchers_initiated_by_fkey(full_name, email)',
      )
      .eq('id', id)
      .maybeSingle();
    if (!voucher) return;

    const { data: people } = await supabase
      .from('profiles')
      .select('email, role')
      .in('role', ['approver', 'admin', 'owner'])
      .neq('id', voucher.created_by);

    const to = (people ?? []).map((p) => p.email).filter((e): e is string => Boolean(e));
    if (to.length === 0) return;

    const raiser = voucher.initiator as { full_name?: string | null; email?: string | null } | null;

    notify({
      to,
      ...awaitingApproval({
        voucherNo: voucher.voucher_no,
        raisedBy: raiser?.full_name || raiser?.email || 'Someone',
        paidTo: voucher.paid_to,
        amount: fmtRupees(Number(voucher.grand_total ?? 0)),
      }),
    });
  } catch {
    // Never at the expense of the submission itself, which has already happened.
  }
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

  // Only once it is fully approved. Telling the raiser about a first approval
  // that still needs a second one is a message about nothing they can act on.
  if (data?.status === 'approved') await tellRaiser(parsed.data.id, 'approved');

  refresh(parsed.data.id);
  return { ok: true, data: { status: data?.status ?? '' } };
}

/**
 * Tell the person who raised a voucher what just happened to it.
 *
 * Reads the actor from the row's own columns rather than taking a name from the
 * caller, so the message can only ever say what the database recorded.
 */
async function tellRaiser(id: string, event: 'approved' | 'rejected'): Promise<void> {
  try {
    const supabase = await createClient();
    // One string literal, not a concatenation: supabase-js infers the row shape
    // from the select text itself, and cannot see through `+`.
    const { data: v } = await supabase
      .from('vouchers')
      .select(
        'voucher_no, rejection_reason, initiator:profiles!vouchers_initiated_by_fkey(full_name, email), raiser:profiles!vouchers_created_by_fkey(full_name, email), rejecter:profiles!vouchers_rejected_by_fkey(full_name, email), first_approver:profiles!vouchers_approver_1_fkey(full_name, email), second_approver:profiles!vouchers_approver_2_fkey(full_name, email)',
      )
      .eq('id', id)
      .maybeSingle();
    if (!v) return;

    type Person = { full_name?: string | null; email?: string | null } | null;
    const name = (p: Person) => p?.full_name || p?.email || 'Someone';

    const raiser = (v.raiser ?? v.initiator) as Person;
    const to = raiser?.email;
    if (!to) return;

    if (event === 'rejected') {
      notify({
        to,
        ...sentBack({
          voucherNo: v.voucher_no,
          by: name(v.rejecter as Person),
          reason: v.rejection_reason ?? 'No reason was recorded.',
          id,
        }),
      });
      return;
    }

    notify({
      to,
      ...approvedMail({
        voucherNo: v.voucher_no,
        by: name((v.second_approver ?? v.first_approver) as Person),
        id,
      }),
    });
  } catch {
    // The decision stands regardless of whether the message about it went out.
  }
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

  // The one message in the product nobody else can clear for the reader: their
  // voucher is back and only they can fix it.
  await tellRaiser(parsed.data.id, 'rejected');

  refresh(parsed.data.id);
  return { ok: true, data: undefined };
}

// ─── Withdraw ────────────────────────────────────────────────────────────────

/**
 * The raiser pulls their own voucher back out of the queue (0021).
 *
 * Until this existed, submitting was a one-way door: the person who raised a
 * voucher could not recall, cancel, edit or delete it, and their only route was
 * to find an approver out of band — there is no in-app channel — and ask to be
 * rejected. The fields most likely to be wrong are the hand-typed number and
 * the amounts, so it was a door people were always going to need back through.
 *
 * The database refuses once anybody has actually approved: from that point the
 * record is more than one person's, and taking it back quietly would erase
 * their part in it.
 */
export async function withdrawVoucher(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('withdraw_voucher', { p_id: id });

  if (error) return { ok: false, error: toMessage(error, 'Could not withdraw this voucher.') };
  refresh(id);
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
