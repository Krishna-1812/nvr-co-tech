import type * as XLSXType from 'xlsx';
import { COMPOUNDING_LABEL, SOURCE_LABEL, landedCost, type Schedule } from './calc';

/**
 * A landed-cost schedule as a workbook.
 *
 * Two sheets: Summary, which is what gets read, and Schedule, which is what gets
 * checked, one row per payment with the days and the rate that produced its
 * figure. Amounts are real numbers with an Indian-grouped format, never strings
 * that merely look like money, so the first thing a reader does — total a
 * column — works.
 *
 * The xlsx module is passed in rather than imported, so the screen can load it
 * only when somebody actually asks for a file.
 */

const MONEY = '#,##,##0.00';

type Cell = string | number | null;

function money(sheet: XLSXType.WorkSheet, XLSX: typeof XLSXType, col: number, from: number, to: number) {
  for (let r = from; r <= to; r += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ c: col, r })];
    if (cell && typeof cell.v === 'number') cell.z = MONEY;
  }
}

/** DD/MM/YYYY, the way the date is written on an Indian demand letter. */
export function displayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function buildLandedWorkbook(
  XLSX: typeof XLSXType,
  schedule: Schedule & { name: string },
): XLSXType.WorkBook {
  const result = landedCost(schedule);
  const book = XLSX.utils.book_new();

  const summary: Cell[][] = [
    ['Landed cost', schedule.name],
    ['Possession (OC) date', displayDate(schedule.ocDate)],
    ['Cost of own funds (% a year)', schedule.rates.self],
    ['Cost of borrowed funds (% a year)', schedule.rates.borrowed],
    ['Interest method', `${COMPOUNDING_LABEL[schedule.compounding]}, actual/365`],
    [null, null],
    ['Paid from own funds', result.self.paid],
    ['Carrying cost of own funds', result.self.interest],
    ['Paid from borrowed funds', result.borrowed.paid],
    ['Interest on borrowed funds', result.borrowed.interest],
    [null, null],
    ['Total paid', result.paid],
    ['Total carrying cost to OC', result.interest],
    ['Landed cost at OC', result.landed],
    ['Carrying cost as % of amount paid', Math.round(result.upliftPct * 100) / 100],
    ['Average days funds were tied up', Math.round(result.weightedDays)],
  ];
  if (result.perSqft && schedule.areaSqft) {
    summary.push(
      [null, null],
      ['Carpet area (sq ft)', schedule.areaSqft],
      ['Paid per sq ft', result.perSqft.paid],
      ['Landed cost per sq ft', result.perSqft.landed],
    );
  }
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  money(summarySheet, XLSX, 1, 6, 13);
  if (result.perSqft) money(summarySheet, XLSX, 1, 18, 19);
  summarySheet['!cols'] = [{ wch: 36 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(book, summarySheet, 'Summary');

  const header: Cell[] = [
    'Payment',
    'Date paid',
    'Source of funds',
    'Amount',
    'Days to OC',
    'Rate (% a year)',
    'Carrying cost',
    'Value at OC',
  ];
  const rows: Cell[][] = result.rows.map((r, i) => [
    r.label.trim() || `Payment ${i + 1}`,
    displayDate(r.date),
    SOURCE_LABEL[r.source],
    r.amount,
    r.days,
    r.rate,
    r.interest,
    r.atPossession,
  ]);
  const totals: Cell[] = ['Total', null, null, result.paid, null, null, result.interest, result.landed];
  const scheduleSheet = XLSX.utils.aoa_to_sheet([header, ...rows, totals]);
  const last = rows.length + 1;
  for (const col of [3, 6, 7]) money(scheduleSheet, XLSX, col, 1, last);
  scheduleSheet['!cols'] = [
    { wch: Math.min(40, Math.max(12, ...rows.map((r) => String(r[0]).length + 2))) },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 11 },
    { wch: 15 },
    { wch: 16 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(book, scheduleSheet, 'Schedule');

  return book;
}
