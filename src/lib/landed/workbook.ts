import type * as XLSXType from 'xlsx';
import {
  COMPOUNDING_LABEL,
  SOURCE_LABEL,
  dayNumber,
  delayCase,
  landedCost,
  rentalYield,
  timeline,
  uncounted,
  type Schedule,
} from './calc';
import { METHOD, afterOcNote, rentVerdict } from './words';

/**
 * A True Property Cost schedule as a workbook.
 *
 * Summary is what gets read and Schedule is what gets checked, one row per
 * payment with the days and the rate that produced its figure. Behind them, the
 * rest of what the screen shows: the payments that could not be counted and
 * why, what each month of a late possession would cost, the money tied up over
 * time (the chart's own figures), and the method. A workbook is what gets kept
 * and passed on, so it has to carry everything the person who made it saw;
 * a figure or a warning that stayed on the screen is lost to whoever opens it.
 *
 * Amounts are real numbers with an Indian-grouped format, and dates are real
 * dates, never strings that merely look like them, so the first things a
 * reader does — total a column, sort by date — work.
 *
 * The xlsx module is passed in rather than imported, so the screen can load it
 * only when somebody actually asks for a file.
 */

const MONEY = '#,##,##0.00';
const DATE = 'dd/mm/yyyy';

type Cell = string | number | null;

/** DD/MM/YYYY, the way the date is written on an Indian demand letter. */
export function displayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/**
 * An ISO date as an Excel date serial: days since 30 Dec 1899. Counted from
 * the calendar date itself, so no time zone can move it a day.
 */
function excelDate(iso: string): number | string {
  const day = dayNumber(iso);
  return Number.isFinite(day) ? day + 25569 : iso;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Sets a number format on every numeric cell in the given columns, from row `from` down. */
function format(sheet: XLSXType.WorkSheet, XLSX: typeof XLSXType, cols: number[], z: string, from = 1) {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  for (const c of cols) {
    for (let r = from; r <= range.e.r; r += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ c, r })];
      if (cell && typeof cell.v === 'number') cell.z = z;
    }
  }
}

export function buildLandedWorkbook(
  XLSX: typeof XLSXType,
  schedule: Schedule & { name: string },
): XLSXType.WorkBook {
  const result = landedCost(schedule);
  const missing = uncounted(schedule);
  const book = XLSX.utils.book_new();
  const share = (v: number) => (result.landed > 0 ? round2((v / result.landed) * 100) : 0);

  // ── Summary ──
  const summary: Cell[][] = [
    ['True property cost', schedule.name],
    ['Possession (OC) date', excelDate(schedule.ocDate)],
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
    ['Carrying cost as % of amount paid', round2(result.upliftPct)],
    ['Average days funds were tied up', Math.round(result.weightedDays)],
    // Said in the file, because a row the screen was still warning about (no
    // date, no amount) is left out of every figure above, and a workbook that
    // is passed on has lost the warning. The rows themselves are on the
    // "Not counted" sheet.
    ['Payments counted', `${result.rows.length} of ${schedule.instalments.length}`],
    [null, null],
    ['Own funds, share of true cost (%)', share(result.self.paid)],
    ['Borrowed funds, share of true cost (%)', share(result.borrowed.paid)],
    ['Carrying cost, share of true cost (%)', share(result.interest)],
  ];
  if (missing.length > 0) {
    summary.push(['Not counted', `${missing.map((m) => m.name).join(', ')}: see the "Not counted" sheet`]);
  }
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
    summary.push(
      [null, null],
      ['Rental yield', METHOD.yieldBasis],
      ['Monthly rent', rental.monthlyRent ?? 0],
      ['Maintenance a month', rental.maintenanceMonthly ?? 0],
      ['Other owner costs a year', rental.annualCosts ?? 0],
      ['Vacancy (% of the year)', rental.vacancyPct ?? 0],
      ['Net rent a year', round2(y.netAnnual)],
      ['Gross yield on price paid (%)', round2(y.grossOnPaid)],
      ['Gross yield on true cost (%)', round2(y.grossOnTrue)],
      ['Net yield on true cost (%)', round2(y.netOnTrue)],
      ['Net yield less cost of the money (%)', round2(y.spread)],
      ['Verdict', rentVerdict(y).text],
    );
    if (y.netOnMarket !== undefined && rental.marketValue) {
      summary.push(['Market value', rental.marketValue], ['Net yield on market value (%)', round2(y.netOnMarket)]);
    }
  } else if (rental && Object.values(rental).some((v) => typeof v === 'number' && v > 0)) {
    summary.push([null, null], ['Rental yield', 'Not worked out: the expected rent a month is not entered']);
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summary.forEach((row, r) => {
    const cell = summarySheet[XLSX.utils.encode_cell({ c: 1, r })];
    if (!cell || typeof cell.v !== 'number') return;
    if (typeof row[0] === 'string' && MONEY_ROWS.has(row[0])) cell.z = MONEY;
    if (row[0] === 'Possession (OC) date') cell.z = DATE;
  });
  summarySheet['!cols'] = [{ wch: 38 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(book, summarySheet, 'Summary');

  // ── Schedule ──
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
    excelDate(r.date),
    SOURCE_LABEL[r.source],
    r.amount,
    r.days,
    r.rate,
    r.interest,
    r.atPossession,
    r.afterOc ? 'Paid on or after the OC date, so no cost of funds' : null,
  ]);
  const totals: Cell[] = ['Total', null, null, result.paid, null, null, result.interest, result.landed, null];
  const afterOc = result.rows.filter((r) => r.afterOc).length;
  const below: Cell[][] = [];
  if (afterOc > 0) below.push([], [afterOcNote(afterOc)]);
  if (missing.length > 0) below.push([], [`Not in this table, because they cannot be worked out yet: ${missing.map((m) => m.name).join(', ')}. See the "Not counted" sheet.`]);
  const scheduleSheet = XLSX.utils.aoa_to_sheet([header, ...rows, totals, ...below]);
  format(scheduleSheet, XLSX, [3, 6, 7], MONEY);
  format(scheduleSheet, XLSX, [1], DATE);
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

  // ── Not counted ──
  if (missing.length > 0) {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Payment', 'Position in the schedule', 'Date as entered', 'Amount as entered', 'Source of funds', 'Why it is not counted'],
      ...missing.map((m) => [
        m.name,
        m.position,
        m.date ? excelDate(m.date) : null,
        Number.isFinite(m.amount) && m.amount !== 0 ? m.amount : null,
        SOURCE_LABEL[m.source],
        m.reasons.join(' '),
      ]),
    ]);
    format(sheet, XLSX, [3], MONEY);
    format(sheet, XLSX, [2], DATE);
    sheet['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(book, sheet, 'Not counted');
  }

  // ── If possession slips ──
  // Every month the screen's slider reaches, so any delay can be read off.
  const delays = Array.from({ length: 36 }, (_, i) => delayCase(schedule, i + 1, result));
  const delaySheet = XLSX.utils.aoa_to_sheet([
    ['Months late', 'OC date then', 'Extra carrying cost', 'About a month', 'True cost then', 'Carrying cost as % of amount paid'],
    [0, excelDate(schedule.ocDate), 0, 0, result.landed, round2(result.upliftPct)],
    ...delays.map((d) => [d.months, excelDate(d.ocDate), d.extra, round2(d.perMonth), d.landed, round2(d.upliftPct)]),
  ]);
  format(delaySheet, XLSX, [2, 3, 4], MONEY);
  format(delaySheet, XLSX, [1], DATE);
  delaySheet['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(book, delaySheet, 'If possession slips');

  // ── Over time: the chart's own figures ──
  const points = timeline(schedule);
  if (points.length > 0) {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Date', 'Own funds paid so far', 'Borrowed funds paid so far', 'Carrying cost so far', 'Total so far'],
      ...points.map((p) => [p.day + 25569, p.self, p.borrowed, round2(p.carry), round2(p.self + p.borrowed + p.carry)]),
    ]);
    format(sheet, XLSX, [1, 2, 3, 4], MONEY);
    format(sheet, XLSX, [0], DATE);
    sheet['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 26 }, { wch: 22 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(book, sheet, 'Over time');
  }

  // ── Method ──
  const method = XLSX.utils.aoa_to_sheet([
    ['How it is worked out'],
    [],
    ['The cost of each payment'],
    [METHOD.formula],
    ...METHOD.rules.map((rule) => [rule]),
    [],
    ['What the figures mean'],
    ...METHOD.meanings.map(([term, meaning]) => [`${term}: ${meaning}`]),
    [],
    ['Not modelled'],
    [METHOD.notModelled],
    [],
    ['Rental yield'],
    [METHOD.yieldBasis],
  ]);
  method['!cols'] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(book, method, 'Method');

  return book;
}
