import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { BRAND } from '@/lib/marketing/content';
import { PdfMark } from '@/lib/brand/PdfMark';
import { formatINR } from '@/lib/recon/amount';
import { COMPOUNDING_LABEL, SOURCE_LABEL, landedCost, rentalYield, type Schedule } from './calc';
import { displayDate } from './workbook';

/**
 * A True Property Cost schedule, printed.
 *
 * The thing that goes in a file or to a client: the answer, how it splits, the
 * yield if a rent was entered, the method and its limits stated in full, and
 * every payment with the days and rate behind its figure. Vector text, so it
 * can be searched and copied.
 *
 * Helvetica, one of the standard PDF fonts, so nothing is embedded or fetched.
 * It has no rupee sign — one renders as a blank box — so figures are printed
 * without it and the currency is stated once at the top, as the reconciliation
 * statement does.
 */

const INK = '#2B211B';
const DIM = '#4A3D33';
const SUBTLE = '#67574A';
const LINE = '#E2D3BF';
const BAND = '#F6EFE4';
const ACCENT = '#9C4026';
const OWN = '#268769';
const BORROW = '#CF9A35';

const s = StyleSheet.create({
  page: { paddingVertical: 34, paddingHorizontal: 38, fontSize: 9, fontFamily: 'Helvetica', color: INK },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  brandSub: { fontSize: 7, color: SUBTLE, marginTop: 2 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 18 },
  meta: { fontSize: 9, color: DIM, marginTop: 4 },
  note: { fontSize: 7.5, color: SUBTLE, marginTop: 2 },
  hero: { marginTop: 18, padding: 14, backgroundColor: BAND, borderRadius: 6 },
  heroLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: SUBTLE, letterSpacing: 0.8 },
  heroFigure: { fontSize: 24, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  heroLine: { fontSize: 9, color: DIM, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  cell: { width: '31.8%', borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 8 },
  cellLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: SUBTLE, letterSpacing: 0.6 },
  cellValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  cellNote: { fontSize: 7, color: SUBTLE, marginTop: 2 },
  h2: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginTop: 18, marginBottom: 6 },
  para: { fontSize: 8.5, color: DIM, lineHeight: 1.45, marginBottom: 3 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 5 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: LINE },
  th: { fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: SUBTLE, padding: 5, letterSpacing: 0.4 },
  td: { fontSize: 8, padding: 5 },
  total: { flexDirection: 'row', backgroundColor: BAND },
  foot: { position: 'absolute', bottom: 18, left: 38, right: 38, fontSize: 7, color: SUBTLE, flexDirection: 'row', justifyContent: 'space-between' },
});

const money = (v: number) => formatINR(v, { symbol: false });
const pct = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('en-IN')}%`;
const COLS = [22, 11, 10, 13, 8, 7, 13, 16]; // percentage widths, sum 100

export function TruePropertyCostDocument({
  schedule,
  preparedOn,
}: {
  schedule: Schedule & { name: string };
  /** DD/MM/YYYY, passed in so the document is a pure function of its inputs. */
  preparedOn: string;
}) {
  const r = landedCost(schedule);
  const y = rentalYield(schedule, r);
  const name = schedule.name.trim() || 'Untitled property';

  const cells: [string, string, string][] = [
    ['TOTAL PAID', money(r.paid), `${r.rows.length} payments`],
    ['INTEREST ON BORROWED FUNDS', money(r.borrowed.interest), `${pct(schedule.rates.borrowed)} a year`],
    ['RETURN OWN FUNDS GAVE UP', money(r.self.interest), `${pct(schedule.rates.self)} a year`],
    ['CASH COST', money(r.cash), 'Payments + loan interest'],
    ['COST OF FUNDS ADDED', pct(r.upliftPct), 'On top of the amount paid'],
    ['AVERAGE DAYS TIED UP', Math.round(r.weightedDays).toLocaleString('en-IN'), 'Weighted by amount'],
  ];
  if (r.perSqft && schedule.areaSqft) {
    cells.push(['TRUE COST PER SQ FT', money(r.perSqft.landed), `Paid ${money(r.perSqft.paid)} per sq ft`]);
  }

  return (
    <Document title={`${name} - True Property Cost`} author={BRAND.name} subject="True cost at possession">
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={s.brand}>
            <PdfMark size={26} />
            <View>
              <Text style={s.brandName}>{BRAND.name}</Text>
              <Text style={s.brandSub}>TRUE PROPERTY COST</Text>
            </View>
          </View>
          <View>
            <Text style={[s.note, { textAlign: 'right' }]}>Prepared {preparedOn}</Text>
            <Text style={[s.note, { textAlign: 'right' }]}>All amounts in Indian rupees</Text>
          </View>
        </View>

        <Text style={s.title}>{name}</Text>
        <Text style={s.meta}>
          OC / possession {displayDate(schedule.ocDate)} · {COMPOUNDING_LABEL[schedule.compounding]}, actual/365
        </Text>

        <View style={s.hero}>
          <Text style={s.heroLabel}>TRUE COST AT POSSESSION</Text>
          <Text style={s.heroFigure}>{money(r.landed)}</Text>
          <Text style={s.heroLine}>
            {money(r.paid)} paid, plus {money(r.interest)} it cost to have that money tied up until the OC date.
          </Text>
        </View>

        <View style={s.grid}>
          {cells.map(([label, value, note]) => (
            <View key={label} style={s.cell}>
              <Text style={s.cellLabel}>{label}</Text>
              <Text style={s.cellValue}>{value}</Text>
              <Text style={s.cellNote}>{note}</Text>
            </View>
          ))}
        </View>

        {y && (
          <>
            <Text style={s.h2}>Rental yield</Text>
            <View style={s.grid}>
              {(
                [
                  ['NET YIELD ON TRUE COST', pct(y.netOnTrue), `${money(y.netAnnual)} net a year`],
                  ['COST OF THE MONEY', pct(y.blendedRate), 'Own and borrowed, weighted'],
                  [
                    y.spread >= 0 ? 'ABOVE COST OF FUNDS' : 'BELOW COST OF FUNDS',
                    `${y.spread >= 0 ? '+' : ''}${pct(y.spread)}`,
                    y.spread >= 0 ? 'The rent covers the money' : 'The rent does not cover the money',
                  ],
                  ['GROSS YIELD ON PRICE PAID', pct(y.grossOnPaid), 'The yield usually quoted'],
                  [
                    'BREAK-EVEN RENT',
                    Number.isFinite(y.breakEvenRent) ? `${money(y.breakEvenRent)} / month` : 'None',
                    'For net yield to equal cost of funds',
                  ],
                  [
                    'PAYBACK ON TRUE COST',
                    y.paybackYears === null ? 'Never' : `${(Math.round(y.paybackYears * 10) / 10).toLocaleString('en-IN')} years`,
                    'Net rent, no growth',
                  ],
                ] as [string, string, string][]
              ).concat(
                y.netOnMarket !== undefined ? [['NET YIELD ON MARKET VALUE', pct(y.netOnMarket), 'On the value entered']] : [],
              ).map(([label, value, note]) => (
                <View key={label} style={s.cell}>
                  <Text style={s.cellLabel}>{label}</Text>
                  <Text style={s.cellValue}>{value}</Text>
                  <Text style={s.cellNote}>{note}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={s.h2}>How it is worked out</Text>
        <Text style={s.para}>
          Each payment carries the cost of its source of funds from the day after it is paid up to the OC date: amount x
          annual rate x days to possession / 365 for simple interest. A payment on or after the OC date carries nothing.
          Own funds are charged at the return they gave up; borrowed funds at the loan rate.
        </Text>
        <Text style={s.para}>
          Not modelled: EMI repayments during construction (borrowed principal is treated as outstanding until
          possession), changes in rates, tax on rent, and tax benefits on home-loan interest. The rental yield is
          pre-tax and assumes no appreciation and no rent escalation.
        </Text>

        <Text style={s.h2} break={r.rows.length > 10}>
          Payment by payment
        </Text>
        <View style={s.table}>
          <View style={[s.tr, { backgroundColor: BAND }]} fixed>
            {['PAYMENT', 'DATE', 'SOURCE', 'AMOUNT', 'DAYS', 'RATE', 'COST OF FUNDS', 'VALUE AT OC'].map((h, i) => (
              <Text key={h} style={[s.th, { width: `${COLS[i]}%`, textAlign: i >= 3 ? 'right' : 'left' }]}>
                {h}
              </Text>
            ))}
          </View>
          {r.rows.map((row) => (
            <View key={row.id} style={s.tr} wrap={false}>
              <Text style={[s.td, { width: `${COLS[0]}%` }]}>{row.name}</Text>
              <Text style={[s.td, { width: `${COLS[1]}%` }]}>{displayDate(row.date)}</Text>
              <Text style={[s.td, { width: `${COLS[2]}%`, color: row.source === 'self' ? OWN : BORROW }]}>
                {SOURCE_LABEL[row.source]}
              </Text>
              <Text style={[s.td, { width: `${COLS[3]}%`, textAlign: 'right' }]}>{money(row.amount)}</Text>
              <Text style={[s.td, { width: `${COLS[4]}%`, textAlign: 'right' }]}>
                {row.afterOc ? 'After OC' : row.days.toLocaleString('en-IN')}
              </Text>
              <Text style={[s.td, { width: `${COLS[5]}%`, textAlign: 'right' }]}>{pct(row.rate)}</Text>
              <Text style={[s.td, { width: `${COLS[6]}%`, textAlign: 'right' }]}>{money(row.interest)}</Text>
              <Text style={[s.td, { width: `${COLS[7]}%`, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                {money(row.atPossession)}
              </Text>
            </View>
          ))}
          <View style={s.total}>
            <Text style={[s.td, { width: `${COLS[0] + COLS[1] + COLS[2]}%`, fontFamily: 'Helvetica-Bold' }]}>Total</Text>
            <Text style={[s.td, { width: `${COLS[3]}%`, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{money(r.paid)}</Text>
            <Text style={[s.td, { width: `${COLS[4] + COLS[5]}%` }]} />
            <Text style={[s.td, { width: `${COLS[6]}%`, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: ACCENT }]}>
              {money(r.interest)}
            </Text>
            <Text style={[s.td, { width: `${COLS[7]}%`, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{money(r.landed)}</Text>
          </View>
        </View>

        <View style={s.foot} fixed>
          <Text>{BRAND.name} · True Property Cost · worked out in the browser, not stored on a server</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
