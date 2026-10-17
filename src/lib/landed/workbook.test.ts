import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildLandedWorkbook, displayDate } from './workbook';
import { EXAMPLE_NAME, exampleSchedule } from './example';

const schedule = {
  name: 'Skyline Towers, B-1204',
  ocDate: '2027-03-31',
  rates: { self: 7, borrowed: 8.5 },
  compounding: 'simple' as const,
  areaSqft: 1000,
  instalments: [
    { id: 'a', label: 'Booking amount', date: '2024-04-01', amount: 1_000_000, source: 'self' as const },
    { id: 'b', label: '', date: '2025-01-15', amount: 2_000_000, source: 'borrowed' as const },
  ],
};

describe('buildLandedWorkbook', () => {
  const book = buildLandedWorkbook(XLSX, schedule);
  const cell = (sheet: string, ref: string) => book.Sheets[sheet][ref];

  it('has the summary, the schedule and everything else the screen shows', () => {
    expect(book.SheetNames).toEqual(['Summary', 'Schedule', 'If possession slips', 'Over time', 'Method']);
  });

  it('writes amounts as numbers with an Indian money format, not as text', () => {
    // True cost at OC: 30L paid + 2,09,808.22 + 3,74,931.51.
    const landed = cell('Summary', 'B14');
    expect(cell('Summary', 'A14').v).toBe('True cost at OC');
    expect(landed.t).toBe('n');
    expect(landed.v).toBeCloseTo(3_584_739.73, 2);
    expect(landed.z).toBe('#,##,##0.00');
  });

  it('lists every payment with its days and carrying cost, and names an unnamed one', () => {
    expect(cell('Schedule', 'A3').v).toBe('Payment 2');
    expect(cell('Schedule', 'E2').v).toBe(1094);
    expect(cell('Schedule', 'G2').v).toBeCloseTo(209_808.22, 2);
    expect(cell('Schedule', 'A4').v).toBe('Total');
    expect(cell('Schedule', 'H4').v).toBeCloseTo(3_584_739.73, 2);
  });

  it('includes the cost per square foot when an area is given', () => {
    const rows = XLSX.utils.sheet_to_json<[string, unknown]>(book.Sheets.Summary, { header: 1 }) as [string, unknown][];
    const r = rows.findIndex((x) => x[0] === 'True cost per sq ft');
    const value = book.Sheets.Summary[XLSX.utils.encode_cell({ c: 1, r })];
    expect(value.v).toBeCloseTo(3584.74, 2);
    expect(value.z).toBe('#,##,##0.00');
  });

  it('writes dates as real dates, so the column sorts and subtracts', () => {
    const paid = cell('Schedule', 'B2');
    expect(paid.t).toBe('n');
    expect(paid.z).toBe('dd/mm/yyyy');
    // 1 April 2024 is Excel day 45383.
    expect(paid.v).toBe(45383);
    expect(XLSX.SSF.format(paid.z as string, paid.v)).toBe('01/04/2024');
  });

  it('says how many of the payments it counted', () => {
    expect(cell('Summary', 'A17').v).toBe('Payments counted');
    expect(cell('Summary', 'B17').v).toBe('2 of 2');
  });

  it('notes a payment made on or after the OC date', () => {
    const late = buildLandedWorkbook(XLSX, {
      ...schedule,
      instalments: [
        ...schedule.instalments,
        { id: 'c', label: 'On possession', date: '2027-04-15', amount: 500_000, source: 'self' },
      ],
    });
    const sheet = late.Sheets.Schedule;
    expect(sheet.A4.v).toBe('On possession');
    expect(sheet.I4.v).toMatch(/on or after the OC date/);
    expect(sheet.I2).toBeUndefined();
  });
});

describe('displayDate', () => {
  it('writes a date the way a demand letter does', () => {
    expect(displayDate('2027-03-31')).toBe('31/03/2027');
  });
});

describe('buildLandedWorkbook, cash cost and rental yield', () => {
  const rows = (book: XLSX.WorkBook) =>
    XLSX.utils.sheet_to_json<[string, unknown]>(book.Sheets.Summary, { header: 1 }) as [string, unknown][];
  const find = (book: XLSX.WorkBook, label: string) => rows(book).find((r) => r[0] === label)?.[1];

  it('reports the cash cost apart from the true cost', () => {
    const book = buildLandedWorkbook(XLSX, schedule);
    // 30L paid + 3,74,931.51 loan interest.
    expect(find(book, 'Cash cost (payments + loan interest)')).toBeCloseTo(3_374_931.51, 2);
  });

  it('adds the yield only when a rent is entered, with money formatted as money', () => {
    expect(find(buildLandedWorkbook(XLSX, schedule), 'Net yield on true cost (%)')).toBeUndefined();
    const book = buildLandedWorkbook(XLSX, { ...schedule, rental: { monthlyRent: 25_000, marketValue: 5_000_000 } });
    expect(find(book, 'Monthly rent')).toBe(25_000);
    expect(find(book, 'Gross yield on price paid (%)')).toBe(10); // 3L on 30L
    expect(find(book, 'Net yield on market value (%)')).toBe(6);
    const r = rows(book).findIndex((x) => x[0] === 'Monthly rent');
    expect(book.Sheets.Summary[XLSX.utils.encode_cell({ c: 1, r })].z).toBe('#,##,##0.00');
  });
});

describe('buildLandedWorkbook, everything else the screen shows', () => {
  const rows = (book: XLSX.WorkBook, sheet = 'Summary') =>
    XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheet], { header: 1 }) as unknown[][];
  const find = (book: XLSX.WorkBook, label: string) => rows(book).find((r) => r[0] === label)?.[1];

  it('lists each payment it could not count, with the reason, instead of dropping it', () => {
    const book = buildLandedWorkbook(XLSX, {
      ...schedule,
      instalments: [
        ...schedule.instalments,
        { id: 'c', label: 'Parking', date: '', amount: 300_000, source: 'self' },
        { id: 'd', label: 'Club membership', date: '2025-06-01', amount: 0, source: 'self' },
      ],
    });
    expect(book.SheetNames).toContain('Not counted');
    const missing = rows(book, 'Not counted');
    expect(missing[1]).toEqual(['Parking', 3, undefined, 300_000, 'Own funds', 'Parking has no date.']);
    expect(missing[2][0]).toBe('Club membership');
    expect(missing[2][5]).toBe('Club membership needs an amount above zero.');
    expect(find(book, 'Payments counted')).toBe('2 of 4');
    expect(String(find(book, 'Not counted'))).toContain('Parking, Club membership');
  });

  it('gives the cost of every month of delay the slider reaches', () => {
    const book = buildLandedWorkbook(XLSX, { ...exampleSchedule(), name: EXAMPLE_NAME });
    const delay = rows(book, 'If possession slips');
    expect(delay).toHaveLength(1 + 1 + 36); // header, on time, 1 to 36 months
    const three = delay.find((r) => r[0] === 36)!;
    // The worked example, three years late: the figures the public demo shows.
    expect(three[2]).toBeCloseTo(1_586_175, 2);
    expect(three[4]).toBeCloseTo(9_292_106.98, 2);
  });

  it("carries the chart's figures, ending on the true cost", () => {
    const book = buildLandedWorkbook(XLSX, schedule);
    const points = rows(book, 'Over time');
    expect(points[0]).toEqual(['Date', 'Own funds paid so far', 'Borrowed funds paid so far', 'Carrying cost so far', 'Total so far']);
    expect(points[points.length - 1][4]).toBeCloseTo(3_584_739.73, 2);
  });

  it('states the method in the words the screen uses', () => {
    const text = rows(buildLandedWorkbook(XLSX, schedule), 'Method').flat().join(' ');
    expect(text).toContain('Amount × rate a year × days to possession ÷ 365');
    expect(text).toContain('Compounding, when chosen, applies the same days and rate yearly, quarterly or monthly.');
    expect(text).toContain('Cash cost: everything paid, plus the loan interest. What actually left the account.');
  });

  it("gives the screen's verdict on the rent, and the funds split", () => {
    const book = buildLandedWorkbook(XLSX, { ...exampleSchedule(), name: EXAMPLE_NAME });
    expect(find(book, 'Verdict')).toBe(
      'The rent falls 3.96% a year short of what the money costs. It pays only if the property gains in value.',
    );
    expect(find(book, 'Own funds, share of true cost (%)')).toBe(36.56);
    expect(find(book, 'Carrying cost, share of true cost (%)')).toBe(12.83);
  });

  it('leaves out the break-even rent, payback and cost of the money, as the screen does', () => {
    const labels = rows(buildLandedWorkbook(XLSX, { ...exampleSchedule(), name: EXAMPLE_NAME })).map((r) => String(r[0]));
    expect(labels.filter((l) => /break-even|payback|cost of the money, blended/i.test(l))).toEqual([]);
  });

  it('says why there is no yield when rent details were typed but the rent was not', () => {
    const book = buildLandedWorkbook(XLSX, { ...schedule, rental: { maintenanceMonthly: 3000 } });
    expect(find(book, 'Rental yield')).toBe('Not worked out: the expected rent a month is not entered');
  });
});

