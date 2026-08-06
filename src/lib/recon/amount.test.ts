import { describe, expect, it } from 'vitest';
import {
  AmountError,
  amountsFromCells,
  formatINR,
  formatINRShort,
  parseAmount,
  signedAmountCell,
} from './amount';

describe('parseAmount', () => {
  it('reads Indian and western grouping the same way', () => {
    expect(parseAmount('10,00,000.50')).toBe(1_000_000.5);
    expect(parseAmount('1,000,000.50')).toBe(1_000_000.5);
  });

  it('strips currency symbols and whitespace', () => {
    expect(parseAmount('₹ 10,00,000')).toBe(1_000_000);
    expect(parseAmount('$1000')).toBe(1000);
  });

  it('treats blanks and dash placeholders as nothing', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('   ')).toBe(0);
    expect(parseAmount('-')).toBe(0);
    expect(parseAmount('–')).toBe(0);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
  });

  it('negates parentheses, which is the accountancy convention', () => {
    expect(parseAmount('(2,000)')).toBe(-2000);
    expect(parseAmount('(₹2,000.75)')).toBe(-2000.75);
  });

  it('passes numbers through', () => {
    expect(parseAmount(1234.5)).toBe(1234.5);
  });

  it('throws rather than quietly returning zero for text', () => {
    // A swallowed amount is a difference nobody would ever find.
    expect(() => parseAmount('not a number')).toThrow(AmountError);
  });
});

describe('signedAmountCell', () => {
  it('takes its sign from the column when unmarked', () => {
    expect(signedAmountCell('5,000', true)).toBe(5000);
    expect(signedAmountCell('5,000', false)).toBe(-5000);
  });

  it('lets a Dr/Cr marker on the figure beat the column it sits in', () => {
    // Tally prints a closing balance in the balancing column, so a credit
    // closing arrives in the Debit column. Believing the column flips a ledger.
    expect(signedAmountCell('20,650 Cr', true)).toBe(-20_650);
    expect(signedAmountCell('20,650 Dr', false)).toBe(20_650);
  });

  it('is zero for an empty cell', () => {
    expect(signedAmountCell('   ', true)).toBe(0);
  });
});

describe('amountsFromCells', () => {
  it('returns magnitudes on the side the column implies', () => {
    expect(amountsFromCells('5,000', '')).toEqual({ debit: 5000, credit: 0 });
    expect(amountsFromCells('', '5,000')).toEqual({ debit: 0, credit: 5000 });
  });

  it('honours a marker that contradicts the column', () => {
    expect(amountsFromCells('15000 Cr', '')).toEqual({ debit: 0, credit: 15_000 });
  });

  it('keeps a row that filled in both columns as both, for the validator to reject', () => {
    expect(amountsFromCells('100', '40')).toEqual({ debit: 100, credit: 40 });
  });
});

describe('formatINR', () => {
  it('groups by lakh and crore', () => {
    expect(formatINR(1_005_000)).toBe('₹10,05,000.00');
    expect(formatINR(999)).toBe('₹999.00');
    expect(formatINR(1_00_00_000)).toBe('₹1,00,00,000.00');
  });

  it('puts the sign outside the symbol', () => {
    expect(formatINR(-2500.5)).toBe('-₹2,500.50');
  });

  it('never renders a negative zero', () => {
    expect(formatINR(-0)).toBe('₹0.00');
  });

  it('can drop the symbol for use inside a sentence', () => {
    expect(formatINR(5000, { symbol: false })).toBe('5,000.00');
  });

  it('drops the paise in the short form', () => {
    expect(formatINRShort(1_005_000.4)).toBe('₹10,05,000');
  });
});
