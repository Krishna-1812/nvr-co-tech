import { renderToBuffer } from '@react-pdf/renderer';
import { VoucherDocument, type PdfVoucher } from './VoucherDocument';
import type { VoucherDetailRow } from '@/lib/domain/rows';
import { toNum } from '@/lib/domain/voucher';

/**
 * Map a database row onto the flat shape the PDF template consumes.
 *
 * Numeric columns arrive from PostgREST as strings (Postgres `numeric` is not
 * safe to serialise as a float), so every amount is coerced once, here, rather
 * than being trusted downstream.
 */
export function toPdfVoucher(v: VoucherDetailRow): PdfVoucher {
  return {
    voucher_no: v.voucher_no,
    status: v.status,
    date: v.date,
    chapter_name: v.chapter?.name ?? null,
    sponsored: v.sponsored,

    event_name: v.event_name,
    event_date: v.event_date,
    event_narration: v.event_narration,

    type_of_supporting: v.type_of_supporting,
    type_of_payment: v.type_of_payment,
    invoice_no: v.invoice_no,
    invoice_date: v.invoice_date,
    invoice_received_date: v.invoice_received_date,

    basic_value: toNum(v.basic_value),
    cgst: toNum(v.cgst),
    sgst: toNum(v.sgst),
    igst: toNum(v.igst),
    vat: toNum(v.vat),
    net_total: toNum(v.net_total),
    tds: toNum(v.tds),
    advance: toNum(v.advance),
    tips: toNum(v.tips),
    discount: toNum(v.discount),
    grand_total: toNum(v.grand_total),

    paid_to: v.paid_to,
    paid_by_chapter_name: v.paid_by?.name ?? null,
    payment_date: v.payment_date,
    beneficiary_name: v.beneficiary_name,
    utr_ref: v.utr_ref,
    pan_number: v.pan_number,
    gst_number: v.gst_number,

    initiator: v.initiator,
    first_approver: v.first_approver,
    second_approver: v.second_approver,
    approved_1_at: v.approved_1_at,
    approved_2_at: v.approved_2_at,
  };
}

/** Render the voucher to a PDF buffer. Server-only. */
export async function renderVoucherPdf(v: VoucherDetailRow): Promise<Buffer> {
  return renderToBuffer(<VoucherDocument v={toPdfVoucher(v)} />);
}

/**
 * A filename that sorts and reads well: NVR-Voucher-NVR-HYD-25-26-0001.pdf.
 * Slashes in the voucher number would break the Content-Disposition header.
 */
export function pdfFilename(voucherNo: string | null): string {
  const safe = (voucherNo ?? 'draft').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  return `NVR-Voucher-${safe}.pdf`;
}
