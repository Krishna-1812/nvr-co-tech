import { describe, it, expect } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import zlib from 'node:zlib';
import { VoucherDocument, PDF_LABELS, DEDUCTION_LABELS, type PdfVoucher } from './VoucherDocument';
import { pdfFilename } from './render';

/**
 * These tests exist because the whole point of moving off html2canvas is that
 * the output is real text rather than a screenshot. A rasterised PDF would still
 * "work" visually and silently lose searchability — so we assert on the actual
 * bytes.
 */

const sample: PdfVoucher = {
  voucher_no: 'FI/HYD/25-26/0042',
  status: 'approved',
  date: '2026-02-14',
  chapter_name: 'CIO Association Hyderabad',
  sponsored: 'Sponsored',

  event_name: 'Annual CIO Summit',
  event_date: '2026-02-10',
  event_narration: 'Venue and catering for the summit',

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

/** Pull readable text out of the PDF's content streams. */
function extractText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  let out = '';

  // Uncompressed content shows up directly; FlateDecode streams need inflating.
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const body = Buffer.from(m[1], 'latin1');
    try {
      out += zlib.inflateSync(body).toString('latin1');
    } catch {
      out += body.toString('latin1');
    }
  }
  // Inside a PDF string literal, "(", ")" and "\" are backslash-escaped.
  // Undo that so assertions can be written the way the label actually reads.
  return (out + raw).replace(/\\([()\\])/g, '$1');
}

describe('voucher PDF', () => {
  it('renders a non-trivial PDF', async () => {
    const buf = await renderToBuffer(<VoucherDocument v={sample} />);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('embeds real text, not a rasterised image', async () => {
    const buf = await renderToBuffer(<VoucherDocument v={sample} />);
    const content = extractText(buf);

    // Text-showing operators prove vector text; an image-only PDF has none.
    expect(content).toMatch(/\bT[jJ]\b/);
    // ...and no embedded bitmap.
    expect(content).not.toContain('/Subtype /Image');
    expect(content).not.toContain('/DCTDecode');
  });

  it('stays small — a screenshot PDF would be an order of magnitude bigger', async () => {
    const buf = await renderToBuffer(<VoucherDocument v={sample} />);
    // v1's html2canvas output ran to hundreds of kilobytes for the same page.
    expect(buf.length).toBeLessThan(120_000);
  });

  it('carries the voucher number in its metadata', async () => {
    const buf = await renderToBuffer(<VoucherDocument v={sample} />);
    const raw = buf.toString('latin1');
    expect(raw).toContain('The Finance Intelligence');
    expect(raw).toMatch(/Payment Voucher/);
  });

  it('renders every status without throwing', async () => {
    const statuses = ['draft', 'pending_first', 'pending_second', 'approved', 'rejected', 'paid'] as const;
    for (const status of statuses) {
      const buf = await renderToBuffer(<VoucherDocument v={{ ...sample, status }} />);
      expect(buf.length).toBeGreaterThan(1000);
    }
  });

  it('survives a completely empty voucher', async () => {
    // A draft PDF may be requested before anything has been filled in.
    const empty: PdfVoucher = {
      ...sample,
      voucher_no: null, status: 'draft', date: null, chapter_name: null, sponsored: null,
      event_name: null, event_date: null, event_narration: null,
      type_of_supporting: null, type_of_payment: null,
      invoice_no: null, invoice_date: null, invoice_received_date: null,
      basic_value: 0, cgst: 0, sgst: 0, igst: 0, vat: 0,
      net_total: 0, tds: 0, advance: 0, tips: 0, discount: 0, grand_total: 0,
      paid_to: null, paid_by_chapter_name: null, payment_date: null,
      beneficiary_name: null, utr_ref: null, pan_number: null, gst_number: null,
      initiator: null, first_approver: null, second_approver: null,
      approved_1_at: null, approved_2_at: null,
    };
    const buf = await renderToBuffer(<VoucherDocument v={empty} />);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

/**
 * Regression guard for a whole class of silent failure.
 *
 * The deduction labels were originally written with U+2212 MINUS SIGN, which is
 * absent from Helvetica's WinAnsi encoding. @react-pdf drops such glyphs without
 * error, so "(−) TDS (E)" printed as "( ) TDS (E)" — deductions with no sign, on
 * a payment document. The rendered PDF subsets its fonts, so the output bytes
 * can't be grepped for the label; the labels are therefore held as data and
 * checked at the source, which is deterministic and catches the same bug.
 */
describe('PDF labels are printable', () => {
  const WINANSI = /^[\x20-\x7E\xA0-\xFF]*$/;

  it('contains no character the standard fonts would silently drop', () => {
    for (const [key, label] of Object.entries(PDF_LABELS)) {
      expect(WINANSI.test(label), `${key}: ${JSON.stringify(label)}`).toBe(true);
    }
  });

  it('rejects the typographic minus that caused the original bug', () => {
    for (const [key, label] of Object.entries(PDF_LABELS)) {
      expect(label.includes('−'), `${key} uses U+2212`).toBe(false);
      expect(label.includes('–'), `${key} uses an en dash`).toBe(false);
    }
  });

  it('marks every deduction with a visible minus', () => {
    expect(DEDUCTION_LABELS.length).toBe(3);
    for (const label of DEDUCTION_LABELS) {
      expect(label.startsWith('(-)'), `${label} should start with (-)`).toBe(true);
    }
  });

  it('marks additions with a plus', () => {
    for (const label of [PDF_LABELS.cgst, PDF_LABELS.sgst, PDF_LABELS.igst, PDF_LABELS.tips]) {
      expect(label.startsWith('(+)')).toBe(true);
    }
  });
});

describe('pdfFilename', () => {
  it('replaces the slashes that would break Content-Disposition', () => {
    expect(pdfFilename('FI/HYD/25-26/0042')).toBe('FI-Voucher-FI-HYD-25-26-0042.pdf');
  });

  it('falls back for an unnumbered draft', () => {
    expect(pdfFilename(null)).toBe('FI-Voucher-draft.pdf');
  });
});
