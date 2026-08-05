import { renderToBuffer } from '@react-pdf/renderer';
import { writeFileSync } from 'node:fs';
import { VoucherDocument, type PdfVoucher } from '../src/lib/pdf/VoucherDocument';

/**
 * Renders a representative voucher to `sample-voucher.pdf` so the layout can be
 * eyeballed without a database or a running app.
 *
 *   npm run pdf:sample
 */

const sample: PdfVoucher = {
  voucher_no: 'FI/HYD/25-26/0042',
  status: 'approved',
  date: '2026-02-14',
  chapter_name: 'CIO Association Hyderabad',
  sponsored: 'Sponsored',

  event_name: 'Annual CIO Summit 2026',
  event_date: '2026-02-10',
  event_narration: 'Venue hire, catering and AV for the two-day summit',

  type_of_supporting: 'Invoice',
  type_of_payment: 'Full Payment',
  invoice_no: 'INV-2026-889',
  invoice_date: '2026-02-11',
  invoice_received_date: '2026-02-12',

  basic_value: 250000,
  cgst: 22500,
  sgst: 22500,
  igst: 0,
  vat: 0,
  net_total: 295000,
  tds: 25000,
  advance: 50000,
  tips: 0,
  discount: 5000,
  grand_total: 215000,

  paid_to: 'Grand Venues Pvt Ltd',
  paid_by_chapter_name: 'CIO Association HO',
  payment_date: '2026-02-20',
  beneficiary_name: 'Grand Venues Pvt Ltd',
  utr_ref: 'HDFCN52026021400123',
  pan_number: 'AAPFU0939F',
  gst_number: '27AAPFU0939F1ZV',

  initiator: { full_name: 'Priya Nair', email: 'priya@financeintelligence.in' },
  first_approver: { full_name: 'Rahul Menon', email: 'rahul@financeintelligence.in' },
  second_approver: { full_name: 'Anita Desai', email: 'anita@financeintelligence.in' },
  approved_1_at: '2026-02-15T10:22:00Z',
  approved_2_at: '2026-02-16T09:05:00Z',
};

const buf = await renderToBuffer(<VoucherDocument v={sample} />);
writeFileSync('sample-voucher.pdf', buf);
console.log(`wrote sample-voucher.pdf (${buf.length} bytes)`);
