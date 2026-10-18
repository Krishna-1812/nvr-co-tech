import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import * as XLSX from 'xlsx';
import { WealthRecordDocument } from './report';
import { buildWealthWorkbook } from './workbook';
import { blankItem, blankRecord, type Item, type WealthRecord } from './model';

/*
 * Both files are read back the way a reader would read them: the PDF's text
 * through pdf.js (so a glyph that did not draw fails), the workbook through
 * SheetJS (so a figure that is text rather than a number fails).
 */

const TODAY = '2026-10-18';

function item(head: Item['head'], patch: Partial<Item>): Item {
  return { ...blankItem(head), asOf: '2026-10-01', ...patch };
}

function record(): WealthRecord {
  const r = blankRecord('Asha');
  r.profile.members.push({ id: 'm2', name: 'Ravi', relation: 'Spouse' });
  r.profile.will = 'yes';
  r.profile.willKept = 'With the family lawyer';
  r.items = [
    item('bank', {
      id: 'b',
      value: 340_000,
      fields: { bank: 'Canara Bank', account: '0123101012345', ifsc: 'CNRB0000123' },
      nominee: { status: 'yes', people: [{ id: 'n', name: 'रवि अय्यर', relation: 'Spouse', dob: '', share: '', guardian: '', phone: '' }] },
    }),
    item('mutual_fund', { id: 'm', label: 'Index fund', value: 1_240_000, fields: { folio: '9876543210' }, nominee: { status: 'no', people: [] } }),
    item('insurance', { id: 't', kind: 'Term life', value: null, fields: { insurer: 'LIC', cover: '10000000' }, nominee: { status: 'unsure', people: [] } }),
    item('property', { id: 'p', label: 'Home', value: 18_000_000, share: 50, fields: { address: 'Flat 4B, Jayanagar', documents: 'Locker' } }),
    item('home_loan', { id: 'l', value: 4_200_000, share: 50, fields: { lender: 'SBI', emi: '52000', endDate: '2038-04-05', linked: 'p' } }),
  ];
  return r;
}

async function pageText(pdf: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: false }).promise;
  const out: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const content = await (await doc.getPage(n)).getTextContent();
    for (const it of content.items) if ('str' in it) out.push(it.str);
  }
  return out.join(' ').replace(/\s+/g, ' ');
}

describe('WealthRecordDocument', { timeout: 30_000 }, () => {
  it('prints the answer, the household, every entry, the nominees and the open checks', async () => {
    const text = await pageText(await renderToBuffer(<WealthRecordDocument record={record()} today={TODAY} masked={false} />));
    for (const words of [
      'Wealth record',
      'NET WORTH',
      // Owned: 3,40,000 + 12,40,000 + half of 1,80,00,000 = 1,05,80,000.
      // Net: that, less half of the 42,00,000 loan.
      'NET WORTH ₹84,80,000',
      'OWNED ₹1,05,80,000',
      'OWED ₹21,00,000',
      'For whoever reads this',
      'With the family lawyer',
      'Bank accounts',
      'Canara Bank',
      '0123101012345',
      'CNRB0000123',
      'Not in net worth',
      '50% of ₹1,80,00,000',
      'For the property Home',
      'Nominees',
      'No nominee',
      'Still to sort out',
      'No nominee on Index fund',
      'How the figures are worked out',
    ]) {
      expect(text).toContain(words);
    }
    // A nominee's name typed in Devanagari is drawn, letter by letter.
    for (const ch of 'रवि') expect(text).toContain(ch);
  });

  it('hides identifying numbers in the copy for an adviser', async () => {
    const text = await pageText(await renderToBuffer(<WealthRecordDocument record={record()} today={TODAY} masked />));
    expect(text).not.toContain('0123101012345');
    expect(text).not.toContain('9876543210');
    expect(text).toContain('••••2345');
    expect(text).toContain('last four digits only');
  });
});

describe('buildWealthWorkbook', () => {
  const book = buildWealthWorkbook(record(), TODAY, XLSX);

  it('has a sheet for each part of the record', () => {
    expect(book.SheetNames).toEqual(['Summary', 'What you own', 'What you owe', 'Nominees', 'Checks', 'Method']);
  });

  it('keeps amounts as numbers and dates as dates', () => {
    const summary = book.Sheets.Summary;
    expect(summary.B4.v).toBe(8_480_000);
    expect(summary.B5.v).toBe(10_580_000);
    expect(summary.B4.t).toBe('n');
    expect(summary.B2.z).toBe('dd/mm/yyyy');

    const own = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets['What you own']);
    const home = own.find((r) => r.Entry === 'Home')!;
    expect(home['Value (₹)']).toBe(18_000_000);
    expect(home['Share (%)']).toBe(50);
    expect(home['Counted (₹)']).toBe(9_000_000);
    expect(typeof home['Value as on']).toBe('number');
    const term = own.find((r) => String(r.Entry).includes('LIC'))!;
    expect(term['Counted (₹)']).toBeUndefined();
  });

  it('lists one row per nominee, and the entries without one', () => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets.Nominees);
    expect(rows.find((r) => r.Nominee === 'रवि अय्यर')?.['Share (%)']).toBe(100);
    expect(rows.some((r) => r.Nominee === 'No nominee')).toBe(true);
  });

  it('carries the checks in words', () => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets.Checks);
    expect(rows.some((r) => r.Check === 'No nominee on Index fund' && r.Level === 'Act on this')).toBe(true);
  });
});
