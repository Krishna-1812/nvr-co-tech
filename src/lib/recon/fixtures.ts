import type { Ledger, Txn } from './types';

/**
 * Ledger builders for the test suite.
 *
 * Kept out of the test files because six of them build the same two shapes, and
 * a fixture that drifts between suites is how you end up with a test that passes
 * for the wrong reason.
 *
 * April 2026 by default, matching the worked example in the tool's own
 * documentation, so a failing test can be checked against a statement someone
 * has already worked out by hand.
 */

export function txn(
  day: number | null,
  particular: string,
  extra: Partial<Omit<Txn, 'particular'>> & { month?: number; year?: number } = {},
): Txn {
  const { month = 4, year = 2026, ...fields } = extra;
  const date =
    day === null
      ? null
      : `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return {
    date,
    particular,
    debit: 0,
    credit: 0,
    row: null,
    ...fields,
  };
}

export function ledger(
  name: string,
  opening: number,
  transactions: Txn[],
  closing: number | null = null,
): Ledger {
  return {
    name,
    openingBalance: opening,
    openingBalanceDetected: true,
    openingDate: '2026-04-01',
    closingBalance: closing,
    closingDate: null,
    transactions,
    sourceFilename: null,
  };
}

/**
 * The worked example the engine was designed against.
 *
 * Ledger A closes at 10,05,000 Dr and Ledger B at 10,02,000 Dr. The gap is
 * explained by exactly two things: a cheque of 2,000 that only A has debited,
 * and bank charges of 1,000 that only B has credited. Reconciling either way
 * round must tie out to zero.
 */
export function specLedgers(): [Ledger, Ledger] {
  return [
    ledger('Company', 1_000_000, [
      txn(5, 'Sales receipt', { debit: 3_000 }),
      txn(10, 'Cheque issued #4471', { debit: 2_000 }),
    ]),
    ledger('Bank', 1_000_000, [
      txn(5, 'Sales receipt', { debit: 3_000 }),
      txn(20, 'Bank charges', { credit: 1_000 }),
    ]),
  ];
}
