import { describe, expect, it } from 'vitest';
import { ledger, txn } from './fixtures';
import { errorsOf, validate, validateLedger, warningsOf } from './validator';

const messages = (ledgerUnderTest: Parameters<typeof validateLedger>[0]) =>
  validateLedger(ledgerUnderTest, 'A').map((i) => `${i.severity}: ${i.message}`);

describe('what blocks a run', () => {
  it('refuses a file with nothing readable in it', () => {
    const issues = validateLedger(ledger('A', 1_000, []), 'A');
    expect(issues.some((i) => i.severity === 'error' && /no transactions/.test(i.message))).toBe(
      true,
    );
  });

  it('refuses a row that is both a debit and a credit', () => {
    const issues = validateLedger(
      ledger('A', 0, [txn(5, 'Confused', { debit: 100, credit: 40, row: 7 })]),
      'A',
    );
    expect(issues.some((i) => i.severity === 'error' && /both a debit and a credit/.test(i.message))).toBe(
      true,
    );
  });

  it('refuses a blank narration', () => {
    const issues = validateLedger(ledger('A', 0, [txn(5, '   ', { debit: 100 })]), 'A');
    expect(issues.some((i) => i.severity === 'error' && /Particular is blank/.test(i.message))).toBe(
      true,
    );
  });
});

describe('what is only worth saying', () => {
  it('warns when the opening balance had to be assumed', () => {
    const book = { ...ledger('A', 0, [txn(5, 'Sales', { debit: 100 })]), openingBalanceDetected: false };
    expect(messages(book).some((m) => m.startsWith('warning') && /no opening balance/.test(m))).toBe(
      true,
    );
  });

  it('warns about a line with no date, and says what will happen to it', () => {
    const issues = validateLedger(ledger('A', 0, [txn(null, 'Undated', { debit: 100 })]), 'A');
    const issue = issues.find((i) => i.field === 'date');
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('counts as posted');
  });

  it('warns about a row carrying no amount at all', () => {
    const issues = validateLedger(ledger('A', 0, [txn(5, 'Note to self')]), 'A');
    expect(issues.some((i) => i.severity === 'warning' && /no debit or credit/.test(i.message))).toBe(
      true,
    );
  });

  it('warns when the stated closing does not follow from the lines', () => {
    const book = ledger('A', 1_000_000, [txn(5, 'Sales', { debit: 10_000 })], 999_999);
    expect(messages(book).some((m) => /stated closing balance/.test(m))).toBe(true);
  });

  it('accepts a stated closing that does follow', () => {
    const book = ledger('A', 1_000_000, [txn(5, 'Sales', { debit: 10_000 })], 1_010_000);
    expect(messages(book).some((m) => /stated closing balance/.test(m))).toBe(false);
  });
});

describe('the running balance column', () => {
  it('accepts a ledger where a debit raises the balance', () => {
    const book = ledger('A', 0, [
      txn(1, 'One', { debit: 100, balance: 100 }),
      txn(2, 'Two', { debit: 50, balance: 150 }),
      txn(3, 'Three', { credit: 30, balance: 120 }),
    ]);
    expect(messages(book).some((m) => /Balance column/.test(m))).toBe(false);
  });

  it('accepts a bank statement where a debit lowers it', () => {
    // Both conventions are correct. Only inconsistency is a problem.
    const book = ledger('A', 0, [
      txn(1, 'One', { debit: 100, balance: -100 }),
      txn(2, 'Two', { debit: 50, balance: -150 }),
      txn(3, 'Three', { credit: 30, balance: -120 }),
    ]);
    expect(messages(book).some((m) => /Balance column/.test(m))).toBe(false);
  });

  it('flags a printed balance that does not move by its own row', () => {
    const book = ledger('A', 0, [
      txn(1, 'One', { debit: 100, balance: 100 }),
      txn(2, 'Two', { debit: 50, balance: 999 }),
    ]);
    expect(messages(book).some((m) => /Balance column/.test(m))).toBe(true);
  });

  it('says nothing when there is nothing to cross-check against', () => {
    const book = ledger('A', 0, [txn(1, 'One', { debit: 100, balance: 100 })]);
    expect(messages(book).some((m) => /Balance column/.test(m))).toBe(false);
  });
});

describe('validate', () => {
  it('reports both ledgers at once and blocks only on errors', () => {
    const clean = ledger('A', 0, [txn(5, 'Sales', { debit: 100 })]);
    const broken = ledger('B', 0, []);

    const good = validate(clean, clean);
    expect(good.isValid).toBe(true);
    expect(errorsOf(good)).toHaveLength(0);

    const bad = validate(clean, broken);
    expect(bad.isValid).toBe(false);
    expect(errorsOf(bad)).toHaveLength(1);
    expect(errorsOf(bad)[0].ledger).toBe('B');
  });

  it('does not let warnings block anything', () => {
    const book = ledger('A', 0, [txn(null, 'Undated', { debit: 100 })]);
    const result = validate(book, book);
    expect(warningsOf(result).length).toBeGreaterThan(0);
    expect(result.isValid).toBe(true);
  });
});
