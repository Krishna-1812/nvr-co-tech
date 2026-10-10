import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildLandedWorkbook, displayDate } from './workbook';

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

  it('has a Summary and a Schedule sheet', () => {
    expect(book.SheetNames).toEqual(['Summary', 'Schedule']);
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
    expect(cell('Summary', 'A21').v).toBe('True cost per sq ft');
    expect(cell('Summary', 'B21').v).toBeCloseTo(3584.74, 2);
    expect(cell('Summary', 'B21').z).toBe('#,##,##0.00');
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
