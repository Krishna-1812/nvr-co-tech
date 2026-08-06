/**
 * Write the sample ledgers, and a reconciliation of them, to scratch/.
 *
 * Two jobs. The first is producing a real text PDF ledger, which is the only way
 * to exercise the PDF parser end to end — the coordinate reconstruction it does
 * cannot be unit-tested against a fixture, because the fixture would have to be
 * a PDF. The second is rendering the statement itself, so the printed working
 * paper can be looked at rather than only asserted about.
 *
 *   npm run recon:sample
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { readCsv } from '../src/lib/recon/parse/sheet';
import { parseRowsToLedger } from '../src/lib/recon/parse/rows';
import { reconcile } from '../src/lib/recon/reconciler';
import { SAMPLE_LEDGERS } from '../src/lib/recon/samples';
import { buildReconXlsx } from '../src/lib/recon/export/workbook';
import { ReconDocument } from '../src/lib/recon/export/ReconDocument';

const OUT = join(process.cwd(), 'scratch');
mkdirSync(OUT, { recursive: true });

/**
 * A ledger printed as a borderless table.
 *
 * Deliberately no rules and no cell borders, because that is the hard case and
 * the one every bank statement is: the columns exist only as x coordinates, and
 * the parser has to rebuild them from where the words landed.
 */
const s = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9 },
  title: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  balance: { fontSize: 9, marginBottom: 14 },
  row: { flexDirection: 'row', marginBottom: 7 },
  head: { fontFamily: 'Helvetica-Bold', marginBottom: 9 },
  date: { width: 78 },
  what: { width: 190 },
  ref: { width: 78 },
  amount: { width: 78, textAlign: 'right' },
});

function LedgerPdf({ rows, title }: { rows: string[][]; title: string }) {
  const [opening, header, ...body] = rows;
  const closing = body[body.length - 1];
  const lines = body.slice(0, -1);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.balance}>{opening[0]}</Text>

        <View style={[s.row, s.head]}>
          <Text style={s.date}>{header[0]}</Text>
          <Text style={s.what}>{header[1]}</Text>
          <Text style={s.ref}>{header[2]}</Text>
          <Text style={s.amount}>{header[3]}</Text>
          <Text style={s.amount}>{header[4]}</Text>
        </View>

        {lines.map((row, i) => (
          <View key={i} style={s.row}>
            <Text style={s.date}>{row[0]}</Text>
            <Text style={s.what}>{row[1]}</Text>
            <Text style={s.ref}>{row[2]}</Text>
            <Text style={s.amount}>{row[3]}</Text>
            <Text style={s.amount}>{row[4]}</Text>
          </View>
        ))}

        <Text style={{ marginTop: 12 }}>{closing[0]}</Text>
      </Page>
    </Document>
  );
}

const parsed = SAMPLE_LEDGERS.map((sample) => {
  const { rows, text } = readCsv(sample.csv);
  return {
    sample,
    rows,
    ledger: parseRowsToLedger(rows, text, { name: sample.label, filename: sample.filename }),
  };
});

for (const { sample, rows } of parsed) {
  writeFileSync(join(OUT, sample.filename), sample.csv, 'utf8');
  const pdf = await renderToBuffer(<LedgerPdf rows={rows} title={sample.label} />);
  writeFileSync(join(OUT, sample.filename.replace('.csv', '.pdf')), pdf);
}

const result = reconcile(parsed[0].ledger, parsed[1].ledger, {
  reconciliationDate: '2026-04-30',
  startingLedger: 'A',
});

writeFileSync(
  join(OUT, 'reconciliation.pdf'),
  await renderToBuffer(<ReconDocument result={result} preparedBy="Sample User" />),
);
writeFileSync(join(OUT, 'reconciliation.xlsx'), buildReconXlsx(result, 'Sample User'));

console.log(`Wrote to ${OUT}`);
console.log(`  ${result.statement.status}, variance ${result.statement.variance}`);
console.log(`  ${result.differences.length} differences, ${result.matched.length} matched`);
