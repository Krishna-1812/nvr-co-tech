import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatLedgerDate,
  maxDate,
  minDate,
  parseLedgerDate,
} from './dates';

describe('parseLedgerDate', () => {
  it('reads the forms a ledger actually prints', () => {
    expect(parseLedgerDate('01-Apr-2026')).toBe('2026-04-01');
    expect(parseLedgerDate('01/04/2026')).toBe('2026-04-01');
    expect(parseLedgerDate('01.04.2026')).toBe('2026-04-01');
    expect(parseLedgerDate('1 Apr 2026')).toBe('2026-04-01');
    expect(parseLedgerDate('April 1, 2026')).toBe('2026-04-01');
    expect(parseLedgerDate('2026-04-01')).toBe('2026-04-01');
  });

  it('reads two-digit years as this century', () => {
    expect(parseLedgerDate('1-Apr-26')).toBe('2026-04-01');
  });

  it('assumes day first, because these are Indian exports', () => {
    expect(parseLedgerDate('04/03/2026')).toBe('2026-03-04');
  });

  it('falls back to month first only when day first is impossible', () => {
    // 04/25 cannot be a 25th month, so it is April the 25th.
    expect(parseLedgerDate('04/25/2026')).toBe('2026-04-25');
  });

  it('takes a missing year from the ledger it was found in', () => {
    expect(parseLedgerDate('15-Apr', { defaultYear: 2026 })).toBe('2026-04-15');
  });

  it('accepts a Date without letting a timezone shift the day', () => {
    expect(parseLedgerDate(new Date(2026, 3, 1))).toBe('2026-04-01');
  });

  it('refuses a day that does not exist rather than rolling it forward', () => {
    expect(parseLedgerDate('31-Apr-2026')).toBeNull();
    expect(parseLedgerDate('29-Feb-2026')).toBeNull();
    expect(parseLedgerDate('29-Feb-2028')).toBe('2028-02-29');
  });

  it('returns null for anything it cannot read', () => {
    expect(parseLedgerDate('Opening Balance')).toBeNull();
    expect(parseLedgerDate('')).toBeNull();
    expect(parseLedgerDate(null)).toBeNull();
  });
});

describe('date arithmetic', () => {
  it('shifts days across a month boundary', () => {
    expect(addDays('2026-04-30', 1)).toBe('2026-05-01');
    expect(addDays('2026-04-01', -1)).toBe('2026-03-31');
  });

  it('counts whole days between two dates', () => {
    expect(daysBetween('2026-04-10', '2026-04-20')).toBe(10);
    expect(daysBetween('2026-04-20', '2026-04-10')).toBe(-10);
  });

  it('picks the earliest and latest, ignoring blanks', () => {
    const dates = ['2026-04-20', null, '2026-04-05', undefined];
    expect(minDate(dates)).toBe('2026-04-05');
    expect(maxDate(dates)).toBe('2026-04-20');
    expect(minDate([null, undefined])).toBeNull();
  });
});

describe('formatLedgerDate', () => {
  it('prints the form a statement uses', () => {
    expect(formatLedgerDate('2026-04-30')).toBe('30 Apr 2026');
  });

  it('shows a dash where there is no date', () => {
    expect(formatLedgerDate(null)).toBe('—');
  });
});
