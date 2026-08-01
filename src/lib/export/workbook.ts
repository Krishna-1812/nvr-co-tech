import * as XLSX from 'xlsx';
import {
  EXPORT_COLUMNS,
  NUMBER_FORMATS,
  SHEET_NAME,
  type ExportRow,
  type CellValue,
} from './columns';

/**
 * Build the .xlsx.
 *
 * Beyond v1's flat dump this adds a frozen header row, an autofilter, sensible
 * column widths, real number formats, and a totals row — the things that make a
 * finance export usable rather than merely present.
 */

/** Rough width from the widest value in a column, clamped to something sane. */
function widthFor(header: string, values: CellValue[]): number {
  const longest = values.reduce<number>((max, v) => {
    if (v === null) return max;
    const len = v instanceof Date ? 10 : String(v).length;
    return Math.max(max, len);
  }, header.length);
  return Math.min(Math.max(longest + 2, 12), 42);
}

export function buildVoucherWorkbook(rows: ExportRow[]): XLSX.WorkBook {
  const headers = EXPORT_COLUMNS.map((c) => c.header);
  const body = rows.map((r) => EXPORT_COLUMNS.map((c) => c.value(r)));

  // A totals row is what people reach for first. It is laid out as an empty row
  // here and filled with SUM() formulas below, so it keeps adding up if someone
  // filters or edits the sheet afterwards.
  const hasRows = rows.length > 0;
  const emptyRow: CellValue[] = EXPORT_COLUMNS.map(() => null);

  const aoa: CellValue[][] = hasRows ? [headers, ...body, emptyRow] : [headers, ...body];
  const sheet = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });

  const lastCol = EXPORT_COLUMNS.length - 1;
  const dataFirstRow = 2; // 1-based, after the header
  const dataLastRow = rows.length + 1;
  const totalsRow = dataLastRow + 1;

  // Number formats, applied per column across the data rows.
  EXPORT_COLUMNS.forEach((col, c) => {
    const fmt = NUMBER_FORMATS[col.kind];
    if (!fmt) return;
    for (let r = dataFirstRow; r <= dataLastRow; r += 1) {
      const ref = XLSX.utils.encode_cell({ c, r: r - 1 });
      const cell = sheet[ref];
      if (cell && cell.v !== undefined && cell.v !== null) cell.z = fmt;
    }
  });

  // Totals are live SUM() formulas *with* a cached value. The formula keeps the
  // total honest if the sheet is edited; the cached value means readers that do
  // not evaluate formulas — Google Sheets previews, pandas, Numbers — still show
  // the right figure. A formula cell with no cached value is also dropped
  // entirely by the writer, which is how this was first caught.
  if (hasRows) {
    EXPORT_COLUMNS.forEach((col, c) => {
      if (col.kind !== 'money') return;
      const letter = XLSX.utils.encode_col(c);
      const sum = body.reduce<number>(
        (acc, r) => acc + (typeof r[c] === 'number' ? (r[c] as number) : 0),
        0,
      );
      const ref = XLSX.utils.encode_cell({ c, r: totalsRow - 1 });
      sheet[ref] = {
        t: 'n',
        // Rounded to paise: floating-point addition of currency drifts.
        v: Math.round(sum * 100) / 100,
        f: `SUM(${letter}${dataFirstRow}:${letter}${dataLastRow})`,
        z: NUMBER_FORMATS.money,
      };
    });
    const labelRef = XLSX.utils.encode_cell({ c: 0, r: totalsRow - 1 });
    sheet[labelRef] = { t: 's', v: 'TOTAL' };
  }

  sheet['!cols'] = EXPORT_COLUMNS.map((col, c) =>
    ({ wch: widthFor(col.header, body.map((row) => row[c])) }),
  );

  // Freeze the header, and filter across it.
  sheet['!freeze'] = { xSplit: '0', ySplit: '1', topLeftCell: 'A2', activePane: 'bottomLeft' };
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range(
      { c: 0, r: 0 },
      { c: lastCol, r: Math.max(dataLastRow - 1, 0) },
    ),
  };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, SHEET_NAME);
  return book;
}

/** Serialise to a buffer for an HTTP response. */
export function workbookToBuffer(book: XLSX.WorkBook): Buffer {
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx', cellDates: true }) as Buffer;
}

export function buildVoucherXlsx(rows: ExportRow[]): Buffer {
  return workbookToBuffer(buildVoucherWorkbook(rows));
}
