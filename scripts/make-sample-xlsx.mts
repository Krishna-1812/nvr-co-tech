import { writeFileSync } from 'node:fs';
import { buildVoucherXlsx } from '../src/lib/export/workbook';
import type { ExportRow } from '../src/lib/export/columns';

/** Writes sample-export.xlsx so the export can be opened without a database. */

const base: ExportRow = {
  voucher_no: 'NVR/HYD/25-26/0042', status: 'approved', date: '2026-02-14',
  sponsored: 'Sponsored', event_name: 'Annual CIO Summit 2026',
  event_narration: 'Venue hire, catering and AV', type_of_supporting: 'Invoice',
  type_of_payment: 'Full Payment', invoice_no: 'INV-2026-889',
  invoice_date: '2026-02-11', invoice_received_date: '2026-02-12',
  basic_value: '250000.00', cgst: '22500.00', sgst: '22500.00', igst: '0.00',
  vat: '0.00', net_total: '295000.00', tds: '25000.00', advance: '50000.00',
  tips: '0.00', discount: '5000.00', grand_total: '215000.00',
  paid_to: 'Grand Venues Pvt Ltd', payment_date: '2026-02-20',
  beneficiary_name: 'Grand Venues Pvt Ltd', utr_ref: 'HDFCN52026021400123',
  pan_number: 'AAPFU0939F', gst_number: '27AAPFU0939F1ZV',
  submitted_at: '2026-02-14T08:00:00Z', approved_1_at: '2026-02-15T10:22:00Z',
  approved_2_at: '2026-02-16T09:05:00Z', paid_at: null,
  chapter: { name: 'CIO Association Hyderabad' }, paid_by: { name: 'CIO Association HO' },
  initiator: { full_name: 'Priya Nair', email: 'priya@nvrco.in' },
  first_approver: { full_name: 'Rahul Menon', email: 'rahul@nvrco.in' },
  second_approver: { full_name: 'Anita Desai', email: 'anita@nvrco.in' },
  voucher_attachments: [{ id: 'a' }, { id: 'b' }],
};

const rows: ExportRow[] = [
  base,
  { ...base, voucher_no: 'NVR/BOM/25-26/0018', status: 'pending_second',
    chapter: { name: 'CIO Association Mumbai' }, paid_to: 'Skyline AV Rentals',
    event_name: 'Mumbai Chapter Meet', sponsored: 'Non-Sponsored',
    basic_value: '80000.00', cgst: '0.00', sgst: '0.00', igst: '14400.00',
    net_total: '94400.00', tds: '8000.00', advance: '0.00', discount: '0.00',
    grand_total: '86400.00', second_approver: null, approved_2_at: null,
    utr_ref: null, paid_at: null, voucher_attachments: [{ id: 'c' }] },
  { ...base, voucher_no: 'NVR/DEL/25-26/0007', status: 'paid',
    chapter: { name: 'CIO Association Delhi' }, paid_to: 'Print House',
    event_name: 'Delhi Roundtable', basic_value: '32000.00',
    cgst: '2880.00', sgst: '2880.00', igst: '0.00', net_total: '37760.00',
    tds: '3200.00', advance: '0.00', discount: '0.00', grand_total: '34560.00',
    paid_at: '2026-02-22T06:00:00Z', voucher_attachments: [] },
];

const buf = buildVoucherXlsx(rows);
writeFileSync('sample-export.xlsx', buf);
console.log(`wrote sample-export.xlsx (${buf.length} bytes, ${rows.length} rows)`);
