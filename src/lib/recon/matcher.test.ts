import { describe, expect, it } from 'vitest';
import { txn } from './fixtures';
import { matchTransactions, type MatcherOptions } from './matcher';
import type { Txn } from './types';

const RECON = '2026-04-30';

const match = (a: Txn[], b: Txn[], options: Partial<MatcherOptions> = {}) =>
  matchTransactions(a, b, { reconDate: RECON, ...options });

describe('matching on narration and amount', () => {
  it('matches the same entry posted in both books', () => {
    const results = match([txn(11, 'Money sent', { debit: 10_000 })], [
      txn(12, 'Money sent', { debit: 10_000 }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('MATCHED');
  });

  it('calls it timing when only one side has posted it', () => {
    const results = match([txn(11, 'Money sent', { debit: 10_000 })], [
      txn(2, 'Money sent', { debit: 10_000, month: 5 }),
    ]);
    expect(results[0].category).toBe('TIMING');
    expect(results[0].aPosted).toBe(true);
    expect(results[0].bPosted).toBe(false);
  });

  it('calls it an amount difference when the figures disagree', () => {
    const results = match([txn(11, 'Consulting fee', { debit: 5_000 })], [
      txn(11, 'Consulting fee', { debit: 4_500 }),
    ]);
    expect(results[0].category).toBe('AMOUNT_DIFF');
  });

  it('reports an entry each book has alone as one-sided', () => {
    const results = match([txn(11, 'Cheque issued', { credit: 8_000 })], [
      txn(30, 'Bank interest', { debit: 200 }),
    ]);
    expect(results.map((r) => r.category)).toEqual(['ONE_SIDED', 'ONE_SIDED']);
    expect(results.find((r) => r.a !== null)?.b).toBeNull();
    expect(results.find((r) => r.b !== null)?.a).toBeNull();
  });

  it('never lets two entries claim the same counterpart', () => {
    const results = match(
      [txn(11, 'Fee', { debit: 1_000 }), txn(12, 'Fee', { debit: 1_000 })],
      [txn(11, 'Fee', { debit: 1_000 })],
    );
    expect(results.filter((r) => r.category === 'MATCHED')).toHaveLength(1);
    expect(results.filter((r) => r.category === 'ONE_SIDED')).toHaveLength(1);
  });
});

describe('matching on reference', () => {
  it('beats the narration, which the two books word differently anyway', () => {
    const results = match(
      [txn(2, 'To Sales', { debit: 8_500, reference: 'CHQ-100' })],
      [txn(2, 'By Purchases', { credit: 850, reference: 'CHQ100' })],
    );
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('AMOUNT_DIFF');
  });

  it('looks past leading zeros and punctuation', () => {
    const results = match(
      [txn(2, 'To Sales', { debit: 5_000, reference: '000123' })],
      [txn(2, 'Sales A/c', { debit: 5_000, reference: '123' })],
    );
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('MATCHED');
  });
});

describe('matching on amount alone', () => {
  it('pairs a contra entry the two books describe differently', () => {
    const results = match([txn(5, 'To Sales', { debit: 5_000 })], [
      txn(5, 'By Purchases', { credit: 5_000 }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('MATCHED');
  });

  it('lets the contra pass go first so a same-side coincidence cannot steal it', () => {
    // Both B entries are 5,000. Without the contra-first pass, "Other receipt"
    // could take the counterpart the genuine contra entry needed, and both would
    // be reported as one-sided.
    const results = match(
      [txn(5, 'To Sales', { debit: 5_000 })],
      [txn(9, 'Other receipt', { debit: 5_000 }), txn(5, 'By Purchases', { credit: 5_000 })],
    );
    const paired = results.find((r) => r.a !== null && r.b !== null);
    expect(paired?.b?.particular).toBe('By Purchases');
  });
});

describe('optional columns', () => {
  it('keeps a reversed line out entirely, so it is never one-sided noise', () => {
    const results = match(
      [
        txn(11, 'Real payment', { debit: 1_000 }),
        txn(12, 'Duplicate', { debit: 9_999, status: 'REVERSED' }),
      ],
      [txn(11, 'Real payment', { debit: 1_000 })],
    );
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('MATCHED');
  });

  it('treats a line clearing after the date as not yet posted', () => {
    const results = match([txn(11, 'Cheque', { debit: 10_000 })], [
      txn(11, 'Cheque', { debit: 10_000, clearingDate: '2026-05-20' }),
    ]);
    expect(results[0].category).toBe('TIMING');
    expect(results[0].bPosted).toBe(false);
  });

  it('treats a line the file marked pending as not yet posted', () => {
    const results = match([txn(11, 'Cheque', { debit: 10_000 })], [
      txn(11, 'Cheque', { debit: 10_000, status: 'PENDING' }),
    ]);
    expect(results[0].category).toBe('TIMING');
    expect(results[0].bPosted).toBe(false);
  });
});

describe('the timing tolerance window', () => {
  const withWindow = { toleranceDays: 5, earliestDate: '2026-04-01' };

  it('flags a counterpart that cleared outside the window', () => {
    // A posts on the 10th, so a ±5 day window is [5 Apr, 15 Apr]. B is the 20th.
    const results = match([txn(10, 'Payment', { debit: 10_000 })], [
      txn(20, 'Payment', { debit: 10_000 }),
    ], withWindow);
    expect(results[0].category).toBe('TIMING');
    expect(results[0].aPosted && results[0].bPosted).toBe(true);
    expect(results[0].withinWindow).toBe(false);
  });

  it('accepts one that cleared inside it', () => {
    const results = match([txn(10, 'Payment', { debit: 10_000 })], [
      txn(12, 'Payment', { debit: 10_000 }),
    ], withWindow);
    expect(results[0].category).toBe('MATCHED');
  });

  it('measures each pair against its own date, not against the period', () => {
    // Both counterparts clear eight days after their own entry. A window that
    // moved with the period rather than the entry would judge these differently.
    const results = matchTransactions(
      [txn(1, 'P1', { debit: 1_000, month: 5 }), txn(1, 'P2', { debit: 2_000, month: 6 })],
      [txn(9, 'P1', { debit: 1_000, month: 5 }), txn(9, 'P2', { debit: 2_000, month: 6 })],
      { reconDate: '2026-06-30', toleranceDays: 10, earliestDate: '2026-05-01' },
    );
    expect(results.every((r) => r.category === 'MATCHED')).toBe(true);
  });

  it('is off unless asked for', () => {
    const results = match([txn(10, 'Payment', { debit: 10_000 })], [
      txn(20, 'Payment', { debit: 10_000 }),
    ]);
    expect(results[0].category).toBe('MATCHED');
  });
});
