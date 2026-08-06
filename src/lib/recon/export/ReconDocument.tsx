import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatINR } from '../amount';
import { formatLedgerDate } from '../dates';
import type { DifferenceItem, ReconResult } from '../types';

/**
 * The reconciliation, printed.
 *
 * This is the artefact: the thing that gets attached to a file, emailed to a
 * client, or handed to an auditor who was not in the room. So it is a working
 * paper and not a screenshot of the app — vector text throughout, so it is
 * searchable and copyable, and laid out the way a reconciliation statement has
 * looked for a hundred years.
 *
 * Helvetica is one of the fourteen standard PDF fonts, so nothing is embedded
 * and nothing is fetched at render time. That matters in a serverless function,
 * where a font download is the difference between a fast response and a timeout.
 *
 * The rupee sign is the one thing that cannot come from a standard font, so
 * every figure here is printed without it and the currency is stated once, in
 * the header. Rendering a ₹ in Helvetica produces a blank box.
 */

const INK = '#3D52A0';
const TEXT = '#1F2937';
const MUTED = '#6B7280';
const SOFT = '#9CA3AF';
const BORDER = '#D7DCEE';
const BAND = '#F5F6FB';
const GOOD = '#047857';
const BAD = '#B91C1C';

const s = StyleSheet.create({
  page: {
    paddingVertical: 32,
    paddingHorizontal: 34,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: TEXT,
  },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  wordmark: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: INK, letterSpacing: -0.5 },
  wordmarkSub: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: SOFT, marginTop: 3, letterSpacing: 0.8 },
  titleBlock: { alignItems: 'flex-end' },
  docTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  docMeta: { fontSize: 8, color: MUTED, marginTop: 3 },

  rule: { borderBottom: `1.5pt solid ${INK}`, marginTop: 10, marginBottom: 14 },

  verdict: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: `0.75pt solid ${BORDER}`,
    backgroundColor: BAND,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  verdictLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  verdictNote: { fontSize: 7.5, color: MUTED, marginTop: 2, maxWidth: 320 },
  verdictFigure: { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  verdictFigureNote: { fontSize: 7, color: MUTED, textAlign: 'right', marginTop: 2 },

  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    color: MUTED,
    marginBottom: 6,
  },

  // Two ledger summaries, side by side.
  pair: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  panel: { flex: 1, border: `0.5pt solid ${BORDER}`, borderRadius: 4, padding: 10 },
  panelName: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  panelKey: { fontSize: 7, color: SOFT, letterSpacing: 0.8, marginBottom: 4 },
  panelFigure: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 6 },
  panelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  panelLabel: { fontSize: 7.5, color: MUTED },
  panelValue: { fontSize: 7.5 },

  // The statement.
  stmt: { border: `0.5pt solid ${BORDER}`, borderRadius: 4, marginBottom: 16 },
  stmtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  stmtBalance: { backgroundColor: BAND },
  stmtBlockLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
    color: MUTED,
    paddingTop: 8,
    paddingBottom: 2,
    paddingHorizontal: 12,
  },
  stmtItem: { flex: 1, fontSize: 8, color: TEXT, paddingRight: 12 },
  stmtItemIndent: { paddingLeft: 12 },
  stmtAmount: { fontSize: 8, width: 96, textAlign: 'right' },
  stmtStrong: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  stmtEmpty: { fontSize: 8, color: SOFT, paddingHorizontal: 24, paddingVertical: 3 },

  // Differences.
  thead: { flexDirection: 'row', backgroundColor: BAND, borderBottom: `0.5pt solid ${BORDER}` },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, color: MUTED, padding: 5 },
  tr: { flexDirection: 'row', borderBottom: `0.25pt solid ${BORDER}` },
  td: { fontSize: 7.5, padding: 5 },
  cType: { width: 62 },
  cWhat: { flex: 1 },
  cMoney: { width: 68, textAlign: 'right' },
  cNote: { width: 150 },

  footer: {
    position: 'absolute',
    bottom: 20,
    left: 34,
    right: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 6.5,
    color: SOFT,
  },
});

const CATEGORY_LABEL: Record<DifferenceItem['category'], string> = {
  MATCHED: 'Matched',
  TIMING: 'Timing',
  ONE_SIDED: 'One-sided',
  AMOUNT_DIFF: 'Amount',
};

const STATUS_LABEL = {
  RECONCILED: 'Reconciled',
  PARTIAL: 'Partly reconciled',
  NOT_RECONCILED: 'Not reconciled',
} as const;

const STATUS_NOTE = {
  RECONCILED: 'The two balances tie out. Every difference between them is listed below.',
  PARTIAL:
    'One file disagrees with itself: its stated closing does not follow from its own lines.',
  NOT_RECONCILED: 'A difference remains that nothing on this statement accounts for.',
} as const;

/** No rupee sign: Helvetica has no glyph for it and would print a blank box. */
const money = (value: number) => formatINR(value, { symbol: false });

export function ReconDocument({ result, preparedBy }: { result: ReconResult; preparedBy: string }) {
  const { statement, summaryA, summaryB } = result;
  const adds = statement.lines.filter((l) => l.operation === 'add');
  const deducts = statement.lines.filter((l) => l.operation === 'less');
  const settled = Math.abs(statement.variance) < 0.01;

  return (
    <Document
      title={`Reconciliation ${statement.reconciliationDate}`}
      author="Finance Intelligence"
      subject={`${summaryA.name} against ${summaryB.name}`}
    >
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.wordmark}>Finance Intelligence</Text>
            <Text style={s.wordmarkSub}>LEDGER RECONCILIATION</Text>
          </View>
          <View style={s.titleBlock}>
            <Text style={s.docTitle}>Reconciliation Statement</Text>
            <Text style={s.docMeta}>
              As at {formatLedgerDate(statement.reconciliationDate)}
            </Text>
            <Text style={s.docMeta}>
              All figures in INR
              {statement.toleranceDays !== null &&
                ` · ${statement.toleranceDays}-day timing tolerance`}
            </Text>
          </View>
        </View>
        <View style={s.rule} />

        {/* ── The answer, before anything else ── */}
        <View style={s.verdict}>
          <View>
            <Text style={{ ...s.verdictLabel, color: settled ? GOOD : BAD }}>
              {STATUS_LABEL[statement.status]}
            </Text>
            <Text style={s.verdictNote}>{STATUS_NOTE[statement.status]}</Text>
          </View>
          <View>
            <Text style={{ ...s.verdictFigure, color: settled ? GOOD : BAD }}>
              {settled ? 'Nil' : money(Math.abs(statement.variance))}
            </Text>
            <Text style={s.verdictFigureNote}>Unexplained difference</Text>
          </View>
        </View>

        {/* ── What each book says ── */}
        <Text style={s.sectionTitle}>THE TWO LEDGERS</Text>
        <View style={s.pair}>
          {[summaryA, summaryB].map((summary) => (
            <View key={summary.key} style={s.panel}>
              <Text style={s.panelKey}>LEDGER {summary.key}</Text>
              <Text style={s.panelName}>{summary.name}</Text>
              <Text style={s.panelFigure}>
                {money(summary.calculatedClosing)} {summary.balanceType}
              </Text>
              <Row label="Opening balance" value={money(Math.abs(summary.openingBalance))} />
              <Row label="Total debits" value={money(summary.totalDebits)} />
              <Row label="Total credits" value={money(summary.totalCredits)} />
              <Row label="Lines counted" value={String(summary.transactionCount)} />
              {summary.providedClosing !== null && (
                <Row
                  label="Closing, as stated"
                  value={money(Math.abs(summary.providedClosing))}
                />
              )}
              {summary.closingMatchesProvided === false && (
                <Text style={{ ...s.panelLabel, color: BAD, marginTop: 4 }}>
                  This file&apos;s stated closing does not follow from its own lines.
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* ── The statement ── */}
        <Text style={s.sectionTitle}>THE STATEMENT</Text>
        <View style={s.stmt}>
          <View style={{ ...s.stmtRow, ...s.stmtBalance }}>
            <Text style={{ ...s.stmtItem, ...s.stmtStrong }}>
              Balance as per {statement.startingLedgerName}
            </Text>
            <Text style={{ ...s.stmtAmount, ...s.stmtStrong }}>
              {money(statement.startingBalance)} {statement.startingBalanceType}
            </Text>
          </View>

          <Block label="ADD" lines={adds} sign="+" />
          <Block label="LESS" lines={deducts} sign="-" />

          <View style={{ ...s.stmtRow, ...s.stmtBalance, borderTop: `1pt solid ${INK}` }}>
            <Text style={{ ...s.stmtItem, ...s.stmtStrong }}>
              Balance as per {statement.otherLedgerName}
            </Text>
            <Text style={{ ...s.stmtAmount, ...s.stmtStrong }}>
              {money(statement.calculatedClosing)} {statement.targetClosingType}
            </Text>
          </View>

          {!settled && (
            <View style={s.stmtRow}>
              <Text style={{ ...s.stmtItem, color: MUTED }}>
                {statement.otherLedgerName}, as that file states it
              </Text>
              <Text style={{ ...s.stmtAmount, color: MUTED }}>
                {money(statement.targetClosing)} {statement.targetClosingType}
              </Text>
            </View>
          )}
        </View>

        {/* ── Everything that was not a clean match ── */}
        <Text style={s.sectionTitle} break={result.differences.length > 14}>
          DIFFERENCES ({result.differences.length})
        </Text>
        {result.differences.length === 0 ? (
          <Text style={{ fontSize: 8, color: MUTED }}>
            Every line in both ledgers matched.
          </Text>
        ) : (
          <View>
            <View style={s.thead} fixed>
              <Text style={{ ...s.th, ...s.cType }}>TYPE</Text>
              <Text style={{ ...s.th, ...s.cWhat }}>PARTICULAR</Text>
              <Text style={{ ...s.th, ...s.cMoney }}>{shorten(summaryA.name)}</Text>
              <Text style={{ ...s.th, ...s.cMoney }}>{shorten(summaryB.name)}</Text>
              <Text style={{ ...s.th, ...s.cMoney }}>DIFFERENCE</Text>
              <Text style={{ ...s.th, ...s.cNote }}>WHAT IT IS</Text>
            </View>
            {result.differences.map((item, i) => (
              <View key={i} style={s.tr} wrap={false}>
                <Text style={{ ...s.td, ...s.cType }}>{CATEGORY_LABEL[item.category]}</Text>
                <Text style={{ ...s.td, ...s.cWhat }}>{item.particular}</Text>
                <Text style={{ ...s.td, ...s.cMoney }}>
                  {item.ledgerAAmount !== null ? money(item.ledgerAAmount) : '-'}
                </Text>
                <Text style={{ ...s.td, ...s.cMoney }}>
                  {item.ledgerBAmount !== null ? money(item.ledgerBAmount) : '-'}
                </Text>
                <Text style={{ ...s.td, ...s.cMoney }}>
                  {item.difference != null ? money(item.difference) : '-'}
                </Text>
                <Text style={{ ...s.td, ...s.cNote, color: MUTED }}>{item.note}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>
            Prepared by {preparedBy} · {summaryA.name} against {summaryB.name}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.panelRow}>
      <Text style={s.panelLabel}>{label}</Text>
      <Text style={s.panelValue}>{value}</Text>
    </View>
  );
}

function Block({
  label,
  lines,
  sign,
}: {
  label: string;
  lines: ReconResult['statement']['lines'];
  sign: '+' | '-';
}) {
  return (
    <View>
      <Text style={s.stmtBlockLabel}>{label}</Text>
      {lines.length === 0 ? (
        <Text style={s.stmtEmpty}>None</Text>
      ) : (
        lines.map((line, i) => (
          <View key={i} style={s.stmtRow} wrap={false}>
            <Text style={{ ...s.stmtItem, ...s.stmtItemIndent }}>{line.description}</Text>
            <Text style={{ ...s.stmtAmount, color: sign === '+' ? GOOD : BAD }}>
              {sign}
              {money(line.amount)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

/** A ledger name has to fit a 68pt column header without wrapping into the row. */
function shorten(name: string): string {
  const upper = name.toUpperCase();
  return upper.length > 12 ? `${upper.slice(0, 11)}…` : upper;
}
