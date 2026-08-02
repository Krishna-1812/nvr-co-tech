/**
 * Business rules, constants and formulas — verified against the real source at
 * github.com/vivekgaggarnvr-crypto/NVR-Voucher (src/lib/constants.js, helpers.js,
 * excel.js, sheets.js). Typed up for reuse in the rebuild.
 *
 * These encode a real accounting process. Do not "improve" the formulas or the
 * label wording without checking with the client first — the labels mirror a
 * physical form and the PDF is the artefact people sign.
 */

// ─── Chapters ────────────────────────────────────────────────────────────────
/** Head office — always allowed as the paying chapter. */
export const HEAD_OFFICE = 'CIO Association HO';

/** Built-in defaults, always shown. Users may add their own on top (per-user). */
export const CHAPTERS = [
  'CIO Association HO',
  'CIO Association Ahmedabad',
  'CIO Association Bangalore',
  'CIO Association Chennai',
  'CIO Association Coimbatore',
  'CIO Association Delhi',
  'CIO Association Hyderabad',
  'CIO Association Kerala',
  'CIO Association Kolkata',
  'CIO Association Mumbai',
  'CIO Association Nagpur',
  'CIO Association Pune',
  'CIO Association Punjab',
  'CIO Association Rajasthan',
  'CIO Association Goa',
] as const;

// ─── Vocabularies ────────────────────────────────────────────────────────────
export const SPONSOR_OPTIONS = ['Sponsored', 'Non-Sponsored'] as const;

export const SUPPORTING_TYPES = [
  'Invoice',
  'Proforma Invoice',
  'Reimbursement',
  'Contract',
] as const;

export const PAYMENT_ADVANCE = 'Advance';
export const PAYMENT_FULL = 'Full Payment';

/**
 * Type of Supporting drives Type of Payment.
 *   options → what the user may choose from
 *   auto    → preselected automatically (null = user must pick)
 * When `auto` is set the original UI shows a locked pill: "Advance · auto-selected".
 */
export const PAYMENT_RULES: Record<string, { options: string[]; auto: string | null }> = {
  'Invoice':          { options: [PAYMENT_ADVANCE, PAYMENT_FULL], auto: null },
  'Proforma Invoice': { options: [PAYMENT_ADVANCE],               auto: PAYMENT_ADVANCE },
  'Reimbursement':    { options: [PAYMENT_FULL],                  auto: PAYMENT_FULL },
  'Contract':         { options: [PAYMENT_ADVANCE],               auto: PAYMENT_ADVANCE },
};

/** Paid By Chapter may only ever be HO or the chapter the voucher is for. */
export const paidByChapterOptions = (chapter: string) =>
  [HEAD_OFFICE, chapter].filter((c, i, arr) => c && arr.indexOf(c) === i);

// ─── Calculations — must match exactly ───────────────────────────────────────
const toNum = (v: unknown) => {
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? 0 : n;
};

/** B = CGST + SGST + IGST */
export const calcTax = (v: { cgst?: unknown; sgst?: unknown; igst?: unknown }) =>
  toNum(v.cgst) + toNum(v.sgst) + toNum(v.igst);

/** D = Basic Value (A) + Total Tax (B) + VAT/Other (C) */
export const calcNetTotal = (v: {
  basic_value?: unknown; cgst?: unknown; sgst?: unknown; igst?: unknown; vat?: unknown;
}) => toNum(v.basic_value) + calcTax(v) + toNum(v.vat);

/**
 * Grand Total = D − TDS(E) − Advance(G) + Tips(H) − Discount(I)
 * NOTE the signs: Tips ADD, Advance SUBTRACTS (it was already paid out).
 */
export const calcGrandTotal = (v: {
  basic_value?: unknown; cgst?: unknown; sgst?: unknown; igst?: unknown; vat?: unknown;
  tds?: unknown; advance?: unknown; tips?: unknown; discount?: unknown;
}) =>
  calcNetTotal(v) - toNum(v.tds) - toNum(v.advance) + toNum(v.tips) - toNum(v.discount);

// ─── Formatting ──────────────────────────────────────────────────────────────
/** Indian grouping, always 2 decimals: 123456.5 → "1,23,456.50" */
export const fmtAmount = (v: unknown) =>
  toNum(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ISO yyyy-mm-dd → dd/mm/yyyy (returns input unchanged if unparseable). */
export const fmtDate = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return !y || !m || !d ? iso : `${d}/${m}/${y}`;
};

// ─── Live input sanitisers (applied on every keystroke) ──────────────────────
/** Approval-name fields: letters, whitespace, dots. */
export const lettersOnly = (v: string) => v.replace(/[^A-Za-z\s.]/g, '');
/** Beneficiary Name, UTR/Ref, PAN, GST: alphanumerics, whitespace, hyphen, slash. */
export const alphaNumeric = (v: string) => v.replace(/[^A-Za-z0-9\s\-/]/g, '');
// PAN and GST additionally get .toUpperCase()

/** Google Sheets URL → sheet id. */
export const extractSheetId = (url: string) =>
  String(url || '').match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;

// ─── GST exclusivity ─────────────────────────────────────────────────────────
/** Intra-state (CGST+SGST) xor inter-state (IGST) — enforced by DISABLING inputs. */
export const gstMode = (f: { cgst?: string; sgst?: string; igst?: string }) => ({
  usingCgstSgst: f.cgst !== '' || f.sgst !== '',
  usingIgst: f.igst !== '',
});

// ─── Messages from the original ──────────────────────────────────────────────
export const MESSAGES = {
  voucherNoRequired: 'Please enter a Voucher No.',
  gstPairing: 'Enter both CGST and SGST together (or use IGST instead).',
  gstHelp: 'Use either CGST + SGST (same state) or IGST (other state) — not both. Clear one side to switch.',
  saved: 'Voucher created, saved & downloaded as PDF.',
  generic: 'Something went wrong.',
  badSheetLink: "That doesn't look like a Google Sheets link. Paste the full URL.",
  sheetNotShared: 'Couldn’t access this sheet. Make sure you shared it with the service account email (as Editor).',
  sheetNotFound: 'No sheet found for that link. Double-check the URL.',
  softDeleteNote: 'Deleting a voucher moves it to Deleted Vouchers below — nothing is lost until you permanently delete it there.',
  purgeNote: 'This removes the voucher from the database and from your connected Google Sheet. This cannot be undone.',
};

// ─── Export columns (Excel + Google Sheet), exact order ──────────────────────
/** 32 columns. The Google Sheet prepends a 33rd at column A: "Voucher ID" (= vouchers.id). */
export const EXPORT_COLUMNS: Array<[label: string, key: string, fmt?: 'date' | 'array']> = [
  ['Date',                       'date', 'date'],
  ['Chapter',                    'chapter'],
  ['Voucher No.',                'voucher_no'],
  ['Sponsored / Non-Sponsored',  'sponsored'],
  ['Event Name',                 'event_name'],
  ['Event Narration',            'event_narration'],
  ['Type of Supporting',         'type_of_supporting'],
  ['Type of Payment',            'type_of_payment', 'array'], // text[] → join(', ')
  ['Invoice No.',                'invoice_no'],
  ['Invoice Date',               'invoice_date', 'date'],
  ['Invoice Received Date',      'invoice_received_date', 'date'],
  ['Basic Value',                'basic_value'],
  ['CGST',                       'cgst'],
  ['SGST',                       'sgst'],
  ['IGST',                       'igst'],
  ['VAT / Other Charges',        'vat'],
  ['Net Total',                  'net_total'],
  ['TDS',                        'tds'],
  ['Advance',                    'advance'],
  ['Tips',                       'tips'],
  ['Discount',                   'discount'],
  ['Grand Total',                'grand_total'],
  ['Paid To',                    'paid_to'],
  ['Paid By Chapter',            'paid_by_chapter'],
  ['Payment Date',               'payment_date', 'date'],
  ['Beneficiary Name',           'beneficiary_name'],
  ['UTR / Ref No.',              'utr_ref'],
  ['PAN Number',                 'pan_number'],
  ['GST Number',                 'gst_number'],
  ['Initiated By',               'initiated_by'],
  ['1st Approval Done By',       'approval_1'],
  ['2nd Approval Done By',       'approval_2'],
];

// NOTE: `event_id` and `event_date` exist in form state and in the database but are
// MISSING from the original's insert payload — a real bug. Persist both in the rebuild,
// otherwise the event link is lost and re-downloaded PDFs show a blank Event Date.

// ─── Roles ───────────────────────────────────────────────────────────────────
/** profiles.is_owner / profiles.is_admin. Owner > Admin > User. */
export const roleLabel = (u: { is_owner?: boolean; is_admin?: boolean }) =>
  u.is_owner ? 'Owner' : u.is_admin ? 'Admin' : 'User';

/** Only an owner may promote/demote — never another owner, never themselves. */
export const canToggleAdmin = (
  actor: { is_owner?: boolean },
  target: { id: string; is_owner?: boolean },
  actorId: string,
) => !!actor.is_owner && !target.is_owner && target.id !== actorId;

// ─── Legacy brand palette (reference — the rebuild should improve on it) ─────
export const LEGACY_BRAND = {
  ink:         '#3D52A0', // borders, headings, the "V" container
  accentMid:   '#7091E6', // the V in the NVR wordmark
  accentSoft:  '#8697C4',
  accentPale:  '#ADBBDA',
  bodyText:    '#1F2937',
  labelCellBg: '#F7F6FB',
};

// ─── Empty form state (32 fields) ────────────────────────────────────────────
export const EMPTY_VOUCHER = {
  date: '', chapter: '', voucher_no: '', sponsored: '',
  event_id: '', event_name: '', event_date: '', event_narration: '',
  type_of_supporting: '', type_of_payment: '',
  invoice_no: '', invoice_date: '', invoice_received_date: '',
  basic_value: '', cgst: '', sgst: '', igst: '', vat: '',
  tds: '', advance: '', tips: '', discount: '',
  paid_to: '', paid_by_chapter: '', payment_date: '',
  beneficiary_name: '', utr_ref: '', pan_number: '', gst_number: '',
  initiated_by: '', approval_1: '', approval_2: '',
};
