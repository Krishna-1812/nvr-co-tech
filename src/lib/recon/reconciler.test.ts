import { describe, expect, it } from 'vitest';
import { ledger, specLedgers, txn } from './fixtures';
import { reconcile } from './reconciler';
import type { Ledger, LedgerKey } from './types';

const RECON = '2026-04-30';

const run = (
  a: Ledger,
  b: Ledger,
  startingLedger: LedgerKey = 'A',
  toleranceDays: number | null = null,
) => reconcile(a, b, { reconciliationDate: RECON, startingLedger, toleranceDays });

describe('the worked example', () => {
  it('walks Ledger A to Ledger B and ties out', () => {
    const [a, b] = specLedgers();
    const { statement } = run(a, b);

    expect(statement.startingBalance).toBe(1_005_000);
    expect(statement.startingBalanceType).toBe('Dr');
    expect(statement.targetClosing).toBe(1_002_000);
    expect(statement.calculatedClosing).toBe(1_002_000);
    expect(statement.variance).toBe(0);
    expect(statement.status).toBe('RECONCILED');

    // Two Less lines: A's excess debit and B's excess credit.
    expect(statement.lines).toHaveLength(2);
    expect(statement.lines.every((l) => l.operation === 'less')).toBe(true);
    expect(statement.lines.map((l) => l.amount).sort((x, y) => x - y)).toEqual([1_000, 2_000]);
  });

  it('reconciles the other way round with the signs mirrored', () => {
    const [a, b] = specLedgers();
    const { statement } = run(a, b, 'B');

    expect(statement.startingBalance).toBe(1_002_000);
    expect(statement.targetClosing).toBe(1_005_000);
    expect(statement.calculatedClosing).toBe(1_005_000);
    expect(statement.variance).toBe(0);
    expect(statement.lines.every((l) => l.operation === 'add')).toBe(true);
  });
});

describe('each kind of difference', () => {
  it('leaves a clean pair with no lines at all', () => {
    const result = run(
      ledger('A', 1_000_000, [txn(5, 'Sales', { debit: 10_000 })]),
      ledger('B', 1_000_000, [txn(5, 'Sales', { debit: 10_000 })]),
    );
    expect(result.statement.lines).toEqual([]);
    expect(result.statement.isReconciled).toBe(true);
    expect(result.counts.MATCHED).toBe(1);
  });

  it('folds a timing difference in so the books still tie out', () => {
    const result = run(
      ledger('A', 1_000_000, [txn(11, 'Money sent', { debit: 10_000 })]),
      ledger('B', 1_000_000, [txn(2, 'Money sent', { debit: 10_000, month: 5 })]),
    );
    expect(result.counts.TIMING).toBe(1);
    expect(result.statement.variance).toBe(0);
    expect(result.statement.lines).toHaveLength(1);
    expect(result.statement.lines[0].category).toBe('TIMING');
    expect(result.statement.lines[0].operation).toBe('less');
  });

  it('folds an amount difference in and still itemises both figures', () => {
    const result = run(
      ledger('A', 1_000_000, [txn(11, 'Consulting fee', { debit: 5_000 })]),
      ledger('B', 1_000_000, [txn(11, 'Consulting fee', { debit: 4_500 })]),
    );
    expect(result.counts.AMOUNT_DIFF).toBe(1);
    // Folded, so it ties out rather than leaving a variance nobody explained.
    expect(result.statement.variance).toBe(0);
    expect(result.statement.status).toBe('RECONCILED');
    expect(result.statement.lines).toHaveLength(1);
    expect(result.statement.lines[0].amount).toBe(500);
    // And still listed with both sides, which is what you investigate from.
    const [difference] = result.differences;
    expect(difference.category).toBe('AMOUNT_DIFF');
    expect(difference.difference).toBe(500);
    expect([difference.ledgerAAmount, difference.ledgerBAmount]).toEqual([5_000, 4_500]);
  });

  it('shows an opening balance difference as its own line', () => {
    const result = run(
      ledger('A', 1_000_000, [txn(5, 'Sales', { debit: 10_000 })]),
      ledger('B', 1_002_000, [txn(5, 'Sales', { debit: 10_000 })]),
    );
    expect(
      result.statement.lines.some((l) => l.description.includes('Opening balance difference')),
    ).toBe(true);
    expect(result.statement.variance).toBe(0);
  });
});

describe('a credit starting balance', () => {
  it('mirrors the adjustment signs', () => {
    const result = run(
      ledger('A', 0, [
        txn(5, 'Loan received', { credit: 100_000 }),
        txn(10, 'Extra credit', { credit: 5_000 }),
      ]),
      ledger('B', 0, [txn(5, 'Loan received', { credit: 100_000 })]),
    );
    const { statement } = result;
    expect(statement.startingBalanceType).toBe('Cr');
    expect(statement.startingBalance).toBe(105_000);
    expect(statement.targetClosing).toBe(100_000);
    expect(statement.variance).toBe(0);
    // Starting from a credit balance, A's extra credit reduces it.
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].operation).toBe('less');
    expect(statement.lines[0].amount).toBe(5_000);
  });
});

describe('contra ledgers', () => {
  it('reconciles a genuine mirror pair to zero', () => {
    const result = run(
      ledger('A', 10_000, [
        txn(5, 'To Sales', { debit: 5_000 }),
        txn(9, 'To Sales', { debit: 3_000 }),
      ]),
      ledger('B', -10_000, [
        txn(5, 'By Purchases', { credit: 5_000 }),
        txn(9, 'By Purchases', { credit: 3_000 }),
      ]),
    );
    expect(result.statement.startingBalanceType).toBe('Dr');
    expect(result.statement.targetClosingType).toBe('Cr');
    expect(result.statement.variance).toBe(0);
    expect(result.counts.MATCHED).toBe(2);
  });

  it('does not mistake a timing flip for a mirror', () => {
    /*
     * Both books open Dr 12,000 and record the same way round, but A has a late
     * debit B has not booked, so A closes Dr and B closes Cr. Deciding mirror
     * from the closing type would invert B's whole space, invent an opening
     * difference of twice the opening, and leave a variance out of nowhere.
     */
    const result = run(
      ledger('A', 12_000, [
        txn(5, 'Fees', { debit: 8_000 }),
        txn(8, 'Receipt', { credit: 25_000 }),
        txn(20, 'Fees late', { debit: 15_000 }),
      ]),
      ledger('B', 12_000, [
        txn(5, 'Fees', { debit: 8_000 }),
        txn(8, 'Receipt', { credit: 25_000 }),
      ]),
    );
    expect(result.statement.startingBalanceType).toBe('Dr');
    expect(result.statement.targetClosingType).toBe('Cr');
    expect(
      result.statement.lines.some((l) => l.description.includes('Opening balance difference')),
    ).toBe(false);
    expect(result.statement.variance).toBe(0);
    expect(result.counts.ONE_SIDED).toBe(1);
  });
});

describe('the tolerance window', () => {
  it('splits an out-of-tolerance pair into two offsetting legs', () => {
    const result = run(
      ledger('A', 1_000_000, [txn(10, 'Payment', { debit: 10_000 })]),
      ledger('B', 1_000_000, [txn(20, 'Payment', { debit: 10_000 })]),
      'A',
      5,
    );
    const { statement } = result;

    // Labelled and counted as one-sided, because that is how it gets chased.
    expect(result.counts.ONE_SIDED).toBe(1);
    expect(result.counts.TIMING).toBe(0);
    expect(result.counts.MATCHED).toBe(0);

    expect(statement.lines).toHaveLength(2);
    expect(new Set(statement.lines.map((l) => l.operation))).toEqual(new Set(['add', 'less']));
    expect(statement.lines.every((l) => l.amount === 10_000)).toBe(true);
    expect(statement.lines.every((l) => /out of tolerance/i.test(l.description))).toBe(true);

    // The legs cancel, so the balances are untouched and it still ties out.
    const net = statement.lines.reduce(
      (sum, l) => sum + (l.operation === 'add' ? l.amount : -l.amount),
      0,
    );
    expect(net).toBe(0);
    expect(statement.variance).toBe(0);
    expect(statement.toleranceDays).toBe(5);

    // Listed with BOTH amounts, which is how it reads apart from a real one-sided.
    const item = result.differences.find((d) => d.category === 'ONE_SIDED');
    expect([item?.ledgerAAmount, item?.ledgerBAmount]).toEqual([10_000, 10_000]);
    expect(item?.note.toLowerCase()).toContain('tolerance');
  });

  it('leaves the same data matched when no tolerance is set', () => {
    const result = run(
      ledger('A', 1_000_000, [txn(10, 'Payment', { debit: 10_000 })]),
      ledger('B', 1_000_000, [txn(20, 'Payment', { debit: 10_000 })]),
    );
    expect(result.counts.MATCHED).toBe(1);
    expect(result.counts.TIMING).toBe(0);
    expect(result.statement.variance).toBe(0);
  });
});

describe('a ledger that disagrees with itself', () => {
  it('is the one thing reconciling cannot fix, so it comes back partial', () => {
    const result = run(
      ledger('A', 1_000_000, [txn(5, 'Sales', { debit: 10_000 })], 1_010_000),
      ledger('B', 1_000_000, [txn(5, 'Sales', { debit: 10_000 })], 999_999),
    );
    expect(result.statement.status).toBe('PARTIAL');
    expect(result.statement.isReconciled).toBe(false);
  });
});
