'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ReconResult } from '@/lib/recon/types';
import type { ActionResult } from './workflow';

/**
 * Keeping a reconciliation.
 *
 * The engine runs in the browser and the two ledger files never leave the
 * machine, so this is the one thing that reaches the server: the finished
 * statement. That is a deliberate line. What is stored is a conclusion about
 * two files, not the files, and somebody deleting a saved run here is not
 * deleting anything they still need.
 */

/**
 * The result, checked before it is trusted.
 *
 * The client computed this, so the server has no reason to believe any of it —
 * not because a user would forge their own working papers, but because a bug in
 * the wizard should fail here rather than write a shape the history page cannot
 * render. Only the fields the list actually reads are validated; `result` is
 * stored whole and is the client's problem to interpret on the way back out.
 */
function isStorable(result: ReconResult): boolean {
  const s = result?.statement;
  return Boolean(
    s &&
      typeof s.reconciliationDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(s.reconciliationDate) &&
      (s.startingLedger === 'A' || s.startingLedger === 'B') &&
      ['RECONCILED', 'PARTIAL', 'NOT_RECONCILED'].includes(s.status) &&
      Number.isFinite(s.variance) &&
      Number.isFinite(s.startingBalance) &&
      Number.isFinite(s.calculatedClosing) &&
      result.counts !== undefined,
  );
}

export async function saveReconciliation(
  result: ReconResult,
): Promise<ActionResult<{ id: string }>> {
  if (!isStorable(result)) {
    return { ok: false, error: 'That reconciliation is not in a state that can be saved.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { statement } = result;

  const { data, error } = await supabase
    .from('reconciliations')
    .insert({
      created_by: user.id,
      ledger_a_name: result.summaryA.name,
      ledger_b_name: result.summaryB.name,
      reconciliation_date: statement.reconciliationDate,
      starting_ledger: statement.startingLedger,
      tolerance_days: statement.toleranceDays,
      status: statement.status,
      variance: statement.variance,
      starting_balance: statement.startingBalance,
      closing_balance: statement.calculatedClosing,
      matched_count: result.counts.MATCHED,
      timing_count: result.counts.TIMING,
      one_sided_count: result.counts.ONE_SIDED,
      amount_diff_count: result.counts.AMOUNT_DIFF,
      result,
    })
    .select('id')
    .single();

  if (error || !data) {
    /*
     * The likeliest cause by far is that migration 0008 has not been applied to
     * this project yet, and the table simply is not there. Saying so is more use
     * than "could not save", because the person reading it can act on it — and
     * the reconciliation on their screen is unaffected either way.
     */
    const missing = error?.message?.includes('reconciliations') ?? false;
    return {
      ok: false,
      error: missing
        ? 'History is not switched on for this project yet. The reconciliation on screen is fine, and you can still export it.'
        : 'Could not save this reconciliation.',
    };
  }

  revalidatePath('/reconcile/history');
  return { ok: true, data: { id: data.id } };
}

export async function deleteReconciliation(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  // The `created_by` filter is belt and braces: the delete policy already scopes
  // this to your own rows, and a row you cannot see cannot be deleted.
  const { error } = await supabase
    .from('reconciliations')
    .delete()
    .eq('id', id)
    .eq('created_by', user.id);

  if (error) return { ok: false, error: 'Could not delete that reconciliation.' };

  revalidatePath('/reconcile/history');
  return { ok: true, data: undefined };
}
