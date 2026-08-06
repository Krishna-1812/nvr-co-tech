import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { readCsv, readWorkbook } from './sheet';

describe('readCsv', () => {
  it('reads a plain file', () => {
    const { rows } = readCsv('Date,Particular,Debit,Credit\n05-Apr-2026,Sales,100,\n');
    expect(rows).toEqual([
      ['Date', 'Particular', 'Debit', 'Credit'],
      ['05-Apr-2026', 'Sales', '100', ''],
    ]);
  });

  it('keeps a comma inside a quoted narration', () => {
    const { rows } = readCsv('05-Apr-2026,"Sales, net of discount",100,');
    expect(rows[0][1]).toBe('Sales, net of discount');
  });

  it('unescapes a doubled quote', () => {
    const { rows } = readCsv('05-Apr-2026,"He said ""yes""",100,');
    expect(rows[0][1]).toBe('He said "yes"');
  });

  it('treats CRLF as one line break', () => {
    const { rows } = readCsv('a,b\r\nc,d\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('strips a byte order mark, which would otherwise hide the Date header', () => {
    const { rows } = readCsv('﻿Date,Particular\n05-Apr-2026,Sales');
    expect(rows[0][0]).toBe('Date');
  });

  it('keeps the last line when the file does not end in a newline', () => {
    const { rows } = readCsv('a,b\nc,d');
    expect(rows).toHaveLength(2);
  });
});

describe('readWorkbook', () => {
  const build = (sheets: Record<string, unknown[][]>): ArrayBuffer => {
    const book = XLSX.utils.book_new();
    for (const [name, aoa] of Object.entries(sheets)) {
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }), name);
    }
    return XLSX.write(book, { type: 'array', bookType: 'xlsx', cellDates: true }) as ArrayBuffer;
  };

  it('reads cells as text so the row parser makes every decision', () => {
    const { rows } = readWorkbook(
      build({ Ledger: [['Date', 'Particular', 'Debit'], ['05-Apr-2026', 'Sales', 50000]] }),
    );
    expect(rows[1]).toEqual(['05-Apr-2026', 'Sales', '50000']);
  });

  it('writes a real date cell with the month as a name', () => {
    /*
     * The whole point of this branch. An ISO 2026-04-01 handed to a day-first
     * parser is genuinely ambiguous; 01-Apr-2026 reads the same either way.
     */
    const { rows } = readWorkbook(
      build({ Ledger: [['Date', 'Particular'], [new Date(2026, 3, 1), 'Sales']] }),
    );
    expect(rows[1][0]).toBe('01-Apr-2026');
  });

  it('picks the sheet with the ledger on it, not the cover sheet', () => {
    const { rows } = readWorkbook(
      build({
        Cover: [['Prepared by Someone']],
        Ledger: [
          ['Date', 'Particular', 'Debit'],
          ['05-Apr-2026', 'Sales', 100],
          ['06-Apr-2026', 'Rent', 40],
        ],
      }),
    );
    expect(rows[0]).toEqual(['Date', 'Particular', 'Debit']);
  });

  it('still gathers text from every sheet, so a balance on the cover is found', () => {
    const { text } = readWorkbook(
      build({
        Cover: [['Opening Balance (as on 01-Apr-2026): 10,00,000']],
        Ledger: [
          ['Date', 'Particular', 'Debit'],
          ['05-Apr-2026', 'Sales', 100],
        ],
      }),
    );
    expect(text).toContain('Opening Balance (as on 01-Apr-2026): 10,00,000');
  });
});
