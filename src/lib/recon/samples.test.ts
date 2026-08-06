import { describe, expect, it } from 'vitest';
import { readCsv } from './parse/sheet';
import { parseRowsToLedger } from './parse/rows';
import { reconcile } from './reconciler';
import { SAMPLE_LEDGERS } from './samples';
import { validate } from './validator';
import type { Ledger } from './types';

/**
 * The samples, end to end.
 *
 * The one test in the suite that goes all the way from a file's bytes to a
 * finished statement, so the parser and the engine are checked against each
 * other rather than only against their own fixtures. It is also the guard on the
 * samples themselves: they are offered on the upload screen as the first thing
 * anybody sees, and a demo that comes back NOT RECONCILED is worse than no demo.
 */

function open(index: number, name: string): Ledger {
  const sample = SAMPLE_LEDGERS[index];
  const { rows, text } = readCsv(sample.csv);
  return parseRowsToLedger(rows, text, { name, filename: sample.filename });
}

describe('the sample ledgers', () => {
  const books = open(0, 'Company books');
  const bank = open(1, 'Bank statement');

  it('reads differently named columns in the two files', () => {
    // Particular against Narration, Debit against Withdrawal, Reference against
    // Cheque No. This is what actually arrives, and it has to work unedited.
    expect(books.transactions).toHaveLength(6);
    expect(bank.transactions).toHaveLength(6);
    expect(books.transactions[0].reference).toBe('UTR8891');
    expect(bank.transactions[0].reference).toBe('UTR8891');
  });

  it('reads the bank statement as the contra book it is', () => {
    // Money paid in is a credit on a bank statement, because the bank now owes
    // it to you. So the statement opens and closes on a credit balance.
    expect(books.openingBalance).toBe(1_000_000);
    expect(bank.openingBalance).toBe(-1_000_000);
    expect(bank.transactions[0]).toMatchObject({ debit: 0, credit: 50_000 });
    expect(books.transactions[0]).toMatchObject({ debit: 50_000, credit: 0 });
  });

  it('agrees with the closing balance each file states for itself', () => {
    const result = validate(books, bank);
    expect(result.isValid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('reconciles to zero with exactly the two differences it should have', () => {
    const result = reconcile(books, bank, {
      reconciliationDate: '2026-04-30',
      startingLedger: 'A',
    });
    const { statement } = result;

    expect(statement.startingBalance).toBe(1_024_500);
    expect(statement.startingBalanceType).toBe('Dr');
    expect(statement.targetClosing).toBe(1_032_700);
    expect(statement.targetClosingType).toBe('Cr');
    expect(statement.calculatedClosing).toBe(1_032_700);
    expect(statement.variance).toBe(0);
    expect(statement.status).toBe('RECONCILED');

    // Everything the two books share is matched, across four different routes:
    // by reference, and by amount where only the side differs.
    expect(result.counts.MATCHED).toBe(5);
    expect(result.counts.ONE_SIDED).toBe(2);
    expect(result.counts.TIMING).toBe(0);
    expect(result.counts.AMOUNT_DIFF).toBe(0);

    // The unpresented cheque and the interest both ADD to the book balance to
    // arrive at the bank's, which is the textbook shape of this statement.
    expect(statement.lines).toHaveLength(2);
    expect(statement.lines.every((l) => l.operation === 'add')).toBe(true);
    expect(statement.lines.map((l) => l.amount).sort((a, b) => a - b)).toEqual([200, 8_000]);
  });

  it('raises no opening difference, because a mirrored opening is the same balance', () => {
    const result = reconcile(books, bank, {
      reconciliationDate: '2026-04-30',
      startingLedger: 'A',
    });
    expect(
      result.statement.lines.some((l) => l.description.includes('Opening balance difference')),
    ).toBe(false);
  });

  it('reconciles the same either way round', () => {
    const fromBank = reconcile(books, bank, {
      reconciliationDate: '2026-04-30',
      startingLedger: 'B',
    });
    expect(fromBank.statement.startingBalance).toBe(1_032_700);
    expect(fromBank.statement.targetClosing).toBe(1_024_500);
    expect(fromBank.statement.variance).toBe(0);
  });
});
