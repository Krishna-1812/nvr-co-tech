import type { ReactNode } from 'react';
import { Document, Line, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import { BRAND } from '@/lib/marketing/content';
import { PdfMark } from '@/lib/brand/PdfMark';
import { fitWords, fontStack, registerPdfFonts, textFont } from '@/lib/pdf/fonts';
import { formatINR } from '@/lib/recon/amount';
import {
  COMPOUNDING_LABEL,
  DELAY_STEPS,
  SOURCE_LABEL,
  delayCase,
  landedCost,
  rentalYield,
  timeline,
  uncounted,
  type Schedule,
} from './calc';
import { METHOD, afterOcNote, rentVerdict } from './words';
import { displayDate } from './workbook';

/**
 * A True Property Cost schedule, printed.
 *
 * The thing that goes in a file or to a client, so it carries everything the
 * screen does and in the same words: the answer and how it splits, the chart of
 * money tied up over time, every figure that was entered, any payment that could
 * not be counted and why, the rental yield with its verdict, what a late
 * possession would cost, the working payment by payment, and the method with its
 * limits. A reader with only the PDF should be able to check every figure in it
 * and know everything the person who made it was told.
 *
 * It is set in Figtree, the product's face, with a face for each Indian script
 * behind it, so a ₹ or a label typed in Hindi prints as typed; see lib/pdf/fonts
 * for why that replaced Helvetica. Vector text, so it can be searched and copied.
 */

const INK = '#2B211B';
const DIM = '#4A3D33';
const SUBTLE = '#67574A';
const LINE = '#E2D3BF';
const BAND = '#F6EFE4';
const ACCENT = '#9C4026';
const OWN = '#268769';
const BORROW = '#CF9A35';
const WARN_BG = '#F8E9DF';
const WARN_LINE = '#E3BFA8';
const GOOD_BG = '#E6EEDF';
const GOOD_LINE = '#B9CDA9';
const GOOD = '#4E6A2C';

const s = StyleSheet.create({
  // The bottom padding keeps every line of content clear of the fixed footer.
  page: { paddingTop: 34, paddingBottom: 58, paddingHorizontal: 38, fontSize: 9, color: INK },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { fontSize: 11, fontWeight: 700 },
  brandSub: { fontSize: 7, color: SUBTLE, marginTop: 2, letterSpacing: 0.6 },
  title: { fontSize: 18, fontWeight: 700, marginTop: 18 },
  meta: { fontSize: 9, color: DIM, marginTop: 4 },
  note: { fontSize: 7.5, color: SUBTLE, marginTop: 2 },
  hero: { marginTop: 16, padding: 14, backgroundColor: BAND, borderRadius: 6 },
  label: { fontSize: 7, fontWeight: 700, color: SUBTLE, letterSpacing: 0.7 },
  heroFigure: { fontSize: 24, fontWeight: 700, marginTop: 4 },
  heroLine: { fontSize: 9, color: DIM, marginTop: 4, lineHeight: 1.4 },
  split: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 12 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  legendText: { fontSize: 8, color: DIM },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 4, marginTop: 1.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8 },
  cell: { width: '31.8%', borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 8 },
  cellValue: { fontSize: 11, fontWeight: 700, marginTop: 3 },
  cellNote: { fontSize: 7, color: SUBTLE, marginTop: 2 },
  h2: { fontSize: 10.5, fontWeight: 700, marginTop: 18, marginBottom: 6 },
  para: { fontSize: 8.5, color: DIM, lineHeight: 1.45, marginBottom: 3 },
  kv: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: LINE, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  kvRow: { width: '50%', flexDirection: 'row', paddingVertical: 3, paddingRight: 8 },
  kvKey: { width: '52%', fontSize: 8, color: SUBTLE },
  kvValue: { width: '48%', fontSize: 8, fontWeight: 600 },
  box: { borderWidth: 1, borderRadius: 5, padding: 8, marginTop: 8 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 5 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: LINE },
  th: { fontSize: 6.8, fontWeight: 700, color: SUBTLE, padding: 5, letterSpacing: 0.4 },
  td: { fontSize: 8, padding: 5 },
  total: { flexDirection: 'row', backgroundColor: BAND },
  bullet: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { width: 9, fontSize: 8.5, color: DIM },
  foot: { position: 'absolute', bottom: 22, left: 38, right: 38, fontSize: 7, color: SUBTLE, flexDirection: 'row', justifyContent: 'space-between' },
});

const money = (v: number) => formatINR(v);
const plain = (v: number) => formatINR(v, { symbol: false });
const pct = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
/** ₹40.85 L, ₹1.24 Cr: for chart axes, where the exact figure is in the table below. */
const compact = (v: number) =>
  v >= 1e7
    ? `₹${(v / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`
    : v >= 1e5
      ? `₹${(v / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`
      : `₹${Math.round(v).toLocaleString('en-IN')}`;
/*
 * react-pdf splits text into runs wherever the script changes ("(" is common
 * punctuation, "बुकिंग" is Devanagari) and treats each boundary as a place it
 * may break a word and add a hyphen. Typed labels are only ever split at
 * spaces, so those boundaries are made unbreakable: 10000 is the line breaker's
 * "never".
 */
const NO_BREAK = 10000;
// react-pdf's layout reads `hyphenationPenalty` from a Text's props, but its
// types leave the prop out, so it is passed as a spread.
const UNBROKEN = { hyphenationPenalty: NO_BREAK };
/** The page's text width in points: A4's 595 less 38 a side. */
const TEXT_WIDTH = 519;
const COLS = [21, 11, 10, 13, 9, 7, 13, 16]; // percentage widths, sum 100

type Fact = [label: string, value: string, note: string];

export function TruePropertyCostDocument({
  schedule,
  preparedOn,
}: {
  schedule: Schedule & { name: string };
  /** DD/MM/YYYY, passed in so the document is a pure function of its inputs. */
  preparedOn: string;
}) {
  registerPdfFonts();
  const r = landedCost(schedule);
  const y = rentalYield(schedule, r);
  const missing = uncounted(schedule);
  const delays = DELAY_STEPS.map((m) => delayCase(schedule, m, r));
  const points = timeline(schedule, 72);
  const afterOc = r.rows.filter((row) => row.afterOc).length;
  const name = schedule.name.trim() || 'Untitled property';
  const rental = schedule.rental;
  const fontFamily = fontStack([name, ...schedule.instalments.map((i) => i.label)]);

  const figures: Fact[] = [
    ['TOTAL PAID', money(r.paid), `${r.rows.length} ${r.rows.length === 1 ? 'payment' : 'payments'}`],
    ['INTEREST ON BORROWED FUNDS', money(r.borrowed.interest), `${pct(schedule.rates.borrowed)} a year`],
    ['RETURN OWN FUNDS GAVE UP', money(r.self.interest), `${pct(schedule.rates.self)} a year`],
    ['CASH COST', money(r.cash), 'Payments + loan interest'],
    ['COST OF FUNDS ADDED', pct(r.upliftPct), 'On top of the amount paid'],
    ['AVERAGE DAYS TIED UP', Math.round(r.weightedDays).toLocaleString('en-IN'), 'Each rupee, weighted by amount'],
  ];
  if (r.perSqft) figures.push(['TRUE COST PER SQ FT', money(r.perSqft.landed), `Paid ${money(r.perSqft.paid)} per sq ft`]);

  const split = [
    { label: 'Own funds', value: r.self.paid, color: OWN },
    { label: 'Borrowed funds', value: r.borrowed.paid, color: BORROW },
    { label: 'Carrying cost', value: r.interest, color: ACCENT },
  ];
  const share = (v: number) => (r.landed > 0 ? (v / r.landed) * 100 : 0);

  const entered: [string, string][] = [
    ['OC / possession date', displayDate(schedule.ocDate)],
    ['Carpet area', schedule.areaSqft ? `${schedule.areaSqft.toLocaleString('en-IN')} sq ft` : 'Not entered'],
    ['Cost of own funds', `${pct(schedule.rates.self)} a year`],
    ['Cost of borrowed funds', `${pct(schedule.rates.borrowed)} a year`],
    ['Interest method', `${COMPOUNDING_LABEL[schedule.compounding]}, actual/365`],
    [
      'Payments entered',
      missing.length === 0
        ? `${schedule.instalments.length}, all counted`
        : `${schedule.instalments.length}, ${r.rows.length} counted`,
    ],
  ];
  const opt = (v: number | undefined, f: (n: number) => string) => (v !== undefined && Number.isFinite(v) && v > 0 ? f(v) : 'Not entered');
  const rentEntered: [string, string][] = rental
    ? [
        ['Expected rent a month', opt(rental.monthlyRent, money)],
        ['Maintenance a month', opt(rental.maintenanceMonthly, money)],
        ['Other costs a year', opt(rental.annualCosts, money)],
        ['Vacancy', opt(rental.vacancyPct, (v) => `${pct(v)} of the year`)],
        ['Market value today', opt(rental.marketValue, money)],
      ]
    : [];
  const rentTyped = rentEntered.some(([, v]) => v !== 'Not entered');

  return (
    <Document title={`${name} - True Property Cost`} author={BRAND.name} subject="True cost at possession">
      <Page size="A4" style={[s.page, { fontFamily }]}>
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
            <Text style={[s.note, { textAlign: 'right' }]}>All amounts in Indian rupees (₹)</Text>
          </View>
        </View>

        <Text style={[s.title, { fontFamily: textFont(name) }]} {...UNBROKEN}>
          {fitWords(name, TEXT_WIDTH, 18, true)}
        </Text>
        <Text style={s.meta}>
          OC / possession {displayDate(schedule.ocDate)} · {COMPOUNDING_LABEL[schedule.compounding]}, days counted actual/365
        </Text>

        {/* ── The answer, and how it splits ── */}
        <View style={s.hero} wrap={false}>
          <Text style={s.label}>TRUE COST AT POSSESSION</Text>
          <Text style={s.heroFigure}>{money(r.landed)}</Text>
          <Text style={s.heroLine}>
            {money(r.paid)} paid, plus {money(r.interest)} it cost to have that money tied up until the OC date.
          </Text>
          <View style={s.split}>
            {split.map((p) => (
              <View key={p.label} style={{ width: `${share(p.value)}%`, backgroundColor: p.color }} />
            ))}
          </View>
          <View style={s.legend}>
            {split.map((p) => (
              <View key={p.label} style={{ flexDirection: 'row' }}>
                <View style={[s.dot, { backgroundColor: p.color }]} />
                <Text style={s.legendText}>
                  {p.label} {money(p.value)} · {pct(Math.round(share(p.value) * 10) / 10)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Facts facts={figures} />

        {missing.length > 0 && (
          <View style={[s.box, { borderColor: WARN_LINE, backgroundColor: WARN_BG }]} wrap={false}>
            <Text style={[s.label, { color: ACCENT }]}>
              {missing.length === 1 ? '1 PAYMENT IS NOT COUNTED' : `${missing.length} PAYMENTS ARE NOT COUNTED`} IN ANY FIGURE
            </Text>
            <Text style={[s.para, { marginTop: 4 }]}>
              {missing.length === 1 ? 'It needs' : 'Each needs'} a date and an amount above zero before it can be worked out.
              Until then every figure in this report leaves {missing.length === 1 ? 'it' : 'them'} out.
            </Text>
            {missing.map((m) => (
              <View key={m.id} style={s.bullet}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={[s.para, { flex: 1, marginBottom: 0 }]} {...UNBROKEN}>
                  <Text style={{ fontWeight: 700, color: INK, fontFamily: textFont(m.name) }}>{fitWords(m.name, TEXT_WIDTH - 40, 8.5, true)}</Text>
                  {` (payment ${m.position}`}
                  {m.date ? `, ${displayDate(m.date)}` : ''}
                  {Number.isFinite(m.amount) && m.amount > 0 ? `, ${money(m.amount)}` : ''}
                  {`, ${SOURCE_LABEL[m.source]}): ${m.reasons.join(' ')}`}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Money over time ── */}
        {points.length > 1 && (
          <View wrap={false}>
            <Text style={s.h2}>Money tied up, over time</Text>
            <Text style={s.para}>
              What had been paid from each source, and the carrying cost building on top of it, up to possession.
            </Text>
            <MoneyChart points={points} ocDay={dayOf(schedule.ocDate)} landed={r.landed} />
          </View>
        )}

        {/* ── What was entered ── */}
        <View wrap={false}>
          <Text style={s.h2}>What was entered</Text>
          <Pairs pairs={entered} />
          {rentTyped && (
            <>
              <Text style={[s.label, { marginTop: 8, marginBottom: 4 }]}>FOR THE RENTAL YIELD</Text>
              <Pairs pairs={rentEntered} />
            </>
          )}
        </View>

        {/* ── Rental yield ── */}
        {y ? (
          <View wrap={false}>
            <Text style={s.h2}>Rental yield</Text>
            <Text style={s.para}>What the property earns once it is let, against what it really cost and what that money costs a year.</Text>
            <View style={[s.hero, { marginTop: 4 }]}>
              <Text style={s.label}>NET YIELD ON TRUE COST</Text>
              <Text style={[s.heroFigure, { fontSize: 20 }]}>{pct(y.netOnTrue)}</Text>
              <Text style={s.heroLine}>{money(y.netAnnual)} a year after vacancy and costs</Text>
              <YieldBars net={y.netOnTrue} cost={y.blendedRate} />
              <Verdict text={rentVerdict(y).text} covers={rentVerdict(y).covers} />
            </View>
            <Facts
              facts={[
                ['GROSS YIELD ON PRICE PAID', pct(y.grossOnPaid), 'The yield usually quoted'],
                ['GROSS YIELD ON TRUE COST', pct(y.grossOnTrue), 'Before vacancy and costs'],
                ...(y.netOnMarket !== undefined
                  ? ([['NET YIELD ON MARKET VALUE', pct(y.netOnMarket), 'On the value entered']] as Fact[])
                  : []),
              ]}
            />
            <Text style={[s.note, { marginTop: 6 }]}>{METHOD.yieldBasis}</Text>
          </View>
        ) : (
          rentTyped && (
            <Text style={[s.para, { marginTop: 8 }]}>No rental yield: the expected rent a month is not entered.</Text>
          )
        )}

        {/* ── If possession slips ── */}
        <View wrap={false}>
          <Text style={s.h2}>If possession slips</Text>
          <Text style={s.para}>The same payments, carried to a later OC date.</Text>
          <View style={s.table}>
            <View style={[s.tr, { backgroundColor: BAND }]}>
              {['OC MOVES BY', 'OC THEN', 'EXTRA CARRYING COST', 'ABOUT A MONTH', 'TRUE COST THEN', 'OVER PAID'].map((h, i) => (
                <Text key={h} style={[s.th, { width: `${DELAY_COLS[i]}%`, textAlign: i >= 2 ? 'right' : 'left' }]}>
                  {h}
                </Text>
              ))}
            </View>
            {delays.map((d, i) => (
              <View key={d.months} style={[s.tr, i === delays.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                <Text style={[s.td, { width: `${DELAY_COLS[0]}%` }]}>
                  {d.months} {d.months === 1 ? 'month' : 'months'}
                </Text>
                <Text style={[s.td, { width: `${DELAY_COLS[1]}%` }]}>{displayDate(d.ocDate)}</Text>
                <Text style={[s.td, { width: `${DELAY_COLS[2]}%`, textAlign: 'right', color: ACCENT }]}>+{plain(d.extra)}</Text>
                <Text style={[s.td, { width: `${DELAY_COLS[3]}%`, textAlign: 'right' }]}>{plain(d.perMonth)}</Text>
                <Text style={[s.td, { width: `${DELAY_COLS[4]}%`, textAlign: 'right', fontWeight: 700 }]}>{plain(d.landed)}</Text>
                <Text style={[s.td, { width: `${DELAY_COLS[5]}%`, textAlign: 'right' }]}>{pct(d.upliftPct)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── The working ── */}
        <Text style={s.h2} minPresenceAhead={80}>
          Payment by payment
        </Text>
        <Text style={s.para}>
          {COMPOUNDING_LABEL[schedule.compounding]}, days counted actual/365 to {displayDate(schedule.ocDate)}. Amounts in rupees.
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
              <Text style={[s.td, { width: `${COLS[0]}%`, fontFamily: textFont(row.name) }]} {...UNBROKEN}>
                {fitWords(row.name, (TEXT_WIDTH * COLS[0]) / 100 - 10, 8)}
              </Text>
              <Text style={[s.td, { width: `${COLS[1]}%` }]}>{displayDate(row.date)}</Text>
              <Text style={[s.td, { width: `${COLS[2]}%`, color: row.source === 'self' ? OWN : BORROW }]}>
                {SOURCE_LABEL[row.source]}
              </Text>
              <Text style={[s.td, { width: `${COLS[3]}%`, textAlign: 'right' }]}>{plain(row.amount)}</Text>
              <Text style={[s.td, { width: `${COLS[4]}%`, textAlign: 'right' }]}>
                {row.afterOc ? 'After OC' : row.days.toLocaleString('en-IN')}
              </Text>
              <Text style={[s.td, { width: `${COLS[5]}%`, textAlign: 'right' }]}>{pct(row.rate)}</Text>
              <Text style={[s.td, { width: `${COLS[6]}%`, textAlign: 'right' }]}>{plain(row.interest)}</Text>
              <Text style={[s.td, { width: `${COLS[7]}%`, textAlign: 'right', fontWeight: 700 }]}>{plain(row.atPossession)}</Text>
            </View>
          ))}
          <View style={s.total} wrap={false}>
            <Text style={[s.td, { width: `${COLS[0] + COLS[1] + COLS[2]}%`, fontWeight: 700 }]}>Total</Text>
            <Text style={[s.td, { width: `${COLS[3]}%`, textAlign: 'right', fontWeight: 700 }]}>{plain(r.paid)}</Text>
            <Text style={[s.td, { width: `${COLS[4] + COLS[5]}%` }]} />
            <Text style={[s.td, { width: `${COLS[6]}%`, textAlign: 'right', fontWeight: 700, color: ACCENT }]}>
              {plain(r.interest)}
            </Text>
            <Text style={[s.td, { width: `${COLS[7]}%`, textAlign: 'right', fontWeight: 700 }]}>{plain(r.landed)}</Text>
          </View>
        </View>
        {afterOc > 0 && <Text style={[s.note, { marginTop: 5 }]}>{afterOcNote(afterOc)}</Text>}
        {missing.length > 0 && (
          <Text style={[s.note, { marginTop: 3 }]}>
            Not in this table: {missing.map((m) => m.name).join(', ')}. See the note under the figures above.
          </Text>
        )}

        {/* ── The method ── */}
        <View wrap={false}>
          <Text style={s.h2}>How it is worked out</Text>
          <Text style={[s.label, { marginBottom: 4 }]}>THE COST OF EACH PAYMENT</Text>
          <Text style={[s.para, { fontWeight: 600, color: INK }]}>{METHOD.formula}</Text>
          {METHOD.rules.map((rule) => (
            <Bullet key={rule}>{rule}</Bullet>
          ))}
          <Text style={[s.label, { marginTop: 8, marginBottom: 4 }]}>WHAT THE FIGURES MEAN</Text>
          {METHOD.meanings.map(([term, meaning]) => (
            <Bullet key={term}>
              <Text style={{ fontWeight: 700, color: INK }}>{term}</Text>: {meaning}
            </Bullet>
          ))}
          <Text style={[s.label, { marginTop: 8, marginBottom: 4 }]}>NOT MODELLED</Text>
          <Text style={s.para}>{METHOD.notModelled}</Text>
        </View>

        <View style={s.foot} fixed>
          <Text>{BRAND.name} · True Property Cost · worked out in the browser, not stored on a server</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

const DELAY_COLS = [14, 14, 20, 16, 20, 16];

function Facts({ facts }: { facts: Fact[] }) {
  return (
    <View style={s.grid}>
      {facts.map(([label, value, note]) => (
        <View key={label} style={s.cell} wrap={false}>
          <Text style={s.label}>{label}</Text>
          <Text style={s.cellValue}>{value}</Text>
          <Text style={s.cellNote}>{note}</Text>
        </View>
      ))}
    </View>
  );
}

function Pairs({ pairs }: { pairs: [string, string][] }) {
  return (
    <View style={s.kv}>
      {pairs.map(([k, v]) => (
        <View key={k} style={s.kvRow}>
          <Text style={s.kvKey}>{k}</Text>
          <Text style={s.kvValue}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={s.bullet}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={[s.para, { flex: 1, marginBottom: 0 }]}>{children}</Text>
    </View>
  );
}

/** The net yield beside what the money costs, on one scale, as the screen draws them. */
function YieldBars({ net, cost }: { net: number; cost: number }) {
  const scale = Math.max(net, cost, 0.01) * 1.15;
  const w = (v: number) => `${Math.max(0, Math.min(100, (v / scale) * 100))}%`;
  return (
    <View style={{ marginTop: 10, gap: 6 }}>
      {[
        { label: 'Net yield', value: net, color: OWN },
        { label: 'Cost of the money', value: cost, color: ACCENT },
      ].map((b) => (
        <View key={b.label}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.legendText}>{b.label}</Text>
            <Text style={[s.legendText, { fontWeight: 700, color: INK }]}>{pct(b.value)}</Text>
          </View>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: LINE, marginTop: 3 }}>
            <View style={{ height: 5, borderRadius: 3, width: w(b.value), backgroundColor: b.color }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Verdict({ text, covers }: { text: string; covers: boolean }) {
  return (
    <View
      style={[
        s.box,
        { marginTop: 10, borderColor: covers ? GOOD_LINE : WARN_LINE, backgroundColor: covers ? GOOD_BG : WARN_BG },
      ]}
    >
      <Text style={{ fontSize: 8.5, fontWeight: 600, color: covers ? GOOD : ACCENT, lineHeight: 1.4 }}>{text}</Text>
    </View>
  );
}

const DAY_MS = 86_400_000;
function dayOf(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS : NaN;
}
function monthYear(day: number): string {
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(day * DAY_MS));
}

/**
 * The screen's "Money tied up, over time", drawn for paper: own funds paid,
 * borrowed funds paid on top, and the carrying cost on top of both, so the top
 * edge at the OC date is the true cost. Flat fills, because gradients band on
 * a laser print; the labels are ordinary text so they take the document's fonts.
 */
function MoneyChart({
  points,
  ocDay,
  landed,
}: {
  points: { day: number; self: number; borrowed: number; carry: number }[];
  ocDay: number;
  landed: number;
}) {
  const W = TEXT_WIDTH;
  const H = 150;
  const LEFT = 44;
  const BOTTOM = 16;
  const plotW = W - LEFT - 4;
  const plotH = H - BOTTOM - 6;
  const start = points[0].day;
  const end = points[points.length - 1].day;
  const span = Math.max(1, end - start);

  // A round step for the gridlines: 1, 2 or 5 times a power of ten, in rupees.
  const top = Math.max(landed, 1);
  const raw = top / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * pow).find((v) => v >= raw) ?? raw;
  const max = Math.ceil(top / step) * step;

  const x = (day: number) => LEFT + ((day - start) / span) * plotW;
  const yy = (v: number) => 6 + plotH - (v / max) * plotH;
  const area = (lo: (p: (typeof points)[number]) => number, hi: (p: (typeof points)[number]) => number) =>
    `M ${points.map((p) => `${x(p.day).toFixed(2)} ${yy(hi(p)).toFixed(2)}`).join(' L ')} L ${[...points]
      .reverse()
      .map((p) => `${x(p.day).toFixed(2)} ${yy(lo(p)).toFixed(2)}`)
      .join(' L ')} Z`;
  const edge = (hi: (p: (typeof points)[number]) => number) =>
    `M ${points.map((p) => `${x(p.day).toFixed(2)} ${yy(hi(p)).toFixed(2)}`).join(' L ')}`;

  const own = (p: (typeof points)[number]) => p.self;
  const paid = (p: (typeof points)[number]) => p.self + p.borrowed;
  const all = (p: (typeof points)[number]) => p.self + p.borrowed + p.carry;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const ocX = Number.isFinite(ocDay) ? x(Math.min(Math.max(ocDay, start), end)) : null;

  return (
    <View style={{ width: W, height: H + 18, marginTop: 4 }}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {ticks.map((t) => (
          <Line key={t} x1={LEFT} x2={W - 4} y1={yy(t)} y2={yy(t)} stroke={LINE} strokeWidth={0.6} />
        ))}
        <Path d={area(() => 0, own)} fill={OWN} fillOpacity={0.22} />
        <Path d={area(own, paid)} fill={BORROW} fillOpacity={0.22} />
        <Path d={area(paid, all)} fill={ACCENT} fillOpacity={0.25} />
        <Path d={edge(own)} stroke={OWN} strokeWidth={1} fill="none" />
        <Path d={edge(paid)} stroke={BORROW} strokeWidth={1} fill="none" />
        <Path d={edge(all)} stroke={ACCENT} strokeWidth={1.3} fill="none" />
        {ocX !== null && <Line x1={ocX} x2={ocX} y1={6} y2={6 + plotH} stroke={SUBTLE} strokeWidth={0.7} strokeDasharray="2 2" />}
      </Svg>
      {ticks.map((t) => (
        <Text key={t} style={{ position: 'absolute', left: 0, width: LEFT - 6, top: yy(t) - 4, fontSize: 6.5, color: SUBTLE, textAlign: 'right' }}>
          {t === 0 ? '0' : compact(t)}
        </Text>
      ))}
      <Text style={{ position: 'absolute', left: LEFT, top: H - 10, fontSize: 6.5, color: SUBTLE }}>{monthYear(start)}</Text>
      {ocX !== null && (
        <Text style={{ position: 'absolute', left: ocX - 60, width: 60, top: H - 10, fontSize: 6.5, color: SUBTLE, textAlign: 'right' }}>
          OC {monthYear(ocDay)}
        </Text>
      )}
      <View style={{ position: 'absolute', left: LEFT, top: H + 4, flexDirection: 'row', gap: 14 }}>
        {[
          { label: 'Own funds paid', color: OWN },
          { label: 'Borrowed funds paid', color: BORROW },
          { label: `Carrying cost (true cost ${compact(landed)} at OC)`, color: ACCENT },
        ].map((l) => (
          <View key={l.label} style={{ flexDirection: 'row' }}>
            <View style={[s.dot, { backgroundColor: l.color }]} />
            <Text style={[s.legendText, { fontSize: 7 }]}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
