import { describe, expect, it } from 'vitest';
import {
  addMonths,
  carryingCost,
  dayNumber,
  daysBetween,
  isoFromDay,
  landedCost,
  parseAmount,
  problems,
  rentalYield,
  timeline,
  withDelay,
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

describe('naming and order', () => {
  it('keeps an unnamed payment named by where it was typed, not where it sorts', () => {
    const result = landedCost(
      schedule({
        instalments: [
          row({ id: 'a', label: 'Booking', date: '2025-06-01', amount: 10 }),
          row({ id: 'b', label: '', date: '2024-06-01', amount: 10 }),
        ],
      }),
    );
    // It sorts first, and is still the second payment typed.
    expect(result.rows.map((r) => [r.id, r.name, r.position])).toEqual([
      ['b', 'Payment 2', 2],
      ['a', 'Booking', 1],
    ]);
  });

  it('keeps typed order between two payments on the same day', () => {
    const result = landedCost(
      schedule({
        instalments: [
          row({ id: 'first', date: '2025-01-01', amount: 10 }),
          row({ id: 'second', date: '2025-01-01', amount: 10, source: 'borrowed' }),
        ],
      }),
    );
    expect(result.rows.map((r) => r.id)).toEqual(['first', 'second']);
  });

  it('asks for a rate that was cleared rather than calling it negative', () => {
    expect(problems(schedule({ rates: { self: Number.NaN, borrowed: 9 } })).map((p) => p.message)).toEqual([
      'Enter a yearly rate for own funds, or 0.',
    ]);
  });
});

describe('parseAmount', () => {
  it.each([
    ['12,50,000', 1_250_000],
    ['₹ 12,50,000.00', 1_250_000],
    ['Rs. 5,00,000', 500_000],
    ['rs 500', 500],
    ['INR 2,000', 2000],
    ['8.5%', 8.5],
    ['.5', 0.5],
    ['-100', -100],
  ])('reads %s as %d', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it('is NaN for an empty field and null for text that is not a number', () => {
    expect(parseAmount('  ')).toBeNaN();
    expect(parseAmount('five lakh')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNull();
    expect(parseAmount('1e5')).toBeNull();
  });
});

describe('addMonths', () => {
  it('moves by calendar months and clamps to the end of a short month', () => {
    expect(addMonths('2027-03-31', 1)).toBe('2027-04-30');
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-11-15', 0)).toBe('2026-11-15');
  });
});

describe('timeline', () => {
  const base = schedule({
    ocDate: '2026-01-01',
    instalments: [
      row({ date: '2025-01-01', amount: 1_000_000, source: 'self' }),
      row({ date: '2024-01-02', amount: 2_000_000, source: 'borrowed' }),
      row({ date: '2026-03-01', amount: 500_000, source: 'self' }),
    ],
  });
  const points = timeline(base, 24);
  const result = landedCost(base);

  it('runs from the first payment to the later of OC and the last payment', () => {
    expect(isoFromDay(points[0].day)).toBe('2024-01-02');
    expect(isoFromDay(points.at(-1)!.day)).toBe('2026-03-01');
  });

  it('ends on the landed cost exactly', () => {
    const last = points.at(-1)!;
    expect(last.self + last.borrowed + last.carry).toBeCloseTo(result.landed, 2);
    expect(last.carry).toBe(result.interest);
  });

  it('is a step on each payment day and never goes down', () => {
    const before = points.find((p) => isoFromDay(p.day) === '2024-12-31')!;
    const on = points.find((p) => isoFromDay(p.day) === '2025-01-01')!;
    expect(on.self - before.self).toBe(1_000_000);
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      expect(b.self + b.borrowed + b.carry).toBeGreaterThanOrEqual(a.self + a.borrowed + a.carry - 0.01);
    }
  });

  it('stops accruing at the OC date', () => {
    const atOc = points.find((p) => isoFromDay(p.day) === '2026-01-01')!;
    const last = points.at(-1)!;
    expect(last.carry).toBeCloseTo(atOc.carry, 1);
  });

  it('is empty without an OC date or a usable payment', () => {
    expect(timeline(schedule({ ocDate: '' , instalments: [row({ amount: 1 })] }))).toEqual([]);
    expect(timeline(schedule())).toEqual([]);
  });
});

describe('withDelay', () => {
  it('costs more the later possession comes', () => {
    const s = schedule({ instalments: [row({ date: '2025-01-01', amount: 1_000_000 })] });
    const now = landedCost(s).interest;
    const later = landedCost(withDelay(s, 6)).interest;
    expect(withDelay(s, 6).ocDate).toBe('2026-07-01');
    expect(later).toBeGreaterThan(now);
    expect(withDelay(s, 0)).toBe(s);
  });
});

describe('cash cost', () => {
  it('is paid plus loan interest, leaving out the return own funds gave up', () => {
    const result = landedCost(
      schedule({
        ocDate: '2026-01-01',
        instalments: [
          row({ date: '2025-01-01', amount: 1_000_000, source: 'self' }),
          row({ date: '2024-01-02', amount: 2_000_000, source: 'borrowed' }),
        ],
      }),
    );
    // 30L paid + 3.6L loan interest; the 80,000 own-funds return is not cash.
    expect(result.cash).toBe(3_360_000);
    expect(result.landed - result.cash).toBe(80_000);
  });
});

describe('rentalYield', () => {
  // 10L own at 8% and 30L borrowed at 9%, each for a year:
  // paid 40L, interest 80,000 + 2,70,000, true cost 43.5L.
  const base = schedule({
    ocDate: '2026-01-01',
    rates: { self: 8, borrowed: 9 },
    instalments: [
      row({ date: '2025-01-01', amount: 1_000_000, source: 'self' }),
      row({ date: '2025-01-01', amount: 3_000_000, source: 'borrowed' }),
    ],
  });

  it('is null until a rent is entered', () => {
    expect(rentalYield(base)).toBeNull();
    expect(rentalYield({ ...base, rental: { monthlyRent: 0 } })).toBeNull();
  });

  it('measures the rent against the price and against the true cost', () => {
    const y = rentalYield({ ...base, rental: { monthlyRent: 20_000 } })!;
    expect(y.grossAnnual).toBe(240_000);
    expect(y.grossOnPaid).toBeCloseTo(6, 6); // 2.4L on 40L
    expect(y.grossOnTrue).toBeCloseTo((240_000 / 4_350_000) * 100, 6);
    expect(y.netOnTrue).toBeCloseTo(y.grossOnTrue, 6); // no costs, no vacancy
  });

  it('takes vacancy, maintenance and fixed costs off before the net yield', () => {
    const y = rentalYield({
      ...base,
      rental: { monthlyRent: 20_000, vacancyPct: 10, maintenanceMonthly: 3000, annualCosts: 12_000 },
    })!;
    // 2,40,000 x 0.9 - 36,000 - 12,000 = 1,68,000
    expect(y.netAnnual).toBe(168_000);
    expect(y.netOnTrue).toBeCloseTo((168_000 / 4_350_000) * 100, 6);
    expect(y.paybackYears).toBeCloseTo(4_350_000 / 168_000, 6);
  });

  it('weights the cost of funds by how much each source paid', () => {
    const y = rentalYield({ ...base, rental: { monthlyRent: 20_000 } })!;
    expect(y.blendedRate).toBeCloseTo(8.75, 6); // (10L x 8 + 30L x 9) / 40L
    expect(y.spread).toBeCloseTo(y.netOnTrue - 8.75, 6);
  });

  it('finds the rent at which the yield exactly covers the money', () => {
    const rental = { vacancyPct: 10, maintenanceMonthly: 3000 };
    const y = rentalYield({ ...base, rental: { monthlyRent: 20_000, ...rental } })!;
    const atBreakEven = rentalYield({ ...base, rental: { monthlyRent: y.breakEvenRent, ...rental } })!;
    expect(atBreakEven.spread).toBeCloseTo(0, 6);
  });

  it('says no rent is enough when the property is empty all year', () => {
    const y = rentalYield({ ...base, rental: { monthlyRent: 20_000, vacancyPct: 100 } })!;
    expect(y.breakEvenRent).toBe(Number.POSITIVE_INFINITY);
    expect(y.paybackYears).toBeNull();
  });

  it('gives a yield on market value only when one is entered', () => {
    expect(rentalYield({ ...base, rental: { monthlyRent: 20_000 } })!.netOnMarket).toBeUndefined();
    expect(
      rentalYield({ ...base, rental: { monthlyRent: 20_000, marketValue: 6_000_000 } })!.netOnMarket,
    ).toBeCloseTo(4, 6);
  });
});
