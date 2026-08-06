import { describe, expect, it } from 'vitest';
import { balanceTypeOf, buildSummary, signedBalance, transactionsUpto } from './calculator';
import { ledger, txn } from './fixtures';

const RECON = '2026-04-30';

describe('transactionsUpto', () => {
  it('keeps what is effective and drops what is not', () => {
    const lines = [
      txn(5, 'Before', { debit: 100 }),
      txn(30, 'On the day', { debit: 100 }),
      txn(2, 'After', { debit: 100, month: 5 }),
    ];
    expect(transactionsUpto(lines, RECON).map((t) => t.particular)).toEqual([
      'Before',
      'On the day',
    ]);
  });

  it('counts an undated line as posted rather than dropping it silently', () => {
    // Excluding it would move the balance with nothing on screen to explain it.
    expect(transactionsUpto([txn(null, 'Undated', { debit: 100 })], RECON)).toHaveLength(1);
  });

  it('honours a clearing date over the posting date', () => {
    const late = txn(11, 'Cheque', { debit: 100, clearingDate: '2026-05-20' });
    expect(transactionsUpto([late], RECON)).toHaveLength(0);
  });

  it('honours a stated status over both dates', () => {
    expect(transactionsUpto([txn(5, 'Held', { debit: 100, status: 'HOLD' })], RECON)).toHaveLength(0);
    expect(
      transactionsUpto([txn(2, 'Cleared early', { debit: 100, month: 5, status: 'CLEARED' })], RECON),
    ).toHaveLength(1);
  });
});

describe('signedBalance', () => {
  it('applies the one rule: opening plus debits less credits', () => {
    const book = ledger('A', 1_000_000, [
      txn(5, 'Receipt', { debit: 50_000 }),
      txn(15, 'Rent', { credit: 5_000 }),
    ]);
    expect(signedBalance(book, RECON)).toBe(1_045_000);
  });

  it('goes negative for a credit balance, which is how Cr is decided', () => {
    const book = ledger('A', 0, [txn(5, 'Loan received', { credit: 100_000 })]);
    expect(signedBalance(book, RECON)).toBe(-100_000);
    expect(balanceTypeOf(-100_000)).toBe('Cr');
    expect(balanceTypeOf(0)).toBe('Dr');
  });
});

describe('buildSummary', () => {
  it('reports the closing as a magnitude with its side beside it', () => {
    const book = ledger('Bank', 0, [txn(5, 'Loan received', { credit: 100_000 })]);
    const summary = buildSummary(book, 'B', RECON);
    expect(summary.calculatedClosing).toBe(100_000);
    expect(summary.calculatedClosingSigned).toBe(-100_000);
    expect(summary.balanceType).toBe('Cr');
  });

  it('checks a stated closing against every line, not just the posted ones', () => {
    // The stated figure is "as on" the ledger's own closing date, which is later
    // than the reconciliation date here.
    const book = ledger(
      'A',
      1_000_000,
      [txn(5, 'Sales', { debit: 10_000 }), txn(2, 'Later sales', { debit: 5_000, month: 5 })],
      1_015_000,
    );
    expect(buildSummary(book, 'A', RECON).closingMatchesProvided).toBe(true);
  });

  it('leaves a reversed line out of the stated-closing check too', () => {
    // Otherwise this check and the reconciliation use different totals, and a
    // clean pair drops to PARTIAL for no visible reason.
    const book = ledger(
      'A',
      1_000_000,
      [txn(5, 'Sales', { debit: 10_000 }), txn(6, 'Duplicate', { debit: 9_999, status: 'REVERSED' })],
      1_010_000,
    );
    expect(buildSummary(book, 'A', RECON).closingMatchesProvided).toBe(true);
  });

  it('says nothing when the file stated no closing', () => {
    const book = ledger('A', 1_000, [txn(5, 'Sales', { debit: 10 })]);
    expect(buildSummary(book, 'A', RECON).closingMatchesProvided).toBeNull();
  });
});
