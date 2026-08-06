import * as XLSX from 'xlsx';
import { formatLedgerDate } from '../dates';
import type { ReconResult } from '../types';

/**
 * The reconciliation, as a workbook.
 *
 * Three sheets, because the three things somebody does with this afterwards are
 * genuinely different jobs. Summary is what gets read. Statement is what gets
 * printed into a working paper. Lines is what gets sorted, filtered and pivoted,
 * which is the whole reason anyone asks for Excel rather than the PDF.
 *
 * Every amount is a real number with a currency format, never a pre-formatted
 * string. A column of text that looks like money is the single most annoying
 * thing an export can hand a finance team, because the first thing they do is
 * total it.
 */

const MONEY = '#,##,##0.00';
const CATEGORY_LABEL = {
  MATCHED: 'Matched',
  TIMING: 'Timing',
  ONE_SIDED: 'One-sided',
  AMOUNT_DIFF: 'Amount differs',
} as const;

const STATUS_LABEL = {
  RECONCILED: 'Reconciled',
  PARTIAL: 'Partly reconciled',
  NOT_RECONCILED: 'Not reconciled',
} as const;

type Cell = string | number | null;

/** Apply a number format down one column of a sheet. */
function formatColumn(sheet: XLSX.WorkSheet, column: number, firstRow: number, lastRow: number) {
  for (let r = firstRow; r <= lastRow; r += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ c: column, r })];
    if (cell && typeof cell.v === 'number') cell.z = MONEY;
  }
}

function widths(rows: Cell[][], caps: number[]): XLSX.ColInfo[] {
  return caps.map((cap, c) => {
    const longest = rows.reduce(
      (max, row) => Math.max(max, String(row[c] ?? '').length),
      8,
    );
    return { wch: Math.min(longest + 2, cap) };
  });
}

export function buildReconWorkbook(result: ReconResult, preparedBy: string): XLSX.WorkBook {
  const { statement, summaryA, summaryB } = result;
  const book = XLSX.utils.book_new();

  // ── Summary ────────────────────────────────────────────────────────────────
  const summaryRows: Cell[][] = [
    ['Reconciliation statement', null],
    ['As at', formatLedgerDate(statement.reconciliationDate)],
    ['Prepared by', preparedBy],
    ['Timing tolerance', statement.toleranceDays === null ? 'None' : `${statement.toleranceDays} days`],
    [null, null],
    ['Outcome', STATUS_LABEL[statement.status]],
    ['Unexplained difference', statement.variance],
    [null, null],
    ['Starting from', statement.startingLedgerName],
    ['Balance you started at', statement.startingBalance],
    ['On the', statement.startingBalanceType === 'Dr' ? 'Debit side' : 'Credit side'],
    ['Reconciling to', statement.otherLedgerName],
    ['Balance you arrived at', statement.calculatedClosing],
    ['On the', statement.targetClosingType === 'Dr' ? 'Debit side' : 'Credit side'],
    [null, null],
    ['Matched', result.counts.MATCHED],
    ['Timing differences', result.counts.TIMING],
    ['One-sided entries', result.counts.ONE_SIDED],
    ['Amount differences', result.counts.AMOUNT_DIFF],
    [null, null],
    [`${summaryA.name} (Ledger A)`, null],
    ['Opening balance', summaryA.openingBalance],
    ['Total debits', summaryA.totalDebits],
    ['Total credits', summaryA.totalCredits],
    ['Closing balance', summaryA.calculatedClosing],
    ['On the', summaryA.balanceType === 'Dr' ? 'Debit side' : 'Credit side'],
    ['Lines counted', summaryA.transactionCount],
    [null, null],
    [`${summaryB.name} (Ledger B)`, null],
    ['Opening balance', summaryB.openingBalance],
    ['Total debits', summaryB.totalDebits],
    ['Total credits', summaryB.totalCredits],
    ['Closing balance', summaryB.calculatedClosing],
    ['On the', summaryB.balanceType === 'Dr' ? 'Debit side' : 'Credit side'],
    ['Lines counted', summaryB.transactionCount],
  ];

  const summary = XLSX.utils.aoa_to_sheet(summaryRows);
  formatColumn(summary, 1, 0, summaryRows.length - 1);
  summary['!cols'] = [{ wch: 30 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(book, summary, 'Summary');

  // ── Statement ──────────────────────────────────────────────────────────────
  // Laid out the way it is printed: a balance, the adjustments, a balance. The
  // Add and Less columns are separate so the two can be totalled independently.
  const statementRows: Cell[][] = [
    ['Particulars', 'Add', 'Less'],
    [`Balance as per ${statement.startingLedgerName} (${statement.startingBalanceType})`, statement.startingBalance, null],
    ...statement.lines.map((line): Cell[] => [
      line.description,
      line.operation === 'add' ? line.amount : null,
      line.operation === 'less' ? line.amount : null,
    ]),
    [`Balance as per ${statement.otherLedgerName} (${statement.targetClosingType})`, statement.calculatedClosing, null],
  ];
  if (Math.abs(statement.variance) >= 0.01) {
    statementRows.push([
      `${statement.otherLedgerName}, as that file states it (${statement.targetClosingType})`,
      statement.targetClosing,
      null,
    ]);
    statementRows.push(['Unexplained difference', statement.variance, null]);
  }

  const stmt = XLSX.utils.aoa_to_sheet(statementRows);
  formatColumn(stmt, 1, 1, statementRows.length - 1);
  formatColumn(stmt, 2, 1, statementRows.length - 1);
  stmt['!cols'] = [{ wch: 62 }, { wch: 16 }, { wch: 16 }];
  stmt['!freeze'] = { xSplit: '0', ySplit: '1', topLeftCell: 'A2', activePane: 'bottomLeft' };
  XLSX.utils.book_append_sheet(book, stmt, 'Statement');

  // ── Lines ──────────────────────────────────────────────────────────────────
  // Matched entries included, and marked as such. This sheet is the evidence of
  // what was examined, not only of what went wrong.
  const header: Cell[] = [
    'Type',
    'Particular',
    `${summaryA.name} amount`,
    `${summaryA.name} date`,
    `${summaryB.name} amount`,
    `${summaryB.name} date`,
    'Difference',
    'Likely cause',
    'Posted in',
    'Note',
  ];
  const lineRows: Cell[][] = [...result.differences, ...result.matched].map((item) => [
    CATEGORY_LABEL[item.category],
    item.particular,
    item.ledgerAAmount,
    item.ledgerADate,
    item.ledgerBAmount,
    item.ledgerBDate,
    item.difference ?? null,
    item.differenceClass && item.differenceClass !== 'None' ? item.differenceClass : null,
    item.postedIn ?? null,
    item.note,
  ]);

  const lines = XLSX.utils.aoa_to_sheet([header, ...lineRows]);
  for (const column of [2, 4, 6]) formatColumn(lines, column, 1, lineRows.length);
  lines['!cols'] = widths([header, ...lineRows], [16, 44, 18, 14, 18, 14, 14, 14, 10, 70]);
  lines['!freeze'] = { xSplit: '0', ySplit: '1', topLeftCell: 'A2', activePane: 'bottomLeft' };
  if (lineRows.length > 0) {
    lines['!autofilter'] = {
      ref: XLSX.utils.encode_range(
        { c: 0, r: 0 },
        { c: header.length - 1, r: lineRows.length },
      ),
    };
  }
  XLSX.utils.book_append_sheet(book, lines, 'Lines');

  return book;
}

export function buildReconXlsx(result: ReconResult, preparedBy: string): Buffer {
  return XLSX.write(buildReconWorkbook(result, preparedBy), {
    type: 'buffer',
    bookType: 'xlsx',
  }) as Buffer;
}
