import type { RawSheet } from './sheet';

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
