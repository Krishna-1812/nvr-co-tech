import type * as XLSXType from 'xlsx';
import { COMPOUNDING_LABEL, SOURCE_LABEL, landedCost, rentalYield, type Schedule } from './calc';

/**
 * A True Property Cost schedule as a workbook.
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
    ['True property cost', schedule.name],
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
    ['True cost at OC', result.landed],
    ['Carrying cost as % of amount paid', Math.round(result.upliftPct * 100) / 100],
    ['Average days funds were tied up', Math.round(result.weightedDays)],
    // Said in the file, because a row the screen was still warning about (no
    // date, no amount) is left out of every figure above, and a workbook that
    // is passed on has lost the warning.
    ['Payments counted', `${result.rows.length} of ${schedule.instalments.length}`],
  ];
  // Money rows are named rather than counted, so adding a row cannot shift the
  // currency format onto the wrong figure.
  const MONEY_ROWS = new Set<string>([
    'Paid from own funds',
    'Carrying cost of own funds',
    'Paid from borrowed funds',
    'Interest on borrowed funds',
    'Total paid',
    'Total carrying cost to OC',
    'True cost at OC',
    'Paid per sq ft',
    'True cost per sq ft',
    'Cash cost (payments + loan interest)',
    'Monthly rent',
    'Maintenance a month',
    'Other owner costs a year',
    'Market value',
    'Net rent a year',
    'Break-even rent a month',
  ]);

  if (result.perSqft && schedule.areaSqft) {
    summary.push(
      [null, null],
      ['Carpet area (sq ft)', schedule.areaSqft],
      ['Paid per sq ft', result.perSqft.paid],
      ['True cost per sq ft', result.perSqft.landed],
    );
  }
  // The money that actually left the account, apart from the return own funds
  // gave up, which is a cost but not a payment.
  summary.push([null, null], ['Cash cost (payments + loan interest)', result.cash]);

  const y = rentalYield(schedule, result);
  const rental = schedule.rental;
  if (y && rental) {
    const round2 = (v: number) => Math.round(v * 100) / 100;
    summary.push(
      [null, null],
      ['Rental yield', 'Pre-tax, no appreciation or rent escalation'],
      ['Monthly rent', rental.monthlyRent ?? 0],
      ['Maintenance a month', rental.maintenanceMonthly ?? 0],
      ['Other owner costs a year', rental.annualCosts ?? 0],
      ['Vacancy (% of the year)', rental.vacancyPct ?? 0],
      ['Net rent a year', round2(y.netAnnual)],
      ['Gross yield on price paid (%)', round2(y.grossOnPaid)],
      ['Gross yield on true cost (%)', round2(y.grossOnTrue)],
      ['Net yield on true cost (%)', round2(y.netOnTrue)],
      ['Cost of the money, blended (% a year)', round2(y.blendedRate)],
      ['Net yield less cost of the money (%)', round2(y.spread)],
      [
        'Break-even rent a month',
        Number.isFinite(y.breakEvenRent) ? round2(y.breakEvenRent) : 'No rent covers it at this vacancy',
      ],
      ['Payback on true cost (years)', y.paybackYears === null ? 'Never, at this net rent' : round2(y.paybackYears)],
    );
    if (y.netOnMarket !== undefined && rental.marketValue) {
      summary.push(['Market value', rental.marketValue], ['Net yield on market value (%)', round2(y.netOnMarket)]);
    }
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summary.forEach((row, r) => {
    if (typeof row[0] === 'string' && MONEY_ROWS.has(row[0])) money(summarySheet, XLSX, 1, r, r);
  });
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
    'Note',
  ];
  const rows: Cell[][] = result.rows.map((r) => [
    r.name,
    displayDate(r.date),
    SOURCE_LABEL[r.source],
    r.amount,
    r.days,
    r.rate,
    r.interest,
    r.atPossession,
    r.afterOc ? 'Paid on or after the OC date, so no cost of funds' : null,
  ]);
  const totals: Cell[] = ['Total', null, null, result.paid, null, null, result.interest, result.landed, null];
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
    { wch: 48 },
  ];
  XLSX.utils.book_append_sheet(book, scheduleSheet, 'Schedule');

  return book;
}
