import type { BalanceType, Txn } from './types';

/**
 * The four questions the engine asks about a single line.
 *
 * They live here, alone, for one reason: `isPostedAsOf` is used by the balance
 * calculator *and* by the matcher, and the reconciliation identity only holds
 * while both agree. If the calculator counted a pending cheque and the matcher
 * did not, the statement would come out with a residual variance that no listed
 * difference accounts for, and nobody would ever find the cause.
 */

/** The magnitude of the line: the debit if it has one, else the credit. */
export function amountOf(txn: Txn): number {
  return txn.debit ? txn.debit : txn.credit;
}

/** Which side it is on. A zero line counts as a debit, arbitrarily but stably. */
export function sideOf(txn: Txn): BalanceType {
  return txn.debit >= txn.credit ? 'Dr' : 'Cr';
}

/** Its contribution to a debit-positive balance. */
export function signedOf(txn: Txn): number {
  return txn.debit - txn.credit;
}

/**
 * The date that governs timing: when it cleared, if the file says, else when it
 * was posted. A cheque written on the 26th and cleared on the 3rd is not in the
 * bank's April, and the clearing date is the only column that knows that.
 */
export function effectiveDateOf(txn: Txn): string | null {
  return txn.clearingDate ?? txn.date;
}

/** Whether it belongs in a balance at all. A reversal is economically void. */
export function countsInBalance(txn: Txn): boolean {
  return txn.status !== 'REVERSED';
}

/**
 * Whether the line is effective as of the reconciliation date.
 *
 * A stated status beats a date, because it is the ledger's own assertion about
 * something a date can only imply. With no status column at all this reduces to
 * "undated, or dated on or before the reconciliation date".
 *
 * An undated line counts as posted. That is deliberate: excluding it would move
 * the balance by an amount with nothing on screen to explain it, whereas
 * including it shows up in the figures and the validator warns about the missing
 * date separately.
 */
export function isPostedAsOf(txn: Txn, reconDate: string): boolean {
  if (txn.status === 'REVERSED') return false;
  if (txn.status === 'CLEARED') return true;
  if (txn.status === 'PENDING' || txn.status === 'HOLD') return false;

  const effective = effectiveDateOf(txn);
  return effective === null || effective <= reconDate;
}
