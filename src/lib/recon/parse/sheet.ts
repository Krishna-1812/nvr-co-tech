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

/**
 * CSV, parsed here rather than handed to the spreadsheet reader.
 *
 * A CSV cell is always text, and running it through a spreadsheet engine invites
 * it to be helpfully converted — `01/04/2026` into a date under whatever
 * convention the machine's locale suggests, `0091` into 91. Thirty lines of
 * RFC 4180 avoids the whole class of problem.
 */
export function readCsv(text: string): RawSheet {
  // Strip a UTF-8 byte order mark, which otherwise becomes part of the first
  // header and stops "Date" matching.
  const source = text.replace(/^﻿/, '');

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n' || char === '\r') {
      // Treat CRLF as one break rather than as an empty row between lines.
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  // Whatever the file ended on, unless it ended cleanly on a newline.
  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return { rows, text: source };
}
