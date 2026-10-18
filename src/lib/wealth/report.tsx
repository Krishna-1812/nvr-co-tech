import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { BRAND } from '@/lib/marketing/content';
import { PdfMark } from '@/lib/brand/PdfMark';
import { fontStack, registerPdfFonts, textFont } from '@/lib/pdf/fonts';
import { GROUPS, HEADS, head } from './heads';
import { counted, summarise, takesNominee } from './calc';
import { checks } from './checks';
import { itemName, memberName, type Item, type WealthRecord } from './model';
import { rupees } from './money';
import { ddmmyyyy, detailRows, nomineeLine } from './present';

/**
 * A wealth record, printed.
 *
 * Written for the person who may one day have to use it: a spouse, a child, an
 * executor. So it opens with the answer (what is owned and owed), then "for
 * whoever reads this" (who is in the household, whether there is a will and
 * where, who to call), then every entry, head by head, with every detail that
 * was entered and who the nominee is, then a table of nominees on its own, the
 * checks that were still open on the day it was printed, and how the figures
 * were worked out.
 *
 * Two versions: the family's copy prints identifying numbers in full, because a
 * claim needs them; the other prints the last four digits only, for showing an
 * adviser. Both say on the cover which they are.
 *
 * Set in Figtree with a face per Indian script behind it (lib/pdf/fonts), so a
 * name or an address typed in Hindi or Tamil prints as typed.
 */

const INK = '#2B211B';
const DIM = '#4A3D33';
const SUBTLE = '#67574A';
const LINE = '#E2D3BF';
const BAND = '#F6EFE4';
const ACCENT = '#9C4026';
const OWE = '#9A4C47';
const ACT = '#9C4026';
const REVIEW = '#7A5418';

/** The group colours, as printable hex (the screen's are CSS variables). */
const GROUP_HEX: Record<string, string> = {
  cash: '#008779',
  market: '#9C4026',
  retirement: '#5F6136',
  property: '#855C1F',
  gold: '#CF9A35',
  other: '#9AA36B',
  secured: '#9A4C47',
  unsecured: '#7E3426',
};

/** Typed text is never hyphenated at a script change; see the True Property Cost report. */
const UNBROKEN = { hyphenationPenalty: 10000 };

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 58, paddingHorizontal: 38, fontSize: 9, color: INK },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { fontSize: 11, fontWeight: 700 },
  brandSub: { fontSize: 7, color: SUBTLE, marginTop: 2, letterSpacing: 0.6 },
  confidential: { fontSize: 7, fontWeight: 700, color: ACCENT, letterSpacing: 0.7, borderWidth: 1, borderColor: ACCENT, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  title: { fontSize: 20, fontWeight: 700, marginTop: 18 },
  meta: { fontSize: 9, color: DIM, marginTop: 4 },
  hero: { marginTop: 14, padding: 14, backgroundColor: BAND, borderRadius: 6 },
  label: { fontSize: 7, fontWeight: 700, color: SUBTLE, letterSpacing: 0.7 },
  heroFigure: { fontSize: 24, fontWeight: 700, marginTop: 4 },
  heroLine: { fontSize: 8.5, color: DIM, marginTop: 4, lineHeight: 1.4 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 10 },
  tile: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 8, backgroundColor: '#FFFFFF' },
  tileValue: { fontSize: 11, fontWeight: 700, marginTop: 3 },
  bar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 12 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 10 },
  legend: { flexDirection: 'row', alignItems: 'center', fontSize: 7.5, color: DIM },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 20, marginBottom: 2 },
  h2Note: { fontSize: 8, color: SUBTLE, marginBottom: 8 },
  h3: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderColor: INK },
  h3Text: { fontSize: 10, fontWeight: 700 },
  h3Total: { fontSize: 9, fontWeight: 700 },
  entry: { borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 8, marginBottom: 6 },
  entryHead: { flexDirection: 'row', justifyContent: 'space-between' },
  entryName: { fontSize: 9.5, fontWeight: 700, maxWidth: '62%' },
  entryValue: { fontSize: 9.5, fontWeight: 700, textAlign: 'right' },
  entrySub: { fontSize: 7.5, color: SUBTLE, marginTop: 2 },
  kv: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  kvRow: { width: '50%', flexDirection: 'row', paddingVertical: 1.5, paddingRight: 8 },
  kvKey: { width: '44%', fontSize: 7.5, color: SUBTLE },
  kvValue: { width: '56%', fontSize: 7.5, fontWeight: 600 },
  nominee: { marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderColor: LINE, fontSize: 7.5 },
  notes: { marginTop: 5, fontSize: 7.5, color: DIM, lineHeight: 1.4 },
  para: { fontSize: 8.5, color: DIM, lineHeight: 1.45, marginBottom: 3 },
  box: { borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 10, marginTop: 4 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 5 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: LINE },
  th: { fontSize: 6.8, fontWeight: 700, color: SUBTLE, padding: 5, letterSpacing: 0.4 },
  td: { fontSize: 7.8, padding: 5 },
  finding: { flexDirection: 'row', marginBottom: 5 },
  bullet: { width: 10, fontSize: 9, fontWeight: 700 },
  foot: { position: 'absolute', bottom: 22, left: 38, right: 38, fontSize: 7, color: SUBTLE, flexDirection: 'row', justifyContent: 'space-between' },
});

export function WealthRecordDocument({
  record,
  today,
  masked,
}: {
  record: WealthRecord;
  /** ISO date the document is made on, passed in so it is a pure function of its inputs. */
  today: string;
  masked: boolean;
}) {
  registerPdfFonts();
  const sum = summarise(record);
  const findings = checks(record, today).filter((f) => f.severity !== 'note');
  const p = record.profile;
  const owner = memberName(p, 'self');
  const allText = [
    owner,
    ...p.members.map((m) => m.name),
    p.willKept,
    p.executor,
    p.trusted,
    p.emergency,
    ...record.items.flatMap((i) => [i.label, i.notes, ...Object.values(i.fields), ...i.nominee.people.flatMap((n) => [n.name, n.guardian])]),
  ];
  const fontFamily = fontStack(allText);
  const assets = HEADS.filter((h) => h.side === 'asset' && record.items.some((i) => i.head === h.id));
  const liabilities = HEADS.filter((h) => h.side === 'liability' && record.items.some((i) => i.head === h.id));
  const withNominee = record.items.filter(takesNominee);

  return (
    <Document title={`Wealth record — ${owner}`} author={BRAND.name} subject="Wealth record" creator={BRAND.name} producer={BRAND.name}>
      <Page size="A4" style={[s.page, { fontFamily }]}>
        {/* First page only: a fixed header would sit on top of the content that
            flows onto every later page. The footer carries the name instead. */}
        <View style={s.head}>
          <View style={s.brand}>
            <PdfMark size={22} />
            <View>
              <Text style={s.brandName}>{BRAND.name}</Text>
              <Text style={s.brandSub}>WEALTH TRACKER</Text>
            </View>
          </View>
          <Text style={s.confidential}>CONFIDENTIAL</Text>
        </View>

        <Text style={s.title}>Wealth record</Text>
        <Text style={s.meta} {...UNBROKEN}>
          {owner} · prepared {ddmmyyyy(today)} ·{' '}
          {masked ? 'account numbers show the last four digits only' : 'account numbers in full: keep this copy safe'}
        </Text>

        {/* ── The answer ── */}
        <View style={s.hero} wrap={false}>
          <Text style={s.label}>NET WORTH</Text>
          <Text style={s.heroFigure}>{rupees(Math.round(sum.net))}</Text>
          <Text style={s.heroLine}>
            What is owned less what is owed, counting only the household’s share of anything held jointly. The figures
            as entered, not a valuation.
          </Text>
          <View style={s.tiles}>
            {[
              ['OWNED', sum.assets],
              ['OWED', sum.liabilities],
              ['LIQUID', sum.liquid],
              ['EMIS A MONTH', sum.monthlyEmi],
            ].map(([label, v]) => (
              <View key={label as string} style={s.tile}>
                <Text style={s.label}>{label as string}</Text>
                <Text style={s.tileValue}>{rupees(Math.round(v as number))}</Text>
              </View>
            ))}
          </View>
          {sum.assets > 0 && (
            <>
              <View style={s.bar}>
                {sum.groups
                  .filter((g) => GROUPS[g.id].side === 'asset')
                  .map((g) => (
                    <View key={g.id} style={{ width: `${(g.total / sum.assets) * 100}%`, backgroundColor: GROUP_HEX[g.id] }} />
                  ))}
              </View>
              <View style={s.legendRow}>
                {sum.groups.map((g) => (
                  <View key={g.id} style={s.legend}>
                    <View style={[s.dot, { backgroundColor: GROUP_HEX[g.id] }]} />
                    <Text>
                      {GROUPS[g.id].name} {rupees(Math.round(g.total))}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* ── For whoever reads this ── */}
        <Text style={s.h2}>For whoever reads this</Text>
        <View style={s.box} wrap={false}>
          {[
            ['Household', p.members.map((m) => `${memberName(p, m.id)}${m.id === 'self' ? '' : m.relation ? ` (${m.relation.toLowerCase()})` : ''}`).join(', ')],
            ['Will', p.will === 'yes' ? 'Yes, signed' : p.will === 'drafting' ? 'Being drafted' : p.will === 'no' ? 'No will' : 'Not recorded'],
            ['Will kept at', p.willKept || '—'],
            ['Executor', p.executor || '—'],
            ['Knows about this record', p.trusted || '—'],
            ['Emergency contact', p.emergency || '—'],
          ].map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', paddingVertical: 2 }}>
              <Text style={{ width: '32%', fontSize: 8, color: SUBTLE }}>{k}</Text>
              <Text style={{ width: '68%', fontSize: 8, fontWeight: 600, fontFamily: textFont(v) ?? fontFamily }} {...UNBROKEN}>
                {v}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Entries ── */}
        {assets.length > 0 && (
          <>
            <Text style={s.h2}>What is owned</Text>
            <Text style={s.h2Note}>Each entry at its value, and at the household’s share where it is held jointly.</Text>
            {assets.map((h) => (
              <Section key={h.id} headId={h.id} record={record} masked={masked} fontFamily={fontFamily} />
            ))}
          </>
        )}
        {liabilities.length > 0 && (
          <>
            <Text style={s.h2}>What is owed</Text>
            <Text style={s.h2Note}>Outstanding amounts as entered, at the household’s share of any shared loan.</Text>
            {liabilities.map((h) => (
              <Section key={h.id} headId={h.id} record={record} masked={masked} fontFamily={fontFamily} owe />
            ))}
          </>
        )}

        {/* ── Nominees ── */}
        {withNominee.length > 0 && (
          <>
            <Text style={s.h2} minPresenceAhead={80}>
              Nominees
            </Text>
            <Text style={s.h2Note}>
              Every entry that takes a nominee. A nominee receives the money; a will decides who it finally belongs to.
            </Text>
            <View style={s.table}>
              <View style={[s.tr, { backgroundColor: BAND }]} fixed>
                <Text style={[s.th, { width: '38%' }]}>ENTRY</Text>
                <Text style={[s.th, { width: '18%' }]}>HELD BY</Text>
                <Text style={[s.th, { width: '44%' }]}>NOMINEE</Text>
              </View>
              {withNominee.map((i) => (
                <View key={i.id} style={s.tr} wrap={false}>
                  <Text style={[s.td, { width: '38%', fontFamily: textFont(itemName(i)) ?? fontFamily }]} {...UNBROKEN}>
                    {itemName(i)}
                  </Text>
                  <Text style={[s.td, { width: '18%' }]} {...UNBROKEN}>
                    {memberName(p, i.holder)}
                  </Text>
                  <Text
                    style={[s.td, { width: '44%', color: i.nominee.status === 'yes' ? INK : ACT, fontWeight: i.nominee.status === 'yes' ? 400 : 700 }]}
                    {...UNBROKEN}
                  >
                    {nomineeLine(i)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Checks ── */}
        {findings.length > 0 && (
          <>
            <Text style={s.h2} minPresenceAhead={60}>
              Still to sort out
            </Text>
            <Text style={s.h2Note}>The checks that were open on {ddmmyyyy(today)}.</Text>
            {findings.map((f) => (
              <View key={f.id} style={s.finding} wrap={false}>
                <Text style={[s.bullet, { color: f.severity === 'act' ? ACT : REVIEW }]}>•</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8.5, fontWeight: 700 }} {...UNBROKEN}>
                    {f.title}
                  </Text>
                  <Text style={[s.para, { marginTop: 1 }]}>{f.detail}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── How the figures are worked out ── */}
        <Text style={s.h2} minPresenceAhead={60}>
          How the figures are worked out
        </Text>
        {[
          'Net worth is what is owned less what is owed. Each entry counts at its value multiplied by the household’s share: a flat owned half-and-half adds half its value.',
          'An entry with no value entered adds nothing, and is listed under the checks.',
          'Term life and health policies pay out only on a claim, so they add nothing to net worth. They are listed, with their nominees, because a family needs to know about them.',
          'Liquid means it could be cash within days: bank balances, most deposits, listed shares, most mutual funds and cash at home.',
          'Values are as entered on the dates shown. Nothing is projected, converted or adjusted for tax. This is a record, not a valuation or advice.',
        ].map((t) => (
          <Text key={t} style={s.para}>
            • {t}
          </Text>
        ))}

        <View style={s.foot} fixed>
          <Text>
            {BRAND.name} · Wealth Tracker · {masked ? 'numbers masked' : 'confidential: full account numbers'}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function Section({
  headId,
  record,
  masked,
  fontFamily,
  owe = false,
}: {
  headId: Item['head'];
  record: WealthRecord;
  masked: boolean;
  fontFamily: string | string[];
  owe?: boolean;
}) {
  const spec = head(headId);
  const items = record.items.filter((i) => i.head === headId);
  const total = items.reduce((t, i) => t + counted(i), 0);
  return (
    <View>
      {items.map((i, n) => {
        const rows = detailRows(i, record, masked);
        const counts = spec.counts(i.kind);
        const name = itemName(i);
        const entry = (
          <View key={i.id} style={s.entry} wrap={false}>
            <View style={s.entryHead}>
              <Text style={[s.entryName, { fontFamily: textFont(name) ?? fontFamily }]} {...UNBROKEN}>
                {name}
              </Text>
              <Text style={[s.entryValue, owe ? { color: OWE } : {}]}>
                {!counts ? 'Not in net worth' : i.value === null ? 'No value entered' : rupees(counted(i))}
              </Text>
            </View>
            <Text style={s.entrySub} {...UNBROKEN}>
              {[
                i.kind,
                `held by ${memberName(record.profile, i.holder)}`,
                counts && i.value !== null && i.share !== 100 ? `${i.share}% of ${rupees(i.value)}` : '',
                counts && i.asOf ? `value as on ${ddmmyyyy(i.asOf)}` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {rows.length > 0 && (
              <View style={s.kv}>
                {rows.map(([k, v]) => (
                  <View key={k} style={s.kvRow}>
                    <Text style={s.kvKey}>{k}</Text>
                    <Text style={[s.kvValue, { fontFamily: textFont(v) ?? fontFamily }]} {...UNBROKEN}>
                      {v}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {takesNominee(i) && (
              <Text style={s.nominee} {...UNBROKEN}>
                <Text style={{ color: SUBTLE }}>Nominee: </Text>
                <Text style={{ fontWeight: 700, color: i.nominee.status === 'yes' ? INK : ACT }}>{nomineeLine(i)}</Text>
              </Text>
            )}
            {i.notes.trim() && (
              <Text style={[s.notes, { fontFamily: textFont(i.notes) ?? fontFamily }]} {...UNBROKEN}>
                {i.notes.trim()}
              </Text>
            )}
          </View>
        );
        // The head's title is bound to its first entry, so the two always move
        // to the next page together and a title never stands alone at a foot.
        if (n > 0) return entry;
        return (
          <View key={i.id} wrap={false}>
            <View style={s.h3}>
              <Text style={s.h3Text}>{spec.name}</Text>
              <Text style={[s.h3Total, owe ? { color: OWE } : {}]}>
                {items.some((x) => spec.counts(x.kind)) ? rupees(Math.round(total)) : 'Not in net worth'}
              </Text>
            </View>
            {entry}
          </View>
        );
      })}
    </View>
  );
}
