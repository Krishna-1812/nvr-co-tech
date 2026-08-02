import { calcTax, calcNetTotal, calcGrandTotal } from '@/lib/domain/voucher';
import type { Voucher } from '@/lib/supabase/types';

/**
 * Sample data for preview mode. Realistic enough to judge the design against —
 * a spread of statuses, chapters, amounts and both GST modes — and deliberately
 * obvious as fiction.
 *
 * Financial year 26-27 (1 April 2026 – 31 March 2027), so voucher numbers read
 * the way real ones would.
 */

const DAY = 86_400_000;
/** Fixed "now" so the data does not drift as the sample ages. */
const NOW = new Date('2026-08-02T09:30:00.000Z').getTime();
const ago = (days: number, hours = 0) => new Date(NOW - days * DAY - hours * 3_600_000).toISOString();
const dateOnly = (days: number) => new Date(NOW - days * DAY).toISOString().slice(0, 10);

// ─── People ──────────────────────────────────────────────────────────────────

export const PREVIEW_USER_ID = 'p-owner';

export const profiles = [
  {
    id: PREVIEW_USER_ID,
    email: 'vivek@nvrco.in',
    full_name: 'Vivek Gaggar',
    role: 'owner' as const,
    is_active: true,
    created_at: ago(400),
    updated_at: ago(400),
  },
  {
    id: 'p-admin',
    email: 'anjali@nvrco.in',
    full_name: 'Anjali Mehta',
    role: 'admin' as const,
    is_active: true,
    created_at: ago(360),
    updated_at: ago(360),
  },
  {
    id: 'p-appr1',
    email: 'rohit@nvrco.in',
    full_name: 'Rohit Sharma',
    role: 'approver' as const,
    is_active: true,
    created_at: ago(300),
    updated_at: ago(300),
  },
  {
    id: 'p-appr2',
    email: 'priya@nvrco.in',
    full_name: 'Priya Nair',
    role: 'approver' as const,
    is_active: true,
    created_at: ago(280),
    updated_at: ago(280),
  },
  {
    id: 'p-mem1',
    email: 'karthik@nvrco.in',
    full_name: 'Karthik Rao',
    role: 'member' as const,
    is_active: true,
    created_at: ago(120),
    updated_at: ago(120),
  },
  {
    id: 'p-mem2',
    email: 'sneha@nvrco.in',
    full_name: 'Sneha Iyer',
    role: 'member' as const,
    is_active: true,
    created_at: ago(45),
    updated_at: ago(45),
  },
];

// ─── Chapters ────────────────────────────────────────────────────────────────

export const chapters = [
  { id: 'c-ho', name: 'CIO Association Head Office', code: 'HO', is_head_office: true, is_active: true, created_at: ago(400), deleted_at: null },
  { id: 'c-blr', name: 'CIO Association Bengaluru', code: 'BLR', is_head_office: false, is_active: true, created_at: ago(400), deleted_at: null },
  { id: 'c-bom', name: 'CIO Association Mumbai', code: 'BOM', is_head_office: false, is_active: true, created_at: ago(400), deleted_at: null },
  { id: 'c-del', name: 'CIO Association Delhi', code: 'DEL', is_head_office: false, is_active: true, created_at: ago(400), deleted_at: null },
  { id: 'c-maa', name: 'CIO Association Chennai', code: 'MAA', is_head_office: false, is_active: true, created_at: ago(400), deleted_at: null },
  { id: 'c-hyd', name: 'CIO Association Hyderabad', code: 'HYD', is_head_office: false, is_active: true, created_at: ago(400), deleted_at: null },
  { id: 'c-pnq', name: 'CIO Association Pune', code: 'PNQ', is_head_office: false, is_active: true, created_at: ago(400), deleted_at: null },
  { id: 'c-goa', name: 'CIO Association Goa', code: 'GOA', is_head_office: false, is_active: false, created_at: ago(400), deleted_at: null },
];

// ─── Events ──────────────────────────────────────────────────────────────────

export const events = [
  { id: 'e-1', name: 'CIO Summit 2026', chapter_id: 'c-blr', date_of_event: dateOnly(30), created_by: PREVIEW_USER_ID, created_at: ago(60), deleted_at: null },
  { id: 'e-2', name: 'CISO Round Table', chapter_id: 'c-bom', date_of_event: dateOnly(18), created_by: 'p-admin', created_at: ago(40), deleted_at: null },
  { id: 'e-3', name: 'Annual General Meeting', chapter_id: 'c-ho', date_of_event: dateOnly(9), created_by: PREVIEW_USER_ID, created_at: ago(25), deleted_at: null },
  { id: 'e-4', name: 'Cloud Leadership Forum', chapter_id: 'c-del', date_of_event: dateOnly(3), created_by: 'p-mem1', created_at: ago(15), deleted_at: null },
];

// ─── Vouchers ────────────────────────────────────────────────────────────────

/** The amount fields; the three totals are derived exactly as Postgres would. */
type Amounts = Pick<
  Voucher,
  'basic_value' | 'cgst' | 'sgst' | 'igst' | 'vat' | 'tds' | 'advance' | 'tips' | 'discount'
>;

const amounts = (partial: Partial<Amounts>): Amounts => ({
  basic_value: 0, cgst: 0, sgst: 0, igst: 0, vat: 0, tds: 0, advance: 0, tips: 0, discount: 0,
  ...partial,
});

/**
 * Build a voucher, computing total_tax / net_total / grand_total with the same
 * functions the form uses. In the real schema these are GENERATED columns, so
 * deriving them here keeps the fixture from stating a total the database would
 * never produce.
 */
function voucher(v: Partial<Voucher> & { id: string; status: Voucher['status']; created_by: string }): Voucher {
  const a = amounts(v);
  return {
    voucher_no: null,
    date: null, chapter_id: null, sponsored: null,
    event_id: null, event_name: null, event_date: null, event_narration: null,
    type_of_supporting: null, type_of_payment: null,
    invoice_no: null, invoice_date: null, invoice_received_date: null,
    paid_to: null, paid_by_chapter_id: null, payment_date: null,
    beneficiary_name: null, utr_ref: null, pan_number: null, gst_number: null,
    initiated_by: null, initiated_at: null, submitted_at: null,
    approver_1: null, approved_1_at: null, approver_2: null, approved_2_at: null,
    rejected_by: null, rejected_at: null, rejection_reason: null,
    paid_marked_by: null, paid_at: null,
    created_at: ago(10), updated_at: ago(10), deleted_at: null,
    ...v,
    ...a,
    total_tax: calcTax(a),
    net_total: calcNetTotal(a),
    grand_total: calcGrandTotal(a),
  } as Voucher;
}

export const vouchers: Voucher[] = [
  // ── Raised by the preview user (drive the dashboard and its pipeline) ──
  voucher({
    id: 'v-01', status: 'paid', created_by: PREVIEW_USER_ID,
    voucher_no: 'NVR/BLR/26-27/0001', date: dateOnly(34), chapter_id: 'c-blr', sponsored: 'Sponsored',
    event_id: 'e-1', event_name: 'CIO Summit 2026', event_date: dateOnly(30),
    event_narration: 'Venue hire and AV for the two-day summit.',
    type_of_supporting: 'Invoice', type_of_payment: 'Full Payment',
    invoice_no: 'TRV/26/1187', invoice_date: dateOnly(36), invoice_received_date: dateOnly(35),
    basic_value: 485000, cgst: 43650, sgst: 43650, tds: 9700,
    paid_to: 'Taj Vivanta Events Pvt Ltd', paid_by_chapter_id: 'c-blr', payment_date: dateOnly(20),
    beneficiary_name: 'Taj Vivanta Events Pvt Ltd', utr_ref: 'HDFC26071900418823',
    pan_number: 'AABCT3518Q', gst_number: '29AABCT3518Q1ZR',
    initiated_by: PREVIEW_USER_ID, initiated_at: ago(34), submitted_at: ago(33),
    approver_1: 'p-appr1', approved_1_at: ago(31), approver_2: 'p-admin', approved_2_at: ago(30),
    paid_marked_by: 'p-admin', paid_at: ago(20), created_at: ago(34), updated_at: ago(20),
  }),
  voucher({
    id: 'v-02', status: 'approved', created_by: PREVIEW_USER_ID,
    voucher_no: 'NVR/HO/26-27/0004', date: dateOnly(12), chapter_id: 'c-ho', sponsored: 'Non-Sponsored',
    event_id: 'e-3', event_name: 'Annual General Meeting', event_date: dateOnly(9),
    event_narration: 'Statutory audit fee for FY 25-26.',
    type_of_supporting: 'Invoice', type_of_payment: 'Full Payment',
    invoice_no: 'NVR/AUD/0042', invoice_date: dateOnly(14), invoice_received_date: dateOnly(13),
    basic_value: 250000, igst: 45000, tds: 25000,
    paid_to: 'N V R & Co', paid_by_chapter_id: 'c-ho',
    beneficiary_name: 'N V R & Co', pan_number: 'AAAFN4521K', gst_number: '27AAAFN4521K1Z8',
    initiated_by: PREVIEW_USER_ID, initiated_at: ago(12), submitted_at: ago(11),
    approver_1: 'p-appr2', approved_1_at: ago(9), approver_2: 'p-admin', approved_2_at: ago(8),
    created_at: ago(12), updated_at: ago(8),
  }),
  voucher({
    id: 'v-03', status: 'pending_second', created_by: PREVIEW_USER_ID,
    voucher_no: 'NVR/BOM/26-27/0009', date: dateOnly(6), chapter_id: 'c-bom', sponsored: 'Sponsored',
    event_id: 'e-2', event_name: 'CISO Round Table', event_date: dateOnly(18),
    event_narration: 'Catering for 120 delegates.',
    type_of_supporting: 'Invoice', type_of_payment: 'Full Payment',
    invoice_no: 'BLU/9921', invoice_date: dateOnly(8), invoice_received_date: dateOnly(7),
    basic_value: 178500, cgst: 16065, sgst: 16065, tds: 3570,
    paid_to: 'Blue Ginger Hospitality LLP', paid_by_chapter_id: 'c-bom',
    beneficiary_name: 'Blue Ginger Hospitality LLP', pan_number: 'AAGFB8812M', gst_number: '27AAGFB8812M1ZK',
    initiated_by: PREVIEW_USER_ID, initiated_at: ago(6), submitted_at: ago(5),
    approver_1: 'p-appr1', approved_1_at: ago(3),
    created_at: ago(6), updated_at: ago(3),
  }),
  voucher({
    id: 'v-04', status: 'rejected', created_by: PREVIEW_USER_ID,
    date: dateOnly(4), chapter_id: 'c-del', sponsored: 'Non-Sponsored',
    event_id: 'e-4', event_name: 'Cloud Leadership Forum', event_date: dateOnly(3),
    event_narration: 'Speaker travel reimbursement.',
    type_of_supporting: 'Reimbursement', type_of_payment: 'Full Payment',
    invoice_no: 'RMB/0071', invoice_date: dateOnly(5), invoice_received_date: dateOnly(4),
    basic_value: 62400,
    paid_to: 'Arvind Krishnan', paid_by_chapter_id: 'c-del',
    beneficiary_name: 'Arvind Krishnan', pan_number: 'AFZPK7190B',
    initiated_by: PREVIEW_USER_ID, initiated_at: ago(4), submitted_at: ago(4),
    rejected_by: 'p-admin', rejected_at: ago(2),
    rejection_reason:
      'Boarding passes are missing for the return leg. Please attach them and resubmit.',
    created_at: ago(4), updated_at: ago(2),
  }),
  voucher({
    id: 'v-05', status: 'draft', created_by: PREVIEW_USER_ID,
    date: dateOnly(1), chapter_id: 'c-maa', sponsored: 'Sponsored',
    type_of_supporting: 'Proforma Invoice', type_of_payment: 'Advance',
    invoice_no: 'PF/2026/338', invoice_date: dateOnly(2),
    basic_value: 95000, cgst: 8550, sgst: 8550, advance: 25000,
    paid_to: 'Southern Print House', paid_by_chapter_id: 'c-maa',
    created_at: ago(1), updated_at: ago(0, 3),
  }),
  voucher({
    id: 'v-06', status: 'draft', created_by: PREVIEW_USER_ID,
    date: dateOnly(0), chapter_id: 'c-hyd',
    created_at: ago(0, 2), updated_at: ago(0, 1),
  }),
  voucher({
    id: 'v-07', status: 'paid', created_by: PREVIEW_USER_ID,
    voucher_no: 'NVR/PNQ/26-27/0002', date: dateOnly(58), chapter_id: 'c-pnq', sponsored: 'Sponsored',
    event_narration: 'Digital campaign for member drive.',
    type_of_supporting: 'Contract', type_of_payment: 'Advance',
    invoice_no: 'CTR/AGY/118', invoice_date: dateOnly(60), invoice_received_date: dateOnly(59),
    basic_value: 320000, igst: 57600, tds: 32000, advance: 100000, discount: 5000,
    paid_to: 'Northline Digital Agency', paid_by_chapter_id: 'c-pnq', payment_date: dateOnly(44),
    beneficiary_name: 'Northline Digital Agency', utr_ref: 'ICIC26061400291155',
    pan_number: 'AAECN2277J', gst_number: '27AAECN2277J1ZP',
    initiated_by: PREVIEW_USER_ID, initiated_at: ago(58), submitted_at: ago(57),
    approver_1: 'p-appr1', approved_1_at: ago(55), approver_2: 'p-appr2', approved_2_at: ago(54),
    paid_marked_by: 'p-admin', paid_at: ago(44), created_at: ago(58), updated_at: ago(44),
  }),

  // ── Raised by others: these populate the approval queue ──
  voucher({
    id: 'v-08', status: 'pending_first', created_by: 'p-mem1',
    voucher_no: 'NVR/DEL/26-27/0011', date: dateOnly(9), chapter_id: 'c-del', sponsored: 'Sponsored',
    event_id: 'e-4', event_name: 'Cloud Leadership Forum', event_date: dateOnly(3),
    event_narration: 'Stage design and branding collateral.',
    type_of_supporting: 'Invoice', type_of_payment: 'Full Payment',
    invoice_no: 'EVT/4471', invoice_date: dateOnly(11), invoice_received_date: dateOnly(10),
    basic_value: 264000, cgst: 23760, sgst: 23760, tds: 5280,
    paid_to: 'Whitefield Event Works', paid_by_chapter_id: 'c-del',
    beneficiary_name: 'Whitefield Event Works', pan_number: 'AAJCW6612F', gst_number: '07AAJCW6612F1ZQ',
    initiated_by: 'p-mem1', initiated_at: ago(9), submitted_at: ago(8),
    created_at: ago(9), updated_at: ago(8),
  }),
  voucher({
    id: 'v-09', status: 'pending_first', created_by: 'p-mem2',
    voucher_no: 'NVR/BLR/26-27/0012', date: dateOnly(2), chapter_id: 'c-blr', sponsored: 'Non-Sponsored',
    event_narration: 'Quarterly subscription — member CRM.',
    type_of_supporting: 'Invoice', type_of_payment: 'Full Payment',
    invoice_no: 'SFDC/IN/88214', invoice_date: dateOnly(3), invoice_received_date: dateOnly(2),
    basic_value: 148000, igst: 26640, tds: 14800,
    paid_to: 'Cloudline Software India Pvt Ltd', paid_by_chapter_id: 'c-blr',
    beneficiary_name: 'Cloudline Software India Pvt Ltd',
    pan_number: 'AACCC1182N', gst_number: '29AACCC1182N1ZG',
    initiated_by: 'p-mem2', initiated_at: ago(2), submitted_at: ago(2),
    created_at: ago(2), updated_at: ago(2),
  }),
  voucher({
    id: 'v-10', status: 'pending_second', created_by: 'p-mem1',
    voucher_no: 'NVR/MAA/26-27/0007', date: dateOnly(16), chapter_id: 'c-maa', sponsored: 'Sponsored',
    event_narration: 'Printing of annual report, 500 copies.',
    type_of_supporting: 'Invoice', type_of_payment: 'Full Payment',
    invoice_no: 'SPH/2026/774', invoice_date: dateOnly(18), invoice_received_date: dateOnly(17),
    basic_value: 87500, cgst: 7875, sgst: 7875, tds: 1750, tips: 0,
    paid_to: 'Southern Print House', paid_by_chapter_id: 'c-maa',
    beneficiary_name: 'Southern Print House', pan_number: 'AAHFS9021L', gst_number: '33AAHFS9021L1ZV',
    initiated_by: 'p-mem1', initiated_at: ago(16), submitted_at: ago(15),
    approver_1: 'p-appr1', approved_1_at: ago(12),
    created_at: ago(16), updated_at: ago(12),
  }),
  voucher({
    id: 'v-11', status: 'pending_first', created_by: 'p-appr1',
    voucher_no: 'NVR/HYD/26-27/0005', date: dateOnly(21), chapter_id: 'c-hyd', sponsored: 'Non-Sponsored',
    event_narration: 'Legal opinion on the sponsorship agreement.',
    type_of_supporting: 'Invoice', type_of_payment: 'Full Payment',
    invoice_no: 'LEX/0311', invoice_date: dateOnly(23), invoice_received_date: dateOnly(22),
    basic_value: 175000, cgst: 15750, sgst: 15750, tds: 17500,
    paid_to: 'Lex Anand Associates', paid_by_chapter_id: 'c-hyd',
    beneficiary_name: 'Lex Anand Associates', pan_number: 'AAFFL5540C', gst_number: '36AAFFL5540C1ZM',
    initiated_by: 'p-appr1', initiated_at: ago(21), submitted_at: ago(20),
    created_at: ago(21), updated_at: ago(20),
  }),
  voucher({
    id: 'v-12', status: 'approved', created_by: 'p-mem2',
    voucher_no: 'NVR/BOM/26-27/0008', date: dateOnly(26), chapter_id: 'c-bom', sponsored: 'Sponsored',
    event_id: 'e-2', event_name: 'CISO Round Table', event_date: dateOnly(18),
    event_narration: 'Delegate kits and lanyards.',
    type_of_supporting: 'Invoice', type_of_payment: 'Full Payment',
    invoice_no: 'MRC/7781', invoice_date: dateOnly(28), invoice_received_date: dateOnly(27),
    basic_value: 118000, cgst: 10620, sgst: 10620, tds: 2360,
    paid_to: 'Merchandise Craft Co', paid_by_chapter_id: 'c-bom',
    beneficiary_name: 'Merchandise Craft Co', pan_number: 'AAKFM3390D', gst_number: '27AAKFM3390D1ZY',
    initiated_by: 'p-mem2', initiated_at: ago(26), submitted_at: ago(25),
    approver_1: 'p-appr2', approved_1_at: ago(23), approver_2: 'p-appr1', approved_2_at: ago(22),
    created_at: ago(26), updated_at: ago(22),
  }),

  // ── In the recycle bin ──
  voucher({
    id: 'v-13', status: 'draft', created_by: 'p-mem1',
    date: dateOnly(70), chapter_id: 'c-pnq',
    paid_to: 'Duplicate entry — raised twice',
    basic_value: 42000,
    created_at: ago(70), updated_at: ago(66), deleted_at: ago(66),
  }),
  voucher({
    id: 'v-14', status: 'approved', created_by: 'p-mem2',
    voucher_no: 'NVR/GOA/26-27/0003', date: dateOnly(90), chapter_id: 'c-goa', sponsored: 'Sponsored',
    event_narration: 'Offsite venue advance — chapter later retired.',
    type_of_supporting: 'Proforma Invoice', type_of_payment: 'Advance',
    invoice_no: 'PF/GOA/019', invoice_date: dateOnly(92),
    basic_value: 210000, igst: 37800, tds: 21000,
    paid_to: 'Coastline Resorts Pvt Ltd', paid_by_chapter_id: 'c-goa',
    beneficiary_name: 'Coastline Resorts Pvt Ltd', pan_number: 'AADCC7781R', gst_number: '30AADCC7781R1ZT',
    initiated_by: 'p-mem2', initiated_at: ago(90), submitted_at: ago(89),
    approver_1: 'p-appr1', approved_1_at: ago(87), approver_2: 'p-admin', approved_2_at: ago(86),
    created_at: ago(90), updated_at: ago(80), deleted_at: ago(80),
  }),
];

// ─── Attachments and history ─────────────────────────────────────────────────

export const voucher_attachments = [
  { id: 'a-1', voucher_id: 'v-01', storage_path: 'v-01/taj-invoice.pdf', file_name: 'taj-invoice-1187.pdf', mime_type: 'application/pdf', size_bytes: 284_113, uploaded_by: PREVIEW_USER_ID, created_at: ago(33) },
  { id: 'a-2', voucher_id: 'v-03', storage_path: 'v-03/blue-ginger.pdf', file_name: 'blue-ginger-9921.pdf', mime_type: 'application/pdf', size_bytes: 152_880, uploaded_by: PREVIEW_USER_ID, created_at: ago(5) },
  { id: 'a-3', voucher_id: 'v-08', storage_path: 'v-08/whitefield.pdf', file_name: 'whitefield-4471.pdf', mime_type: 'application/pdf', size_bytes: 421_004, uploaded_by: 'p-mem1', created_at: ago(8) },
  { id: 'a-4', voucher_id: 'v-08', storage_path: 'v-08/stage-photo.jpg', file_name: 'stage-layout.jpg', mime_type: 'image/jpeg', size_bytes: 1_902_441, uploaded_by: 'p-mem1', created_at: ago(8) },
  { id: 'a-5', voucher_id: 'v-02', storage_path: 'v-02/audit-fee.pdf', file_name: 'audit-fee-0042.pdf', mime_type: 'application/pdf', size_bytes: 96_220, uploaded_by: PREVIEW_USER_ID, created_at: ago(11) },
  { id: 'a-6', voucher_id: 'v-10', storage_path: 'v-10/print-invoice.pdf', file_name: 'sph-774.pdf', mime_type: 'application/pdf', size_bytes: 178_339, uploaded_by: 'p-mem1', created_at: ago(15) },
];

let auditSeq = 0;
const entry = (
  voucher_id: string,
  actor_id: string | null,
  action: string,
  created_at: string,
  extra: { from_status?: string; to_status?: string; note?: string } = {},
) => ({
  id: ++auditSeq,
  voucher_id,
  actor_id,
  action,
  from_status: extra.from_status ?? null,
  to_status: extra.to_status ?? null,
  note: extra.note ?? null,
  changed: null,
  created_at,
});

export const voucher_audit = [
  entry('v-01', PREVIEW_USER_ID, 'created', ago(34), { to_status: 'draft' }),
  entry('v-01', PREVIEW_USER_ID, 'submitted', ago(33), { from_status: 'draft', to_status: 'pending_first' }),
  entry('v-01', 'p-appr1', 'approved_first', ago(31), { from_status: 'pending_first', to_status: 'pending_second' }),
  entry('v-01', 'p-admin', 'approved_second', ago(30), { from_status: 'pending_second', to_status: 'approved' }),
  entry('v-01', 'p-admin', 'marked_paid', ago(20), { from_status: 'approved', to_status: 'paid', note: 'UTR HDFC26071900418823' }),

  entry('v-02', PREVIEW_USER_ID, 'created', ago(12), { to_status: 'draft' }),
  entry('v-02', PREVIEW_USER_ID, 'submitted', ago(11), { from_status: 'draft', to_status: 'pending_first' }),
  entry('v-02', 'p-appr2', 'approved_first', ago(9), { from_status: 'pending_first', to_status: 'pending_second' }),
  entry('v-02', 'p-admin', 'approved_second', ago(8), { from_status: 'pending_second', to_status: 'approved' }),

  entry('v-03', PREVIEW_USER_ID, 'created', ago(6), { to_status: 'draft' }),
  entry('v-03', PREVIEW_USER_ID, 'submitted', ago(5), { from_status: 'draft', to_status: 'pending_first' }),
  entry('v-03', 'p-appr1', 'approved_first', ago(3), { from_status: 'pending_first', to_status: 'pending_second' }),

  entry('v-04', PREVIEW_USER_ID, 'created', ago(4), { to_status: 'draft' }),
  entry('v-04', PREVIEW_USER_ID, 'submitted', ago(4), { from_status: 'draft', to_status: 'pending_first' }),
  entry('v-04', 'p-admin', 'rejected', ago(2), {
    from_status: 'pending_first',
    to_status: 'rejected',
    note: 'Boarding passes are missing for the return leg. Please attach them and resubmit.',
  }),

  entry('v-05', PREVIEW_USER_ID, 'created', ago(1), { to_status: 'draft' }),
  entry('v-06', PREVIEW_USER_ID, 'created', ago(0, 2), { to_status: 'draft' }),

  entry('v-08', 'p-mem1', 'created', ago(9), { to_status: 'draft' }),
  entry('v-08', 'p-mem1', 'submitted', ago(8), { from_status: 'draft', to_status: 'pending_first' }),
  entry('v-09', 'p-mem2', 'created', ago(2), { to_status: 'draft' }),
  entry('v-09', 'p-mem2', 'submitted', ago(2), { from_status: 'draft', to_status: 'pending_first' }),
  entry('v-10', 'p-mem1', 'created', ago(16), { to_status: 'draft' }),
  entry('v-10', 'p-mem1', 'submitted', ago(15), { from_status: 'draft', to_status: 'pending_first' }),
  entry('v-10', 'p-appr1', 'approved_first', ago(12), { from_status: 'pending_first', to_status: 'pending_second' }),
  entry('v-11', 'p-appr1', 'created', ago(21), { to_status: 'draft' }),
  entry('v-11', 'p-appr1', 'submitted', ago(20), { from_status: 'draft', to_status: 'pending_first' }),
  entry('v-12', 'p-mem2', 'created', ago(26), { to_status: 'draft' }),
  entry('v-12', 'p-mem2', 'submitted', ago(25), { from_status: 'draft', to_status: 'pending_first' }),
  entry('v-12', 'p-appr2', 'approved_first', ago(23), { from_status: 'pending_first', to_status: 'pending_second' }),
  entry('v-12', 'p-appr1', 'approved_second', ago(22), { from_status: 'pending_second', to_status: 'approved' }),

  entry('v-13', 'p-mem1', 'created', ago(70), { to_status: 'draft' }),
  entry('v-13', 'p-admin', 'deleted', ago(66), { note: 'Raised twice by mistake.' }),
  entry('v-14', 'p-mem2', 'created', ago(90), { to_status: 'draft' }),
  entry('v-14', 'p-mem2', 'submitted', ago(89), { from_status: 'draft', to_status: 'pending_first' }),
  entry('v-14', 'p-appr1', 'approved_first', ago(87), { from_status: 'pending_first', to_status: 'pending_second' }),
  entry('v-14', 'p-admin', 'approved_second', ago(86), { from_status: 'pending_second', to_status: 'approved' }),
  entry('v-14', 'p-admin', 'deleted', ago(80), { note: 'Chapter retired; event cancelled.' }),
];

export const user_settings: unknown[] = [];
export const sheet_sync_log: unknown[] = [];
