import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildVoucherWorkbook, buildVoucherXlsx } from './workbook';
import {
  LEGACY_COLUMNS,
  EXPORT_COLUMNS,
  SHEET_NAME,
  exportFilename,
  type ExportRow,
} from './columns';

/**
 * The header row is a contract: their accountant's sheet is keyed to these
 * positions. Columns 1–32 are v1's exact set, verbatim from the original
 * `src/lib/excel.js`. If one of these assertions fails, someone has reordered
 * or renamed a column that downstream formulas depend on.
 */
const V1_HEADERS = [
  'Date', 'Chapter', 'Voucher No.', 'Sponsored / Non-Sponsored',
  'Event Name', 'Event Narration', 'Type of Supporting', 'Type of Payment',
  'Invoice No.', 'Invoice Date', 'Invoice Received Date',
  'Basic Value', 'CGST', 'SGST', 'IGST', 'VAT / Other Charges', 'Net Total',
  'TDS', 'Advance', 'Tips', 'Discount', 'Grand Total',
  'Paid To', 'Paid By Chapter', 'Payment Date', 'Beneficiary Name',
  'UTR / Ref No.', 'PAN Number', 'GST Number',
  'Initiated By', '1st Approval Done By', '2nd Approval Done By',
];

const row = (over: Partial<ExportRow> = {}): ExportRow => ({
  voucher_no: 'NVR/HYD/25-26/0042',
  status: 'approved',
  date: '2026-02-14',
  sponsored: 'Sponsored',
  event_name: 'Annual CIO Summit',
  event_narration: 'Venue and catering',
  type_of_supporting: 'Invoice',
  type_of_payment: 'Full Payment',
  invoice_no: 'INV-889',
  invoice_date: '2026-02-11',
  invoice_received_date: '2026-02-12',
  // PostgREST returns `numeric` as strings — that is the realistic input.
  basic_value: '250000.00',
  cgst: '22500.00',
  sgst: '22500.00',
  igst: '0.00',
  vat: '0.00',
  net_total: '295000.00',
  tds: '25000.00',
  advance: '50000.00',
  tips: '0.00',
  discount: '5000.00',
  grand_total: '215000.00',
  paid_to: 'Grand Venues Pvt Ltd',
  payment_date: '2026-02-20',
  beneficiary_name: 'Grand Venues Pvt Ltd',
  utr_ref: 'HDFCN52026021400123',
  pan_number: 'AAPFU0939F',
  gst_number: '27AAPFU0939F1ZV',
  submitted_at: '2026-02-14T08:00:00Z',
  approved_1_at: '2026-02-15T10:22:00Z',
  approved_2_at: '2026-02-16T09:05:00Z',
  paid_at: null,
  chapter: { name: 'CIO Association Hyderabad' },
  paid_by: { name: 'CIO Association HO' },
  initiator: { full_name: 'Priya Nair', email: 'priya@nvrco.in' },
  first_approver: { full_name: 'Rahul Menon', email: 'rahul@nvrco.in' },
  second_approver: { full_name: 'Anita Desai', email: 'anita@nvrco.in' },
  voucher_attachments: [{ id: 'a' }, { id: 'b' }],
  ...over,
});

/** Read the workbook back the way Excel would. */
function readBack(rows: ExportRow[]) {
  const buf = buildVoucherXlsx(rows);
  const book = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheet = book.Sheets[SHEET_NAME];
  const cell = (a1: string) => sheet[a1];
  return { book, sheet, cell };
}

describe('column contract', () => {
  it('preserves v1 columns 1-32 exactly, in order', () => {
    expect(LEGACY_COLUMNS.map((c) => c.header)).toEqual(V1_HEADERS);
  });

  it('appends new columns only after the legacy block', () => {
    const headers = EXPORT_COLUMNS.map((c) => c.header);
    expect(headers.slice(0, 32)).toEqual(V1_HEADERS);
    expect(headers.length).toBeGreaterThan(32);
  });

  it('has no duplicate headers', () => {
    const headers = EXPORT_COLUMNS.map((c) => c.header);
    expect(new Set(headers).size).toBe(headers.length);
  });
});

describe('workbook', () => {
  it('writes the header row', () => {
    const { cell } = readBack([row()]);
    expect(cell('A1').v).toBe('Date');
    expect(cell('C1').v).toBe('Voucher No.');
    expect(cell('AF1').v).toBe('2nd Approval Done By'); // 32nd column
  });

  /**
   * The bug this prevents: PostgREST hands back `numeric` as a string, and v1
   * wrote it straight through. Excel then stores text, SUM() returns 0, and the
   * accountant has to retype the column.
   */
  it('writes amounts as numbers, not text', () => {
    const { cell } = readBack([row()]);
    const basic = cell('L2');
    expect(basic.t).toBe('n');
    expect(basic.v).toBe(250000);

    const grand = cell('V2');
    expect(grand.t).toBe('n');
    expect(grand.v).toBe(215000);
  });

  it('writes dates as dates, displayed the Indian way', () => {
    const { cell } = readBack([row()]);
    const date = cell('A2');
    // Stored as a real date, so it sorts and filters correctly...
    expect(date.v).toBeInstanceOf(Date);
    // ...but renders dd/mm/yyyy, exactly as v1's strings read.
    expect(date.w).toBe('14/02/2026');
  });

  it('keeps the date on the right day regardless of time zone', () => {
    const { cell } = readBack([row({ date: '2026-02-14' })]);
    const d = cell('A2').v as Date;
    expect(d.getUTCDate()).toBe(14);
    expect(d.getUTCMonth()).toBe(1);
    expect(d.getUTCFullYear()).toBe(2026);
  });

  it('resolves people and chapters through their joins', () => {
    const { cell } = readBack([row()]);
    expect(cell('B2').v).toBe('CIO Association Hyderabad');
    expect(cell('X2').v).toBe('CIO Association HO');
    expect(cell('AD2').v).toBe('Priya Nair');
    expect(cell('AE2').v).toBe('Rahul Menon');
    expect(cell('AF2').v).toBe('Anita Desai');
  });

  it('falls back to email when someone has no name', () => {
    const { cell } = readBack([
      row({ initiator: { full_name: null, email: 'priya@nvrco.in' } }),
    ]);
    expect(cell('AD2').v).toBe('priya@nvrco.in');
  });

  /**
   * The total is a formula *and* a cached value. Without the cached value the
   * writer drops the cell entirely, and readers that do not evaluate formulas
   * show a blank total.
   */
  it('totals with a live formula and a cached value', () => {
    const { cell } = readBack([row(), row()]);
    const total = cell('L4'); // header + 2 rows
    expect(total).toBeDefined();
    expect(total.f).toBe('SUM(L2:L3)');
    expect(total.v).toBe(500000); // 2 × 250,000
    expect(cell('A4').v).toBe('TOTAL');
  });

  it('totals the grand total column too', () => {
    const { cell } = readBack([row(), row()]);
    expect(cell('V4').v).toBe(430000); // 2 × 215,000
  });

  it('carries the workflow columns v1 could not', () => {
    const { sheet, cell } = readBack([row()]);
    const headers = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0];
    expect(headers).toContain('Status');
    expect(headers).toContain('Files Attached');
    // Two attachments on the fixture.
    const filesCol = headers.indexOf('Files Attached');
    expect(cell(XLSX.utils.encode_cell({ c: filesCol, r: 1 })).v).toBe(2);
  });

  it('leaves blanks empty rather than writing "null"', () => {
    const { cell } = readBack([row({ invoice_no: null, event_name: '   ' })]);
    expect(cell('I2')?.v ?? '').toBe('');
    expect(cell('E2')?.v ?? '').toBe('');
  });

  it('produces a valid file with no rows at all', () => {
    const { sheet } = readBack([]);
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    expect(rows).toHaveLength(1); // headers only, no TOTAL row
  });

  it('freezes the header and sets an autofilter', () => {
    const book = buildVoucherWorkbook([row()]);
    const sheet = book.Sheets[SHEET_NAME];
    expect(sheet['!freeze']).toBeDefined();
    expect(sheet['!autofilter']).toBeDefined();
  });

  it('handles a few hundred rows', () => {
    const many = Array.from({ length: 400 }, (_, i) =>
      row({ voucher_no: `NVR/HO/25-26/${String(i).padStart(4, '0')}` }),
    );
    const buf = buildVoucherXlsx(many);
    expect(buf.length).toBeGreaterThan(5000);
  });
});

describe('exportFilename', () => {
  it('stamps the date so downloads sort chronologically', () => {
    expect(exportFilename(new Date('2026-08-01T09:00:00Z'))).toBe('NVR-Vouchers-2026-08-01.xlsx');
  });

  it('marks a filtered export', () => {
    expect(exportFilename(new Date('2026-08-01T09:00:00Z'), 'filtered')).toBe(
      'NVR-Vouchers-filtered-2026-08-01.xlsx',
    );
  });
});
