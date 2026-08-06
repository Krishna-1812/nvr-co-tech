import { AMOUNT_TOLERANCE, money } from './config';
import { maxDate, minDate } from './dates';
import type { BalanceType, Ledger, LedgerKey, LedgerSummary, Txn } from './types';
import { countsInBalance, isPostedAsOf, signedOf } from './txn';

/**
 * Balances, and the one rule the whole engine rests on:
 *
 *     Closing = Opening + Σ Debits − Σ Credits
 *
 * That holds for every ledger ever written, which is why nothing here branches
 * on what kind of account it is. Everything is computed debit-positive: a
 * positive balance is a Dr balance, a negative one is Cr, and no code has to be
 * told which.
 */

/** The lines that are effective on or before the reconciliation date. */
export function transactionsUpto(transactions: Txn[], reconDate: string): Txn[] {
  return transactions.filter((t) => isPostedAsOf(t, reconDate));
}

/** The signed closing balance as of a date. */
export function signedBalance(ledger: Ledger, reconDate: string): number {
  const movement = transactionsUpto(ledger.transactions, reconDate).reduce(
    (sum, t) => sum + signedOf(t),
    0,
  );
  return money(ledger.openingBalance + movement);
}

/**
 * The span a ledger covers.
 *
 * Falls back to the opening and closing dates so a ledger whose lines are all
 * undated still offers something to reconcile to, rather than nothing.
 */
export function ledgerMinDate(ledger: Ledger): string | null {
  return minDate(ledger.transactions.map((t) => t.date)) ?? ledger.openingDate;
}

export function ledgerMaxDate(ledger: Ledger): string | null {
  return maxDate(ledger.transactions.map((t) => t.date)) ?? ledger.closingDate;
}

/** Dr at or above zero, Cr below. The only place this is decided. */
export function balanceTypeOf(signed: number): BalanceType {
  return signed >= 0 ? 'Dr' : 'Cr';
}

/** One ledger's whole arithmetic, as of the reconciliation date. */
export function buildSummary(ledger: Ledger, key: LedgerKey, reconDate: string): LedgerSummary {
  const included = transactionsUpto(ledger.transactions, reconDate);
  const totalDebits = money(included.reduce((sum, t) => sum + t.debit, 0));
  const totalCredits = money(included.reduce((sum, t) => sum + t.credit, 0));
  const signed = money(ledger.openingBalance + totalDebits - totalCredits);

  /*
   * The stated closing is checked against ALL the transactions, not just the
   * ones up to the reconciliation date: the figure the file printed is "as on"
   * its own closing date, which is usually later. Reversed lines are excluded
   * here for the same reason they are excluded from the reconciliation — if the
   * two totals were built differently this check would flag a mismatch that
   * does not exist, and wrongly drop the whole run to PARTIAL.
   */
  let closingMatchesProvided: boolean | null = null;
  if (ledger.closingBalance !== null) {
    const fullSigned = money(
      ledger.openingBalance +
        ledger.transactions.filter(countsInBalance).reduce((sum, t) => sum + signedOf(t), 0),
    );
    closingMatchesProvided =
      Math.abs(Math.abs(fullSigned) - Math.abs(ledger.closingBalance)) <= AMOUNT_TOLERANCE;
  }

  return {
    key,
    name: ledger.name,
    openingBalance: money(ledger.openingBalance),
    totalDebits,
    totalCredits,
    calculatedClosing: money(Math.abs(signed)),
    calculatedClosingSigned: signed,
    balanceType: balanceTypeOf(signed),
    providedClosing: ledger.closingBalance,
    closingMatchesProvided,
    transactionCount: included.length,
  };
}
