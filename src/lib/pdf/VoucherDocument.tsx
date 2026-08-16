import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import { BRAND } from '@/lib/marketing/content';
import { PdfMark } from '@/lib/brand/PdfMark';
import { fmtAmount, fmtDate, toNum } from '@/lib/domain/voucher';
import type { VoucherStatus } from '@/lib/domain/workflow';

/**
 * The printed payment voucher.
 *
 * v1 rendered a hidden DOM node with html2canvas and embedded the screenshot as
 * a PNG. That meant the text was not selectable or searchable, the file was
 * large, quality depended on device pixel ratio, and the output differed between
 * machines. This is real vector text: ~30× smaller, searchable, and identical
 * everywhere.
 *
 * The layout deliberately matches the original — this is the artefact people
 * sign, and finance recognises its shape. Two v1 quirks are fixed: the duplicate
 * "Amount" column header, and Sponsored/Non-Sponsored printing twice.
 */

// Helvetica is one of the 14 PDF standard fonts, so it embeds nothing and needs
// no network fetch at render time — important in a serverless function.
Font.registerHyphenationCallback((word) => [word]);

const INK = '#3D52A0';
const ACCENT = '#7091E6';
const SOFT = '#8697C4';
const TEXT = '#1F2937';
const MUTED = '#6B7280';
const LABEL_BG = '#F7F6FB';
const BORDER = '#C7CEE8';

const s = StyleSheet.create({
  page: {
    paddingVertical: 24,
    paddingHorizontal: 28,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: TEXT,
  },
  frame: {
    border: `1.5pt solid ${INK}`,
    borderRadius: 6,
    padding: 16,
    height: '100%',
  },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lockup: { flexDirection: 'row', alignItems: 'center' },
  wordmark: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: INK, marginLeft: 7 },
  wordmarkSub: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: SOFT, marginTop: 3, letterSpacing: 0.5 },
  titleBlock: { alignItems: 'center' },
  firmName: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: INK },
  docTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 1 },
  metaBlock: { width: '30%' },
  metaRow: { flexDirection: 'row', marginBottom: 3 },
  metaLabel: { width: 54, fontFamily: 'Helvetica-Bold', fontSize: 8 },
  metaValue: { flex: 1, fontSize: 8, borderBottom: `0.5pt solid ${BORDER}` },

  sponsorLine: { marginTop: 8, fontSize: 9.5 },
  struck: { textDecoration: 'line-through', color: '#9CA3AF' },
  chosen: { fontFamily: 'Helvetica-Bold', color: INK },

  // Table
  table: { marginTop: 6, border: `0.5pt solid ${BORDER}` },
  thead: { flexDirection: 'row', backgroundColor: LABEL_BG },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 8, padding: 4, borderRight: `0.5pt solid ${BORDER}` },
  row: { flexDirection: 'row', borderTop: `0.5pt solid ${BORDER}`, minHeight: 15 },
  cLabel: { width: '22%', padding: 4, backgroundColor: LABEL_BG, fontFamily: 'Helvetica-Bold', fontSize: 8, borderRight: `0.5pt solid ${BORDER}` },
  cDetail: { flex: 1, padding: 4, fontSize: 8, borderRight: `0.5pt solid ${BORDER}` },
  cAmountLabel: { width: '26%', padding: 4, fontSize: 8, borderRight: `0.5pt solid ${BORDER}` },
  cAmount: { width: '18%', padding: 4, fontSize: 8, textAlign: 'right' },
  strong: { fontFamily: 'Helvetica-Bold' },
  totalRow: { backgroundColor: LABEL_BG },

  // Footer
  footer: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap' },
  fCell: { width: '33.33%', marginBottom: 8, paddingRight: 8 },
  fLabel: { fontSize: 7, color: MUTED, fontFamily: 'Helvetica-Bold' },
  fValue: { fontSize: 9, marginTop: 2, borderBottom: `0.5pt solid ${BORDER}`, paddingBottom: 2, minHeight: 12 },

  sigRow: { flexDirection: 'row', marginTop: 6 },
  sig: { flex: 1, marginRight: 10 },
  sigLabel: { fontSize: 7, color: MUTED, fontFamily: 'Helvetica-Bold' },
  sigName: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 8 },
  sigMeta: { fontSize: 6.5, color: MUTED, marginTop: 1 },
  sigLine: { borderTop: `0.5pt solid ${SOFT}`, marginTop: 3, paddingTop: 2 },

  stamp: {
    position: 'absolute',
    top: '42%',
    left: '18%',
    fontSize: 62,
    fontFamily: 'Helvetica-Bold',
    color: '#EF4444',
    opacity: 0.14,
    transform: 'rotate(-22deg)',
  },
  foot: { position: 'absolute', bottom: 12, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between' },
  footText: { fontSize: 6.5, color: MUTED },
});

export type PdfPerson = { full_name: string | null; email: string } | null;

export type PdfVoucher = {
  voucher_no: string | null;
  status: VoucherStatus;
  date: string | null;
  chapter_name: string | null;
  sponsored: string | null;

  event_name: string | null;
  event_date: string | null;
  event_narration: string | null;

  type_of_supporting: string | null;
  type_of_payment: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  invoice_received_date: string | null;

  basic_value: number; cgst: number; sgst: number; igst: number; vat: number;
  net_total: number; tds: number; advance: number; tips: number; discount: number;
  grand_total: number;

  paid_to: string | null;
  paid_by_chapter_name: string | null;
  payment_date: string | null;
  beneficiary_name: string | null;
  utr_ref: string | null;
  pan_number: string | null;
  gst_number: string | null;

  initiator: PdfPerson;
  first_approver: PdfPerson;
  second_approver: PdfPerson;
  approved_1_at: string | null;
  approved_2_at: string | null;
};

const name = (p: PdfPerson) => p?.full_name ?? p?.email ?? '';

/**
 * Every fixed label that reaches the page.
 *
 * These live as data rather than inline JSX so a test can assert that each one
 * is representable in WinAnsi. The standard PDF fonts silently drop anything
 * outside it: the deduction labels were originally written with U+2212 MINUS
 * SIGN and printed as "( ) TDS", losing the sign on a payment document. A
 * missing glyph raises no error, so it has to be guarded at the source.
 */
export const PDF_LABELS = {
  basic: 'Basic Value (A)',
  cgst: '(+) CGST',
  sgst: '(+) SGST',
  igst: '(+) IGST',
  vat: '(+) VAT / Other Charges (C)',
  net: 'Net Total (D)',
  tds: '(-) TDS (E)',
  advance: '(-) Advance (G)',
  tips: '(+) Tips (H)',
  discount: '(-) Discount (I)',
  payable: 'Amount to be paid',

  eventName: 'Event Name',
  eventDate: 'Event Date',
  narration: 'Event Narration',
  supporting: 'Type of Supporting',
  payment: 'Type of Payment',
  invoiceNo: 'Invoice No.',
  invoiceDate: 'Invoice Date',
  invoiceReceived: 'Invoice received Date',

  paidTo: 'Paid to',
  paidByChapter: 'Paid by Chapter',
  paymentDate: 'Payment Date',
  beneficiary: 'Beneficiary Name',
  utr: 'UTR No. / Ref No.',
  panGst: 'PAN No. / GST No.',

  initiatedBy: 'Initiated By',
  approval1: '1st Approval done by',
  approval2: '2nd Approval done by',
  awaiting: 'Awaiting approval',
  notRequired: 'Not required',
} as const;

/** Labels whose amount is subtracted from the net total. */
export const DEDUCTION_LABELS = [
  PDF_LABELS.tds,
  PDF_LABELS.advance,
  PDF_LABELS.discount,
] as const;

/** Detail row: label on the left, value spanning the rest. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.cLabel}>{label}</Text>
      <Text style={[s.cDetail, { borderRightWidth: 0 }]}>{value}</Text>
    </View>
  );
}

/** Amount row: blank label column, then the amount label and its figure. */
function AmountRow({
  label,
  value,
  strong,
  total,
}: {
  label: string;
  value: number;
  strong?: boolean;
  total?: boolean;
}) {
  return (
    <View style={[s.row, ...(total ? [s.totalRow] : [])]}>
      <Text style={s.cLabel}> </Text>
      <Text style={s.cDetail}> </Text>
      <Text style={[s.cAmountLabel, ...(strong ? [s.strong] : [])]}>{label}</Text>
      <Text style={[s.cAmount, ...(strong ? [s.strong] : [])]}>{fmtAmount(value)}</Text>
    </View>
  );
}

function Signature({
  label,
  person,
  meta,
}: {
  label: string;
  person: PdfPerson;
  meta: string;
}) {
  return (
    <View style={s.sig}>
      <Text style={s.sigLabel}>{label}</Text>
      <Text style={s.sigName}>{name(person) || '—'}</Text>
      <View style={s.sigLine}>
        <Text style={s.sigMeta}>{meta}</Text>
      </View>
    </View>
  );
}

export function VoucherDocument({ v }: { v: PdfVoucher }) {
  const isSponsored = v.sponsored === 'Sponsored';
  const isNonSponsored = v.sponsored === 'Non-Sponsored';

  // Only a fully approved or paid voucher is a valid document. Anything else is
  // stamped, so a draft printout can never be mistaken for an authorised one —
  // v1 produced an identical-looking PDF at every stage.
  const provisional = v.status !== 'approved' && v.status !== 'paid';

  // Nothing further is coming once a voucher is approved or paid — whichever
  // signature block is still blank at that point was never going to fill,
  // whether because this organization does not require approval at all
  // (0013) or because it only ever needed the one signature (0015).
  // "Awaiting approval" would be false on a document already stamped final —
  // there is nothing outstanding, so the block says so instead.
  const finalized = v.status === 'approved' || v.status === 'paid';
  const firstSkipped = finalized && !v.first_approver;
  const secondSkipped = finalized && !v.second_approver;

  return (
    <Document
      title={`Payment Voucher ${v.voucher_no ?? ''}`.trim()}
      author={BRAND.name}
      subject={`Payment voucher for ${v.paid_to ?? 'vendor'}`}
      creator="Voucher Desk"
    >
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.frame}>
          {/* ── Header ── */}
          <View style={s.header}>
            <View style={{ width: '24%' }}>
              <View style={s.lockup}>
                <PdfMark size={30} />
                <Text style={s.wordmark}>
                  F<Text style={{ color: ACCENT }}>I</Text>
                </Text>
              </View>
              <Text style={s.wordmarkSub}>{BRAND.name}</Text>
            </View>

            <View style={[s.titleBlock, { width: '40%' }]}>
              <Text style={s.firmName}>{BRAND.name}</Text>
              <Text style={s.docTitle}>Payment Voucher</Text>
            </View>

            <View style={s.metaBlock}>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Date :-</Text>
                <Text style={s.metaValue}>{fmtDate(v.date)}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Chapter :-</Text>
                <Text style={s.metaValue}>{v.chapter_name ?? ''}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Vch. No. :-</Text>
                <Text style={s.metaValue}>{v.voucher_no ?? ''}</Text>
              </View>
            </View>
          </View>

          {/*
            The applicable half is bold, the other struck through — as in v1.
            v1 then printed the raw value again immediately after; that
            duplication is dropped.
          */}
          <Text style={s.sponsorLine}>
            <Text style={isSponsored ? s.chosen : isNonSponsored ? s.struck : {}}>Sponsored</Text>
            <Text> / </Text>
            <Text style={isNonSponsored ? s.chosen : isSponsored ? s.struck : {}}>
              Non-Sponsored
            </Text>
            <Text> Event</Text>
          </Text>

          {/* ── Main table ── */}
          <View style={s.table}>
            <View style={s.thead}>
              <Text style={[s.th, { width: '22%' }]}>Particulars</Text>
              <Text style={[s.th, { flex: 1 }]}>Details</Text>
              <Text style={[s.th, { width: '26%' }]}>Description</Text>
              <Text style={[s.th, { width: '18%', textAlign: 'right', borderRightWidth: 0 }]}>
                Amount
              </Text>
            </View>

            <DetailRow label={PDF_LABELS.eventName} value={v.event_name ?? ''} />
            <DetailRow label={PDF_LABELS.eventDate} value={fmtDate(v.event_date)} />
            <DetailRow label={PDF_LABELS.narration} value={v.event_narration ?? ''} />
            <DetailRow label={PDF_LABELS.supporting} value={v.type_of_supporting ?? ''} />
            <DetailRow label={PDF_LABELS.payment} value={v.type_of_payment ?? ''} />
            <DetailRow label={PDF_LABELS.invoiceNo} value={v.invoice_no ?? ''} />
            <DetailRow label={PDF_LABELS.invoiceDate} value={fmtDate(v.invoice_date)} />
            <DetailRow label={PDF_LABELS.invoiceReceived} value={fmtDate(v.invoice_received_date)} />

            <AmountRow label={PDF_LABELS.basic} value={v.basic_value} />
            {/* Only the GST actually charged is printed, as in v1. */}
            {toNum(v.cgst) > 0 && <AmountRow label={PDF_LABELS.cgst} value={v.cgst} />}
            {toNum(v.sgst) > 0 && <AmountRow label={PDF_LABELS.sgst} value={v.sgst} />}
            {toNum(v.igst) > 0 && <AmountRow label={PDF_LABELS.igst} value={v.igst} />}
            {toNum(v.vat) > 0 && <AmountRow label={PDF_LABELS.vat} value={v.vat} />}
            <AmountRow label={PDF_LABELS.net} value={v.net_total} strong total />
            {toNum(v.tds) > 0 && <AmountRow label={PDF_LABELS.tds} value={v.tds} />}
            {toNum(v.advance) > 0 && <AmountRow label={PDF_LABELS.advance} value={v.advance} />}
            {toNum(v.tips) > 0 && <AmountRow label={PDF_LABELS.tips} value={v.tips} />}
            {toNum(v.discount) > 0 && <AmountRow label={PDF_LABELS.discount} value={v.discount} />}
            <AmountRow label={PDF_LABELS.payable} value={v.grand_total} strong total />
          </View>

          {/* ── Payment details ── */}
          <View style={s.footer}>
            <View style={s.fCell}>
              <Text style={s.fLabel}>{PDF_LABELS.paidTo}</Text>
              <Text style={s.fValue}>{v.paid_to ?? ''}</Text>
            </View>
            <View style={s.fCell}>
              <Text style={s.fLabel}>{PDF_LABELS.paidByChapter}</Text>
              <Text style={s.fValue}>{v.paid_by_chapter_name ?? ''}</Text>
            </View>
            <View style={s.fCell}>
              <Text style={s.fLabel}>{PDF_LABELS.paymentDate}</Text>
              <Text style={s.fValue}>{fmtDate(v.payment_date)}</Text>
            </View>
            <View style={s.fCell}>
              <Text style={s.fLabel}>{PDF_LABELS.beneficiary}</Text>
              <Text style={s.fValue}>{v.beneficiary_name ?? ''}</Text>
            </View>
            <View style={s.fCell}>
              <Text style={s.fLabel}>{PDF_LABELS.utr}</Text>
              <Text style={s.fValue}>{v.utr_ref ?? ''}</Text>
            </View>
            <View style={s.fCell}>
              <Text style={s.fLabel}>{PDF_LABELS.panGst}</Text>
              <Text style={s.fValue}>
                {[v.pan_number, v.gst_number].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
          </View>

          {/*
            Signatures come from the workflow, not from typed-in names. v1 had
            three free-text boxes filled by whoever created the voucher; these
            are the people who actually pressed Approve, with the date they did.
          */}
          <View style={s.sigRow}>
            <Signature label={PDF_LABELS.initiatedBy} person={v.initiator} meta=" " />
            <Signature
              label={PDF_LABELS.approval1}
              person={v.first_approver}
              meta={
                v.approved_1_at
                  ? `Approved ${fmtDate(v.approved_1_at)}`
                  : firstSkipped
                    ? PDF_LABELS.notRequired
                    : PDF_LABELS.awaiting
              }
            />
            <Signature
              label={PDF_LABELS.approval2}
              person={v.second_approver}
              meta={
                v.approved_2_at
                  ? `Approved ${fmtDate(v.approved_2_at)}`
                  : secondSkipped
                    ? PDF_LABELS.notRequired
                    : PDF_LABELS.awaiting
              }
            />
          </View>

          {provisional && <Text style={s.stamp}>{v.status.toUpperCase().replace(/_/g, ' ')}</Text>}
        </View>

        <View style={s.foot} fixed>
          <Text style={s.footText}>
            {v.voucher_no ?? 'Draft'} · Generated by Voucher Desk
          </Text>
          <Text
            style={s.footText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
