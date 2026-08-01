import type { VoucherStatus } from '@/lib/domain/workflow';
import { STATUS_META } from '@/lib/domain/workflow';
import { toNum } from '@/lib/domain/voucher';

/**
 * The Excel / Google Sheet column contract.
 *
 * Columns 1–32 are v1's exact set, in v1's exact order, with v1's exact header
 * text. Their accountant's sheet is keyed to these positions, so they are
 * frozen — new information goes on the end, never in the middle.
 *
 * Two things do change, both improvements rather than contract breaks:
 *
 *   * Amounts are written as real numbers, not strings, so Excel can sum and
 *     filter them. v1 wrote whatever `numeric` came back as, which arrives from
 *     PostgREST as a string and lands in Excel as text — the classic
 *     "SUM() returns 0" complaint.
 *   * Dates are written as real dates displayed dd/mm/yyyy. They read exactly as
 *     before but now sort and filter correctly, where v1's pre-formatted
 *     strings sorted alphabetically.
 */

export type ExportRow = {
  voucher_no: string | null;
  status: VoucherStatus;
  date: string | null;
  sponsored: string | null;
  event_name: string | null;
  event_narration: string | null;
  type_of_supporting: string | null;
  type_of_payment: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  invoice_received_date: string | null;

  basic_value: string | number;
  cgst: string | number;
  sgst: string | number;
  igst: string | number;
  vat: string | number;
  net_total: string | number;
  tds: string | number;
  advance: string | number;
  tips: string | number;
  discount: string | number;
  grand_total: string | number;

  paid_to: string | null;
  payment_date: string | null;
  beneficiary_name: string | null;
  utr_ref: string | null;
  pan_number: string | null;
  gst_number: string | null;

  submitted_at: string | null;
  approved_1_at: string | null;
  approved_2_at: string | null;
  paid_at: string | null;

  chapter?: { name: string } | null;
  paid_by?: { name: string } | null;
  initiator?: { full_name: string | null; email: string } | null;
  first_approver?: { full_name: string | null; email: string } | null;
  second_approver?: { full_name: string | null; email: string } | null;
  voucher_attachments?: { id: string }[] | null;
};

/** What a cell may hold. `null` becomes an empty cell rather than "null". */
export type CellValue = string | number | Date | null;

export type ColumnKind = 'text' | 'money' | 'date' | 'count';

export type Column = {
  header: string;
  kind: ColumnKind;
  value: (v: ExportRow) => CellValue;
};

/** ISO date → a real Date, pinned to midday so time zones cannot shift the day. */
const asDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const person = (p: { full_name: string | null; email: string } | null | undefined): string | null =>
  p?.full_name ?? p?.email ?? null;

const blank = (s: string | null | undefined): string | null => (s?.trim() ? s : null);

/**
 * Columns 1–32: v1's contract. Do not reorder, rename, or insert.
 */
export const LEGACY_COLUMNS: Column[] = [
  { header: 'Date', kind: 'date', value: (v) => asDate(v.date) },
  { header: 'Chapter', kind: 'text', value: (v) => v.chapter?.name ?? null },
  { header: 'Voucher No.', kind: 'text', value: (v) => v.voucher_no },
  { header: 'Sponsored / Non-Sponsored', kind: 'text', value: (v) => v.sponsored },
  { header: 'Event Name', kind: 'text', value: (v) => blank(v.event_name) },
  { header: 'Event Narration', kind: 'text', value: (v) => blank(v.event_narration) },
  { header: 'Type of Supporting', kind: 'text', value: (v) => v.type_of_supporting },
  { header: 'Type of Payment', kind: 'text', value: (v) => v.type_of_payment },
  { header: 'Invoice No.', kind: 'text', value: (v) => blank(v.invoice_no) },
  { header: 'Invoice Date', kind: 'date', value: (v) => asDate(v.invoice_date) },
  { header: 'Invoice Received Date', kind: 'date', value: (v) => asDate(v.invoice_received_date) },
  { header: 'Basic Value', kind: 'money', value: (v) => toNum(v.basic_value) },
  { header: 'CGST', kind: 'money', value: (v) => toNum(v.cgst) },
  { header: 'SGST', kind: 'money', value: (v) => toNum(v.sgst) },
  { header: 'IGST', kind: 'money', value: (v) => toNum(v.igst) },
  { header: 'VAT / Other Charges', kind: 'money', value: (v) => toNum(v.vat) },
  { header: 'Net Total', kind: 'money', value: (v) => toNum(v.net_total) },
  { header: 'TDS', kind: 'money', value: (v) => toNum(v.tds) },
  { header: 'Advance', kind: 'money', value: (v) => toNum(v.advance) },
  { header: 'Tips', kind: 'money', value: (v) => toNum(v.tips) },
  { header: 'Discount', kind: 'money', value: (v) => toNum(v.discount) },
  { header: 'Grand Total', kind: 'money', value: (v) => toNum(v.grand_total) },
  { header: 'Paid To', kind: 'text', value: (v) => blank(v.paid_to) },
  { header: 'Paid By Chapter', kind: 'text', value: (v) => v.paid_by?.name ?? null },
  { header: 'Payment Date', kind: 'date', value: (v) => asDate(v.payment_date) },
  { header: 'Beneficiary Name', kind: 'text', value: (v) => blank(v.beneficiary_name) },
  { header: 'UTR / Ref No.', kind: 'text', value: (v) => blank(v.utr_ref) },
  { header: 'PAN Number', kind: 'text', value: (v) => blank(v.pan_number) },
  { header: 'GST Number', kind: 'text', value: (v) => blank(v.gst_number) },
  // These three were free text in v1, typed by whoever raised the voucher.
  // They now resolve to the people who actually acted.
  { header: 'Initiated By', kind: 'text', value: (v) => person(v.initiator) },
  { header: '1st Approval Done By', kind: 'text', value: (v) => person(v.first_approver) },
  { header: '2nd Approval Done By', kind: 'text', value: (v) => person(v.second_approver) },
];

/**
 * Columns 33+: what the workflow now knows and v1 could not. Appended so every
 * legacy column keeps its position.
 */
export const WORKFLOW_COLUMNS: Column[] = [
  { header: 'Status', kind: 'text', value: (v) => STATUS_META[v.status].label },
  { header: 'Submitted On', kind: 'date', value: (v) => asDate(v.submitted_at) },
  { header: '1st Approval On', kind: 'date', value: (v) => asDate(v.approved_1_at) },
  { header: '2nd Approval On', kind: 'date', value: (v) => asDate(v.approved_2_at) },
  { header: 'Paid On', kind: 'date', value: (v) => asDate(v.paid_at) },
  { header: 'Files Attached', kind: 'count', value: (v) => v.voucher_attachments?.length ?? 0 },
];

export const EXPORT_COLUMNS: Column[] = [...LEGACY_COLUMNS, ...WORKFLOW_COLUMNS];

/** Excel number formats. `#,##0.00` groups Western-style; Excel has no en-IN lakh format. */
export const NUMBER_FORMATS: Record<ColumnKind, string | undefined> = {
  text: undefined,
  money: '#,##0.00',
  date: 'dd/mm/yyyy',
  count: '0',
};

export const SHEET_NAME = 'Vouchers';

/** `NVR-Vouchers-2026-08-01.xlsx` — sorts chronologically in a downloads folder. */
export function exportFilename(today: Date, suffix?: string): string {
  const stamp = today.toISOString().slice(0, 10);
  const tail = suffix ? `-${suffix.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : '';
  return `NVR-Vouchers${tail}-${stamp}.xlsx`;
}
