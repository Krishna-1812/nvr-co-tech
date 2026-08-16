/**
 * The voucher domain: business rules ported verbatim from the v1 app.
 *
 * These encode a real accounting process run for the CIO Association. Do not
 * "improve" the formulas or relabel the fields without checking with the client
 * — the labels mirror a physical form, and the PDF is the artefact people sign.
 *
 * Source of truth for the original behaviour:
 *   the v1 app's src/lib/{constants,helpers,excel}.js
 */

// ─── Chapters ────────────────────────────────────────────────────────────────

export type Chapter = {
  id: string;
  name: string;
  code: string;
  is_head_office: boolean;
  is_active: boolean;
};

/**
 * "Paid By Chapter" may only ever be head office or the chapter the voucher is
 * for. Carried over from v1 (VoucherForm.jsx: `paidByOptions`).
 */
export function paidByChapterOptions(chapters: Chapter[], chapterId: string | null): Chapter[] {
  const ho = chapters.find((c) => c.is_head_office);
  const own = chapters.find((c) => c.id === chapterId);
  const out: Chapter[] = [];
  if (ho) out.push(ho);
  if (own && own.id !== ho?.id) out.push(own);
  return out;
}

// ─── Vocabularies ────────────────────────────────────────────────────────────

export const SPONSORSHIPS = ['Sponsored', 'Non-Sponsored'] as const;
export type Sponsorship = (typeof SPONSORSHIPS)[number];

export const SUPPORTING_TYPES = [
  'Invoice',
  'Proforma Invoice',
  'Reimbursement',
  'Contract',
] as const;
export type SupportingType = (typeof SUPPORTING_TYPES)[number];

export const PAYMENT_ADVANCE = 'Advance';
export const PAYMENT_FULL = 'Full Payment';
export const PAYMENT_TYPES = [PAYMENT_ADVANCE, PAYMENT_FULL] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

/**
 * Type of Supporting drives Type of Payment.
 *   options → what the user may choose from
 *   auto    → preselected automatically (null = the user must pick)
 */
export const PAYMENT_RULES: Record<
  SupportingType,
  { options: readonly PaymentType[]; auto: PaymentType | null }
> = {
  'Invoice': { options: [PAYMENT_ADVANCE, PAYMENT_FULL], auto: null },
  'Proforma Invoice': { options: [PAYMENT_ADVANCE], auto: PAYMENT_ADVANCE },
  'Reimbursement': { options: [PAYMENT_FULL], auto: PAYMENT_FULL },
  'Contract': { options: [PAYMENT_ADVANCE], auto: PAYMENT_ADVANCE },
};

// ─── Money ───────────────────────────────────────────────────────────────────

/** Parse anything to a number, treating blanks and junk as 0 — as v1's `toNum` did. */
export const toNum = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? ''));
  return Number.isNaN(n) ? 0 : n;
};

export type AmountFields = {
  basic_value?: unknown;
  cgst?: unknown;
  sgst?: unknown;
  igst?: unknown;
  vat?: unknown;
  tds?: unknown;
  advance?: unknown;
  tips?: unknown;
  discount?: unknown;
};

/** B = CGST + SGST + IGST */
export const calcTax = (v: AmountFields): number => toNum(v.cgst) + toNum(v.sgst) + toNum(v.igst);

/** D = Basic Value (A) + Total Tax (B) + VAT / Other Charges (C) */
export const calcNetTotal = (v: AmountFields): number =>
  toNum(v.basic_value) + calcTax(v) + toNum(v.vat);

/**
 * Grand Total = Net Total (D) − TDS (E) − Advance (G) + Tips (H) − Discount (I)
 *
 * NOTE the signs: Tips ADD and Advance SUBTRACTS (the advance was already paid
 * out, so it is netted off what remains payable). This is deliberate and matches
 * both v1 and the printed form. The database recomputes this as a generated
 * column, so the two can never drift.
 */
export const calcGrandTotal = (v: AmountFields): number =>
  calcNetTotal(v) - toNum(v.tds) - toNum(v.advance) + toNum(v.tips) - toNum(v.discount);

/** Indian grouping, always 2 decimals: 123456.5 → "1,23,456.50" */
export const fmtAmount = (v: unknown): string =>
  toNum(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** With the rupee sign, for UI display. */
export const fmtRupees = (v: unknown): string => `₹${fmtAmount(v)}`;

// ─── Dates ───────────────────────────────────────────────────────────────────

/** ISO yyyy-mm-dd → dd/mm/yyyy. Returns the input unchanged if unparseable. */
export const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('T')[0].split('-');
  return !y || !m || !d ? iso : `${d}/${m}/${y}`;
};

/** Indian financial year for a date: 1 April – 31 March, rendered "25-26". */
export function financialYear(d: Date): string {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // month is 0-indexed; 3 = April
  return `${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;
}

// ─── GST mode ────────────────────────────────────────────────────────────────

/**
 * GST is either intra-state (CGST + SGST) or inter-state (IGST) — never both.
 * v1 enforced this by *disabling* the opposite inputs, which is good UX and is
 * kept here; the database also has a CHECK constraint so it holds regardless.
 */
export function gstMode(v: { cgst?: unknown; sgst?: unknown; igst?: unknown }) {
  const filled = (x: unknown) => x !== '' && x !== null && x !== undefined && toNum(x) !== 0;
  return {
    usingCgstSgst: filled(v.cgst) || filled(v.sgst),
    usingIgst: filled(v.igst),
  };
}

// ─── Input sanitisers (applied live, on keystroke — as v1 did) ───────────────

/** Approval-name fields: letters, whitespace, dots. */
export const lettersOnly = (v: string): string => v.replace(/[^A-Za-z\s.]/g, '');

/** Beneficiary Name, UTR/Ref, PAN, GST: alphanumerics, whitespace, hyphen, slash. */
export const alphaNumeric = (v: string): string => v.replace(/[^A-Za-z0-9\s\-/]/g, '');

// ─── Format validation (new in v2 — v1 showed hints but checked nothing) ─────

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

export const isValidPan = (v: string): boolean => PAN_RE.test(v);

/**
 * GSTIN structure plus its checksum digit. The first 15th character is a
 * mod-36 check over the preceding 14, which catches transposed digits that a
 * regex alone would wave through.
 */
export function isValidGstin(v: string): boolean {
  if (!GSTIN_RE.test(v)) return false;
  const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const code = CHARS.indexOf(v[i]);
    if (code < 0) return false;
    const product = code * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const check = (36 - (sum % 36)) % 36;
  return CHARS[check] === v[14];
}

/** The PAN embedded in a GSTIN (chars 3–12) must match a separately given PAN. */
export function gstinMatchesPan(gstin: string, pan: string): boolean {
  if (!GSTIN_RE.test(gstin) || !PAN_RE.test(pan)) return true; // nothing to contradict
  return gstin.slice(2, 12) === pan;
}
