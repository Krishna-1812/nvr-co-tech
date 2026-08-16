import { z } from 'zod';
import {
  SUPPORTING_TYPES,
  PAYMENT_TYPES,
  SPONSORSHIPS,
  PAN_RE,
  isValidGstin,
  gstinMatchesPan,
  calcGrandTotal,
  voucherDateIssue,
  dateFloorIssue,
} from './voucher';
import { istToday } from '@/lib/fiscal';

/**
 * Two schemas, deliberately.
 *
 * `draftSchema` is permissive: a draft is a scratchpad, and autosave must never
 * reject a half-typed field. v1 had no drafts at all — 32 fields on one page
 * with no persistence, so a refresh lost everything.
 *
 * `submitSchema` is the real gate, applied when the voucher enters the approval
 * workflow. The same rules exist as CHECK constraints and in submit_voucher(),
 * so this is for fast, friendly feedback — never the only line of defence.
 */

const money = z
  .union([z.string(), z.number()])
  .transform((v) => (v === '' || v === null ? 0 : Number(v)))
  .refine((n) => !Number.isNaN(n), 'Enter a number')
  .refine((n) => n >= 0, 'Cannot be negative')
  .refine((n) => n < 1e12, 'That amount looks wrong');

/** An empty date input yields '', which must become NULL rather than an invalid date. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
  .or(z.literal(''))
  .transform((v) => v || null)
  .nullable();

const text = (max = 200) =>
  z
    .string()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => v.trim() || null)
    .nullable();

export const draftSchema = z.object({
  voucher_no: text(60).optional(),
  date: isoDate.optional(),
  chapter_id: z.uuid().nullable().optional(),
  sponsored: z.enum(SPONSORSHIPS).nullable().optional(),

  event_id: z.uuid().nullable().optional(),
  event_name: text(200).optional(),
  event_date: isoDate.optional(),
  event_narration: text(500).optional(),

  type_of_supporting: z.enum(SUPPORTING_TYPES).nullable().optional(),
  type_of_payment: z.enum(PAYMENT_TYPES).nullable().optional(),
  invoice_no: text(60).optional(),
  invoice_date: isoDate.optional(),
  invoice_received_date: isoDate.optional(),

  basic_value: money.optional(),
  cgst: money.optional(),
  sgst: money.optional(),
  igst: money.optional(),
  vat: money.optional(),
  tds: money.optional(),
  advance: money.optional(),
  tips: money.optional(),
  discount: money.optional(),

  paid_to: text(200).optional(),
  paid_by_chapter_id: z.uuid().nullable().optional(),
  payment_date: isoDate.optional(),
  beneficiary_name: text(200).optional(),
  utr_ref: text(64).optional(),
  pan_number: text(10).optional(),
  gst_number: text(15).optional(),
});

export type DraftInput = z.input<typeof draftSchema>;
export type DraftValues = z.output<typeof draftSchema>;

/**
 * Cross-field rules. Applied to both schemas, because a rule like "CGST and SGST
 * travel together" is cheap to check and useful to surface early — it just isn't
 * allowed to block autosave, which is why it lives in a separate refine step the
 * draft path skips.
 */
export const crossFieldIssues = (v: {
  cgst?: unknown;
  sgst?: unknown;
  igst?: unknown;
  pan_number?: string | null;
  gst_number?: string | null;
  event_date?: string | null;
  invoice_date?: string | null;
  invoice_received_date?: string | null;
  payment_date?: string | null;
}): { path: string; message: string }[] => {
  const issues: { path: string; message: string }[] = [];
  const n = (x: unknown) => Number(x ?? 0) || 0;

  // Every date on the form is floored at FY 26-27, not just the voucher date.
  for (const path of ['event_date', 'invoice_date', 'invoice_received_date', 'payment_date'] as const) {
    const val = v[path];
    if (val) {
      const issue = dateFloorIssue(val);
      if (issue) issues.push({ path, message: issue });
    }
  }

  const intra = n(v.cgst) > 0 || n(v.sgst) > 0;
  const inter = n(v.igst) > 0;

  if (intra && inter) {
    issues.push({
      path: 'igst',
      message: 'Use CGST + SGST (same state) or IGST (other state) — not both.',
    });
  }
  if (intra && (n(v.cgst) === 0 || n(v.sgst) === 0)) {
    issues.push({
      path: n(v.cgst) === 0 ? 'cgst' : 'sgst',
      message: 'Enter both CGST and SGST together (or use IGST instead).',
    });
  }

  if (v.pan_number && !PAN_RE.test(v.pan_number)) {
    issues.push({ path: 'pan_number', message: 'PAN should look like ABCDE1234F.' });
  }
  if (v.gst_number && !isValidGstin(v.gst_number)) {
    issues.push({ path: 'gst_number', message: 'That GSTIN fails its checksum — check for a typo.' });
  }
  if (v.gst_number && v.pan_number && !gstinMatchesPan(v.gst_number, v.pan_number)) {
    issues.push({
      path: 'gst_number',
      message: 'This GSTIN does not contain the PAN entered above.',
    });
  }

  if (v.invoice_date && v.payment_date && v.payment_date < v.invoice_date) {
    issues.push({ path: 'payment_date', message: 'Payment cannot pre-date the invoice.' });
  }

  return issues;
};

/**
 * What submit_voucher() requires. Mirrored here so the UI can point at the
 * offending field instead of surfacing a bare database exception.
 */
export const submitReadiness = (
  v: {
    chapter_id?: string | null;
    paid_to?: string | null;
    type_of_supporting?: string | null;
    type_of_payment?: string | null;
    voucher_no?: string | null;
    date?: string | null;
    basic_value?: unknown;
    cgst?: unknown;
    sgst?: unknown;
    igst?: unknown;
    vat?: unknown;
    tds?: unknown;
    advance?: unknown;
    tips?: unknown;
    discount?: unknown;
  },
  today: string = istToday(),
): { path: string; message: string }[] => {
  const issues: { path: string; message: string }[] = [];

  if (!v.chapter_id) issues.push({ path: 'chapter_id', message: 'Choose the chapter.' });
  if (!v.paid_to?.trim()) issues.push({ path: 'paid_to', message: 'Who is being paid?' });
  if (!v.type_of_supporting) {
    issues.push({ path: 'type_of_supporting', message: 'Choose the supporting document.' });
  }
  if (!v.type_of_payment) {
    issues.push({ path: 'type_of_payment', message: 'Choose the payment type.' });
  }
  if (!v.voucher_no?.trim()) {
    issues.push({ path: 'voucher_no', message: 'Enter the voucher number.' });
  }
  if (calcGrandTotal(v) <= 0) {
    issues.push({ path: 'basic_value', message: 'The grand total must be more than zero.' });
  }
  if (v.date) {
    const dateIssue = voucherDateIssue(v.date, today) ?? dateFloorIssue(v.date);
    if (dateIssue) issues.push({ path: 'date', message: dateIssue });
  }

  return [...issues, ...crossFieldIssues(v)];
};
