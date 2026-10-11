import * as XLSX from 'xlsx';

/**
 * Excel and CSV, into rows of strings.
 *
 * Everything comes back as text on purpose. The row parser already knows how to
 * read `10,00,000`, `(2,000)` and `15000 Cr`, and it is the only place that
 * should be deciding what a cell means. Handing it half-interpreted values would
 * give the file two chances to be misread instead of one.
 */

/**
 * One Excel cell, as text.
 *
 * The date branch is the important one. A date-formatted cell arrives as a real
 * Date, and rendering it the obvious way gives an ISO `2026-04-01`, which the
 * day-first parser downstream then reads as the 1st of… something, because
 * `2001-04-12` is genuinely ambiguous once you have decided day comes first.
 * Writing the month as a NAME removes the ambiguity entirely: `01-Apr-2026`
 * parses back to the same day under any convention.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const day = String(value.getDate()).padStart(2, '0');
    return `${day}-${MONTHS[value.getMonth()]}-${value.getFullYear()}`;
  }
  return String(value).trim();
}

export type RawSheet = { rows: string[][]; text: string };

/** How many rows have anything in them at all. Picks the sheet that matters. */
function populated(rows: string[][]): number {
  return rows.filter((r) => r.some((c) => c)).length;
}

export function readWorkbook(data: ArrayBuffer): RawSheet {
  const book = XLSX.read(data, { type: 'array', cellDates: true });

  let best: string[][] = [];
  const textParts: string[] = [];

  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    if (!sheet) continue;

    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      blankrows: true,
      defval: null,
    });
    const rows = raw.map((row) => (Array.isArray(row) ? row.map(cellText) : []));
    for (const row of rows) textParts.push(row.join(' '));

    // A workbook often carries a cover sheet and the ledger. The ledger is the
    // one with rows in it.
    if (populated(rows) > populated(best)) best = rows;
  }

  return { rows: best, text: textParts.join('\n') };
}

// CSV reading lives in ./csv, free of the spreadsheet engine, so the public
// site's reconciliation demo can read the sample ledgers without shipping
// SheetJS. Re-exported here so every existing caller is unchanged.
export { readCsv } from './csv';
