import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { BRAND } from '@/lib/marketing/content';
import { PdfMark } from '@/lib/brand/PdfMark';
import { fontStack, registerPdfFonts } from '@/lib/pdf/fonts';
import { contentStrings, type WillDocument } from './document';
import { GUIDE, GUIDE_CLOSING, NOT_NEEDED } from './guide';

/**
 * The will, and a guide to signing it, as PDFs.
 *
 * Two documents, never one. The will contains only the will: every page can be
 * printed, initialled and signed, and nothing in it is advice, branding or a
 * page the person must remember to leave out. The signing guide is a separate
 * file, so it can be read at the table without risk of it being signed.
 *
 * Everything the will says comes from the same `WillDocument` the screen and
 * the Word file are drawn from (lib/will/document), and a test reads this PDF
 * back and checks each piece of it is there.
 *
 * ── Why the footer says so much ─────────────────────────────────────────────
 * Every page carries the testator's name, "Page x of y", the document
 * reference (lib/will/ref) and a place to initial. A will is challenged by
 * pointing at a page that is not the one that was signed; page numbers out of
 * a total, a reference that must agree on every page and the testator's
 * initials are what make a swapped or missing page obvious.
 *
 * ── Drafts ──────────────────────────────────────────────────────────────────
 * A will that still has something to fix is printed with DRAFT across every
 * page, so it cannot be mistaken for the real thing and signed. The mark is
 * light enough that every word stays legible.
 *
 * Set in Figtree with a face per Indian script behind it (lib/pdf/fonts), so a
 * name or an address typed in Hindi or Tamil prints as typed.
 */

const INK = '#1F1812';
const DIM = '#4A3D33';
const SUBTLE = '#67574A';
const LINE = '#B9A892';
const FAINT = '#E9DFD0';
const MARK = '#E3D9CB';
const ACCENT = '#9C4026';

const UNBROKEN = { hyphenationPenalty: 10000 };

/**
 * Line height is written in points, on a `View` wrapping each page's body.
 *
 * Measured, because each of the obvious ways is wrong in react-pdf 4: a unitless
 * `lineHeight: 1.6` on a Text or a View spaces lines at 2.9 times the font size,
 * not 1.6; on the Page it is right but makes every `render` text (the "Page x of
 * y" in the footer) vanish without a word; a value in points is exact wherever it
 * is set. So the body carries `LH`, the footer sits outside the wrapper, and a
 * test reads the page numbers back.
 */
const LH = '17pt';

const s = StyleSheet.create({
  page: { paddingTop: 62, paddingBottom: 78, paddingHorizontal: 64, fontSize: 10.5, color: INK },
  title: { fontSize: 15, fontWeight: 700, textAlign: 'center', letterSpacing: 4, marginBottom: 20 },
  para: { marginBottom: 7, textAlign: 'justify' },
  h: { fontSize: 10.5, fontWeight: 700, marginTop: 12, marginBottom: 3 },
  item: { flexDirection: 'row', marginBottom: 5 },
  itemLetter: { width: 24 },
  itemText: { flex: 1, textAlign: 'justify' },
  schedHead: { fontSize: 11, fontWeight: 700, textAlign: 'center', letterSpacing: 3, marginTop: 20, marginBottom: 8 },
  th: { flexDirection: 'row', borderBottomWidth: 1, borderColor: INK, paddingBottom: 3, fontWeight: 700, fontSize: 9.5 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: LINE, paddingVertical: 5, fontSize: 9.5, lineHeight: '14pt' },
  c1: { width: '7%' },
  c2: { width: '29%', paddingRight: 8 },
  c3: { width: '46%', paddingRight: 8 },
  c4: { width: '18%' },
  kind: { fontSize: 8, color: SUBTLE },
  sig: { marginTop: 26 },
  sigLine: { width: 210, borderTopWidth: 1, borderColor: INK, marginTop: 34, paddingTop: 3, fontSize: 9.5 },
  witnesses: { flexDirection: 'row', gap: 28, marginTop: 8 },
  witness: { flex: 1, fontSize: 9.5 },
  fill: { marginTop: 4, color: DIM },
  foot: { position: 'absolute', left: 64, right: 64, bottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 0.5, borderColor: LINE, paddingTop: 6, fontSize: 8, color: SUBTLE },
  initials: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  initialsBox: { width: 46, borderBottomWidth: 0.75, borderColor: INK, height: 12 },
  watermark: { position: 'absolute', top: 300, left: 0, right: 0, textAlign: 'center', transform: 'rotate(-34deg)', color: MARK },
});

export function WillPdf({
  doc,
  draft,
  reference,
  testator,
  sample = false,
}: {
  doc: WillDocument;
  draft: boolean;
  reference: string;
  testator: string;
  /** The worked example: invented names, marked SAMPLE on every page so it is never mistaken for a will. */
  sample?: boolean;
}) {
  registerPdfFonts();
  const fontFamily = fontStack(contentStrings(doc));
  const hasSchedule = doc.schedule.length > 0;

  return (
    <Document title={`${sample ? 'Sample will' : 'Last will'} of ${testator}${draft ? ' (draft)' : ''}`} author={testator} subject="Last will" creator={BRAND.name} producer={BRAND.name}>
      <Page size="A4" style={[s.page, { fontFamily }]}>
        {(draft || sample) && (
          <View fixed style={s.watermark}>
            <Text style={{ fontSize: 96, fontWeight: 700, letterSpacing: 8, lineHeight: '96pt' }}>{sample ? 'SAMPLE' : 'DRAFT'}</Text>
            <Text style={{ fontSize: 22, fontWeight: 700, letterSpacing: 4, lineHeight: '22pt', marginTop: 6 }}>{sample ? 'INVENTED NAMES. NOT A REAL WILL' : 'NOT FOR SIGNING'}</Text>
          </View>
        )}

        <View style={{ lineHeight: LH }}>
        <Text style={s.title}>{doc.title}</Text>
        {doc.opening.map((p) => (
          <Text key={p} style={s.para} {...UNBROKEN}>
            {p}
          </Text>
        ))}

        {doc.sections.slice(0, hasSchedule ? undefined : -1).map((sec) => (
          <Clause key={sec.id} sec={sec} />
        ))}

        {hasSchedule && (
          <View>
            <Text style={s.schedHead} minPresenceAhead={80}>
              SCHEDULE
            </Text>
            <View style={s.th} wrap={false}>
              <Text style={s.c1}>No.</Text>
              <Text style={s.c2}>What</Text>
              <Text style={s.c3}>How to find it</Text>
              <Text style={s.c4}>Given</Text>
            </View>
            {doc.schedule.slice(0, -1).map((r) => (
              <Row key={r.no} r={r} />
            ))}
          </View>
        )}

        {/*
         * The last piece of the will, the signature and the witnesses stay
         * together on one page: the last Schedule row, or the last clause when
         * there is no Schedule. A signature page with no will on it is the page
         * that gets detached and attached to a different document, so it always
         * carries operative text above the signature.
         */}
        <View wrap={false}>
          {hasSchedule ? <Row r={doc.schedule[doc.schedule.length - 1]} /> : <Clause sec={doc.sections[doc.sections.length - 1]} />}
          <View style={s.sig}>
            <Text style={s.para}>{doc.signing.text}</Text>
            <Text style={s.sigLine}>{doc.signing.testator}</Text>
            <Text style={[s.para, { marginTop: 24 }]}>{doc.attestation.text}</Text>
            <View style={s.witnesses}>
              {doc.attestation.witnesses.map((w, i) => (
                <View key={i} style={s.witness}>
                  <Text style={[s.sigLine, { width: '100%', marginTop: 30 }]}>Witness {i + 1}: signature</Text>
                  <Text style={s.fill}>Name: {w.name || '______________________________'}</Text>
                  <Text style={s.fill}>Address: {w.address || '______________________________'}</Text>
                  {!w.address && <Text style={s.fill}>______________________________________</Text>}
                </View>
              ))}
            </View>
          </View>
        </View>
        </View>

        <View style={s.foot} fixed>
          <View style={s.initials}>
            <Text>Initials of {testator}</Text>
            <View style={s.initialsBox} />
          </View>
          <Text>Ref {reference}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function Row({ r }: { r: WillDocument['schedule'][number] }) {
  return (
    <View style={s.tr} wrap={false}>
      <Text style={s.c1}>{r.no}</Text>
      <View style={s.c2}>
        <Text>{r.title}</Text>
        <Text style={s.kind}>{r.kind}</Text>
      </View>
      <Text style={s.c3} {...UNBROKEN}>
        {r.description}
      </Text>
      <Text style={s.c4}>{r.ownership}</Text>
    </View>
  );
}

function Clause({ sec }: { sec: WillDocument['sections'][number] }) {
  const letter = (i: number) => `(${String.fromCharCode(97 + i)})`;
  return (
    <View>
      {/* The heading stays with the first line under it. */}
      <View wrap={false} minPresenceAhead={40}>
        <Text style={s.h}>
          {sec.number}. {sec.heading}
        </Text>
      </View>
      {sec.paragraphs.map((p) => (
        <Text key={p} style={s.para} {...UNBROKEN}>
          {p}
        </Text>
      ))}
      {sec.items.map((it, i) => (
        <View key={it} style={s.item} wrap={false}>
          <Text style={s.itemLetter}>{letter(i)}</Text>
          <Text style={s.itemText} {...UNBROKEN}>
            {it}
          </Text>
        </View>
      ))}
    </View>
  );
}

export type GuideContext = {
  testator: string;
  executor: string;
  witnesses: string[];
  reference: string;
  draft: boolean;
};

const g = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 60, paddingHorizontal: 50, fontSize: 10, color: INK },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { fontSize: 11, fontWeight: 700 },
  brandSub: { fontSize: 7, color: SUBTLE, letterSpacing: 0.6, marginTop: 2 },
  title: { fontSize: 22, fontWeight: 700, marginTop: 22, lineHeight: '28pt' },
  lead: { color: DIM, marginTop: 8, maxWidth: 440 },
  box: { marginTop: 14, padding: 12, borderWidth: 1, borderColor: FAINT, borderRadius: 6, backgroundColor: '#FBF7F0' },
  boxRow: { flexDirection: 'row', marginTop: 3 },
  boxKey: { width: 90, color: SUBTLE },
  h2: { fontSize: 12.5, fontWeight: 700, marginTop: 20, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderColor: INK },
  step: { flexDirection: 'row', marginBottom: 8 },
  n: { width: 22, fontWeight: 700, color: ACCENT },
  body: { flex: 1 },
  stepText: { fontWeight: 700 },
  detail: { color: DIM, marginTop: 2 },
  tag: { fontSize: 7, fontWeight: 700, letterSpacing: 0.6, marginTop: 3, color: SUBTLE },
  not: { marginTop: 4, color: DIM },
  foot: { position: 'absolute', left: 50, right: 50, bottom: 26, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: SUBTLE },
});

export function SigningGuidePdf({ ctx }: { ctx: GuideContext }) {
  registerPdfFonts();
  const fontFamily = fontStack([ctx.testator, ctx.executor, ...ctx.witnesses]);
  // Steps are numbered straight through the three parts; computed, not counted during render.
  const starts = GUIDE.map((_, i) => GUIDE.slice(0, i).reduce((sum, p) => sum + p.steps.length, 0));

  return (
    <Document title={`How to sign your will — ${ctx.testator}`} author={BRAND.name} subject="Signing guide" creator={BRAND.name} producer={BRAND.name}>
      <Page size="A4" style={[g.page, { fontFamily }]}>
        <View style={{ lineHeight: '15pt' }}>
        <View style={g.head}>
          <View style={g.brand}>
            <PdfMark size={30} />
            <View>
              <Text style={g.brandName}>{BRAND.name}</Text>
              <Text style={g.brandSub}>WILL MAKER</Text>
            </View>
          </View>
        </View>

        <Text style={g.title}>How to sign your will</Text>
        <Text style={g.lead}>
          Keep this beside you on the day. It is a guide, not part of the will: do not sign it, and do not attach it to the will.
        </Text>

        <View style={g.box} wrap={false}>
          <Text style={{ fontWeight: 700 }}>Your will</Text>
          <View style={g.boxRow}>
            <Text style={g.boxKey}>Made by</Text>
            <Text>{ctx.testator}</Text>
          </View>
          <View style={g.boxRow}>
            <Text style={g.boxKey}>Reference</Text>
            <Text>{ctx.reference}. Every page of the will must show this.</Text>
          </View>
          <View style={g.boxRow}>
            <Text style={g.boxKey}>Executor</Text>
            <Text>{ctx.executor || 'Not named. Tell whoever will act where the will is kept.'}</Text>
          </View>
          <View style={g.boxRow}>
            <Text style={g.boxKey}>Witnesses</Text>
            <Text>{ctx.witnesses.length > 0 ? ctx.witnesses.join(' and ') : 'Not named yet. Write their names on the will as they sign.'}</Text>
          </View>
          {ctx.draft && (
            <Text style={{ marginTop: 6, color: ACCENT, fontWeight: 700 }}>
              This is a draft: the will still has something to fix. Do not sign a draft.
            </Text>
          )}
        </View>

        {GUIDE.map((part, pi) => {
          const rows = part.steps.map((st, si) => {
            return (
              <View key={st.text} style={g.step} wrap={false}>
                <Text style={g.n}>{starts[pi] + si + 1}</Text>
                <View style={g.body}>
                  <Text style={g.stepText}>{st.text}</Text>
                  {st.detail && <Text style={g.detail}>{st.detail}</Text>}
                  <Text style={g.tag}>{st.kind === 'rule' ? `REQUIRED BY LAW${st.cite ? ` · ${st.cite.toUpperCase()}` : ''}` : 'GOOD PRACTICE'}</Text>
                </View>
              </View>
            );
          });
          return (
            <View key={part.id}>
              {/* The heading never ends a page: it travels with the step under it. */}
              <View wrap={false}>
                <Text style={g.h2}>{part.heading}</Text>
                {rows[0]}
              </View>
              {rows.slice(1)}
            </View>
          );
        })}

        <View wrap={false}>
          <Text style={g.h2}>You do not need</Text>
          {NOT_NEEDED.map((t) => (
            <Text key={t} style={g.not}>
              • {t}
            </Text>
          ))}
        </View>

        <Text style={{ marginTop: 22, fontSize: 8.5, color: SUBTLE }}>{GUIDE_CLOSING}</Text>
        </View>

        <View style={g.foot} fixed>
          <Text>
            {BRAND.name} · Will Maker · Signing guide
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
