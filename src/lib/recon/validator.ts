import { formatINR } from './amount';
import { AMOUNT_TOLERANCE, MAX_TRANSACTIONS, money } from './config';
import type { Ledger, LedgerKey, ValidationIssue, ValidationResult } from './types';
import { countsInBalance, signedOf } from './txn';

/**
 * What is wrong with the files, all of it at once.
 *
 * Nothing here throws. A ledger export usually has several problems and they are
 * all fixed in the same trip back to whoever produced it, so this collects
 * everything rather than stopping at the first thing it finds.
 *
 * The line between an error and a warning is whether the reconciliation would
 * mean anything. No transactions at all, or a row that is both a debit and a
 * credit, means the file cannot be read as a ledger: error, and the run is
 * blocked. A missing date or an opening balance that had to be assumed skews the
 * answer without invalidating it: warning, said plainly, and the run continues.
 */

export function validateLedger(ledger: Ledger, key: LedgerKey): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (ledger.transactions.length === 0) {
    issues.push({
      ledger: key,
      severity: 'error',
      message:
        `Ledger ${key}: no transactions could be read. Check that the file has ` +
        `Date, Particular, Debit and Credit columns.`,
    });
  }

  if (ledger.transactions.length > MAX_TRANSACTIONS) {
    issues.push({
      ledger: key,
      severity: 'error',
      message:
        `Ledger ${key}: ${ledger.transactions.length.toLocaleString('en-IN')} transactions is ` +
        `over the limit of ${MAX_TRANSACTIONS.toLocaleString('en-IN')}. Split the file by period.`,
    });
  }

  // No opening line was found, so the balance silently became zero — which would
  // shift the entire reconciliation by the opening amount. A warning rather than
  // an error, because a genuinely nil-opening ledger is a real thing.
  if (ledger.transactions.length > 0 && !ledger.openingBalanceDetected) {
    issues.push({
      ledger: key,
      field: 'openingBalance',
      severity: 'warning',
      message:
        `Ledger ${key}: no opening balance was found, so it has been taken as zero. ` +
        `If the ledger has one, add an "Opening Balance" line and upload it again.`,
    });
  }

  for (const txn of ledger.transactions) {
    const row = txn.row;

    if (!txn.particular.trim()) {
      issues.push({
        ledger: key,
        row,
        field: 'particular',
        severity: 'error',
        message: `Ledger ${key} row ${row}: the Particular is blank.`,
      });
    }

    if (txn.debit > 0 && txn.credit > 0) {
      issues.push({
        ledger: key,
        row,
        field: 'debit/credit',
        severity: 'error',
        message:
          `Ledger ${key} row ${row}: this row has both a debit and a credit amount. ` +
          `Each line has to be one or the other.`,
      });
    }

    if (txn.debit === 0 && txn.credit === 0) {
      issues.push({
        ledger: key,
        row,
        field: 'debit/credit',
        severity: 'warning',
        message: `Ledger ${key} row ${row}: "${txn.particular}" has no debit or credit amount.`,
      });
    }

    if (txn.date === null) {
      issues.push({
        ledger: key,
        row,
        field: 'date',
        severity: 'warning',
        message:
          `Ledger ${key} row ${row}: "${txn.particular}" has no readable date, ` +
          `so it counts as posted on any reconciliation date.`,
      });
    }
  }

  // The file's own arithmetic: does its stated closing follow from its lines?
  // Reversed lines are left out here for the same reason they are left out of
  // the balance, so this check and the reconciliation are looking at one total.
  if (ledger.closingBalance !== null) {
    const movement = ledger.transactions
      .filter(countsInBalance)
      .reduce((sum, t) => sum + signedOf(t), 0);
    const calculated = money(ledger.openingBalance + movement);
    if (Math.abs(Math.abs(calculated) - Math.abs(ledger.closingBalance)) > AMOUNT_TOLERANCE) {
      issues.push({
        ledger: key,
        severity: 'warning',
        message:
          `Ledger ${key}: the stated closing balance (${formatINR(Math.abs(ledger.closingBalance))}) ` +
          `does not follow from its own transactions (${formatINR(Math.abs(calculated))}). ` +
          `The reconciliation will flag this.`,
      });
    }
  }

  issues.push(...validateRunningBalance(ledger, key));

  return issues;
}

/**
 * Cross-check a running Balance column against the movements beside it.
 *
 * This never feeds the reconciliation — the debit and credit columns do — but a
 * printed balance that does not move by its own row's amount means the extract
 * is missing lines, and that is worth knowing before you reconcile to it.
 *
 * Which direction a debit moves the balance is worked out from the first real
 * movement rather than assumed, because a ledger raises the balance on a debit
 * and a bank statement lowers it. Both are correct; only inconsistency is a
 * problem, so only inconsistency is reported.
 */
function validateRunningBalance(ledger: Ledger, key: LedgerKey): ValidationIssue[] {
  const points: { row: number | null; printed: number; cumulative: number }[] = [];
  let cumulative = 0;
  for (const txn of ledger.transactions) {
    cumulative += signedOf(txn);
    if (txn.balance !== null && txn.balance !== undefined) {
      points.push({ row: txn.row, printed: txn.balance, cumulative: money(cumulative) });
    }
  }

  if (points.length < 2) return [];

  let direction = 0;
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const printedDelta = current.printed - previous.printed;
    const movement = current.cumulative - previous.cumulative;

    if (Math.abs(movement) <= AMOUNT_TOLERANCE) {
      // Nothing moved, so the printed balance must not have moved either.
      if (Math.abs(printedDelta) > AMOUNT_TOLERANCE) return [balanceIssue(key, current.row)];
      continue;
    }

    let step: number;
    if (Math.abs(printedDelta - movement) <= AMOUNT_TOLERANCE) step = 1;
    else if (Math.abs(printedDelta + movement) <= AMOUNT_TOLERANCE) step = -1;
    else return [balanceIssue(key, current.row)];

    if (direction === 0) direction = step;
    else if (step !== direction) return [balanceIssue(key, current.row)];
  }

  return [];
}

function balanceIssue(key: LedgerKey, row: number | null): ValidationIssue {
  return {
    ledger: key,
    row,
    field: 'balance',
    severity: 'warning',
    message:
      `Ledger ${key} row ${row}: the running Balance column does not move by this row's ` +
      `debit or credit. The reconciliation will use the debit and credit columns.`,
  };
}

/** Both ledgers, as one answer. */
export function validate(ledgerA: Ledger, ledgerB: Ledger): ValidationResult {
  const issues = [...validateLedger(ledgerA, 'A'), ...validateLedger(ledgerB, 'B')];
  return { isValid: !issues.some((i) => i.severity === 'error'), issues };
}

export function errorsOf(result: ValidationResult): ValidationIssue[] {
  return result.issues.filter((i) => i.severity === 'error');
}

export function warningsOf(result: ValidationResult): ValidationIssue[] {
  return result.issues.filter((i) => i.severity === 'warning');
}
