import { describe, expect, it } from 'vitest';
import {
  carryingCost,
  dayNumber,
  daysBetween,
  landedCost,
  problems,
  type Instalment,
  type Schedule,
} from './calc';

const row = (over: Partial<Instalment>): Instalment => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  label: '',
  date: '2024-01-01',
  amount: 0,
  source: 'self',
  ...over,
});

const schedule = (over: Partial<Schedule> = {}): Schedule => ({
  ocDate: '2026-01-01',
  rates: { self: 8, borrowed: 9 },
  compounding: 'simple',
  instalments: [],
  ...over,
});

describe('dates', () => {
  it('counts whole calendar days, leap years included', () => {
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366);
    expect(daysBetween('2025-01-01', '2026-01-01')).toBe(365);
    expect(daysBetween('2025-03-10', '2025-03-01')).toBe(-9);
  });

  it('refuses a date that does not exist rather than rolling it over', () => {
    expect(dayNumber('2025-02-29')).toBeNaN();
    expect(dayNumber('2024-02-29')).not.toBeNaN();
    expect(dayNumber('2025-13-01')).toBeNaN();
    expect(dayNumber('01/02/2025')).toBeNaN();
  });
});

describe('carryingCost', () => {
  it('is simple interest on actual/365 by default', () => {
    expect(carryingCost(1_000_000, 8, 365, 'simple')).toBeCloseTo(80_000, 6);
    expect(carryingCost(2_000_000, 9, 730, 'simple')).toBeCloseTo(360_000, 6);
  });

  it('compounds over the same day count when asked', () => {
    // 12% a year, monthly, for exactly a year: 1.01^12 - 1.
    expect(carryingCost(100_000, 12, 365, 'monthly')).toBeCloseTo(12_682.5, 1);
    expect(carryingCost(100_000, 12, 365, 'annual')).toBeCloseTo(12_000, 6);
  });

  it('charges nothing for no time, no rate or no money', () => {
    expect(carryingCost(100_000, 8, 0, 'simple')).toBe(0);
    expect(carryingCost(100_000, 0, 400, 'monthly')).toBe(0);
    expect(carryingCost(0, 8, 400, 'simple')).toBe(0);
  });
});

describe('landedCost', () => {
  it('carries each payment at its own source rate up to the OC date', () => {
    const result = landedCost(
      schedule({
        ocDate: '2026-01-01',
        instalments: [
          row({ date: '2025-01-01', amount: 1_000_000, source: 'self' }),
          row({ date: '2024-01-02', amount: 2_000_000, source: 'borrowed' }),
        ],
      }),
    );

    // 365 days at 8% on 10L, and 730 days at 9% on 20L.
    expect(result.self).toEqual({ paid: 1_000_000, interest: 80_000 });
    expect(result.borrowed).toEqual({ paid: 2_000_000, interest: 360_000 });
    expect(result.paid).toBe(3_000_000);
    expect(result.interest).toBe(440_000);
    expect(result.landed).toBe(3_440_000);
    expect(result.upliftPct).toBeCloseTo(14.6667, 3);
  });

  it('puts the rows in date order whatever order they were typed in', () => {
    const result = landedCost(
      schedule({
        instalments: [
          row({ id: 'late', date: '2025-06-01', amount: 10 }),
          row({ id: 'early', date: '2024-06-01', amount: 10 }),
        ],
      }),
    );
    expect(result.rows.map((r) => r.id)).toEqual(['early', 'late']);
  });

  it('charges nothing on a payment made on or after the OC date, and flags it', () => {
    const result = landedCost(
      schedule({
        ocDate: '2026-01-01',
        instalments: [
          row({ id: 'on', date: '2026-01-01', amount: 500_000 }),
          row({ id: 'after', date: '2026-02-01', amount: 500_000 }),
        ],
      }),
    );
    expect(result.interest).toBe(0);
    expect(result.landed).toBe(1_000_000);
    expect(result.rows.every((r) => r.afterOc && r.days === 0)).toBe(true);
  });

  it('weights the average days by the amount tied up', () => {
    const result = landedCost(
      schedule({
        ocDate: '2026-01-01',
        instalments: [
          row({ date: '2025-01-01', amount: 300 }), // 365 days
          row({ date: '2025-12-31', amount: 100 }), // 1 day
        ],
      }),
    );
    expect(result.weightedDays).toBeCloseTo((300 * 365 + 100) / 400, 6);
  });

  it('gives a cost per square foot only when an area is entered', () => {
    const base = { instalments: [row({ date: '2025-01-01', amount: 1_000_000 })] };
    expect(landedCost(schedule(base)).perSqft).toBeUndefined();
    expect(landedCost(schedule({ ...base, areaSqft: 1000 })).perSqft).toEqual({
      paid: 1000,
      landed: 1080,
    });
  });

  it('leaves out rows it cannot compute instead of guessing at them', () => {
    const result = landedCost(
      schedule({
        instalments: [
          row({ date: '', amount: 100 }),
          row({ date: '2025-02-30', amount: 100 }),
          row({ date: '2025-01-01', amount: 0 }),
          row({ date: '2025-01-01', amount: 100 }),
        ],
      }),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.paid).toBe(100);
  });

  it('is all zeros for an empty schedule', () => {
    const result = landedCost(schedule());
    expect(result).toMatchObject({ paid: 0, interest: 0, landed: 0, upliftPct: 0, weightedDays: 0 });
  });
});

describe('problems', () => {
  it('names each row it cannot use, by its own label', () => {
    const list = problems(
      schedule({
        instalments: [
          row({ label: 'Booking', date: '', amount: 100 }),
          row({ label: '', date: '2025-01-01', amount: 0 }),
        ],
      }),
    );
    expect(list.map((p) => p.message)).toEqual([
      'Booking has no date.',
      'Payment 2 needs an amount above zero.',
    ]);
  });

  it('catches a missing OC date and a rate that is not a yearly percentage', () => {
    const list = problems(schedule({ ocDate: '', rates: { self: 8, borrowed: 900 } }));
    expect(list.map((p) => p.message)).toEqual([
      'Enter the OC date. Interest is counted up to it.',
      'The rate for borrowed funds is over 100% a year. Check it is a yearly percentage.',
    ]);
  });

  it('is empty for a complete schedule', () => {
    expect(problems(schedule({ instalments: [row({ date: '2025-01-01', amount: 1 })] }))).toEqual([]);
  });
});
