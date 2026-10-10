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
