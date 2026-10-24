import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { unzipSync, strFromU8 } from 'fflate';
import { buildDocx } from './docx';
import { buildWill, contentStrings, plainText, type WillDocument } from './document';
import { EXAMPLE_TODAY, exampleWill } from './example';
import { exportStatus, willFile } from './exports';
import { GUIDE } from './guide';
import { blankPerson, blankWill, type WillRecord } from './model';
import { documentRef } from './ref';
import { SigningGuidePdf, WillPdf } from './report';
import { setPerson } from './edit';

/*
 * Every file is read back the way a reader would read it, and checked against
 * the one list of what the will says (`contentStrings`): the PDF's text through
 * pdf.js, so a glyph that did not draw fails; the Word file by unzipping it, so
 * a clause that went missing fails here and not at a signing.
 */

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

async function pdfPages(buf: Buffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(norm(content.items.map((it) => ('str' in it ? it.str : '')).join(' ')));
  }
  return pages;
}

/** The text of a .docx: its paragraphs' runs, in order, one string per paragraph. */
function docxParagraphs(bytes: Uint8Array, part = 'word/document.xml'): string[] {
  const xml = strFromU8(unzipSync(bytes)[part]);
  const decode = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  return [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) =>
    norm(
      decode(
        [...m[0].matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>/g)].map((t) => (t[1] === undefined ? '\t' : t[1])).join(''),
      ),
    ),
  );
}

/**
 * The first of `needles` that is missing or out of order, or null. `squash`
 * ignores all spacing: the title and the "SCHEDULE" heading are letter-spaced,
 * so the text layer reads them as "L A S T  W I L L".
 */
function inOrder(haystack: string, needles: string[], squash = false): string | null {
  const f = squash ? (t: string) => t.replace(/\s+/g, '') : norm;
  const h = f(haystack);
  let at = 0;
  for (const n of needles) {
    const i = h.indexOf(f(n), at);
    if (i < 0) return n;
    at = i + f(n).length;
  }
  return null;
}

/** The strings that must read in order; the schedule's cells and the witness blocks are checked for presence only. */
function ordered(doc: WillDocument): string[] {
  const all = contentStrings(doc);
  return all.slice(0, all.indexOf(doc.schedule.length ? 'SCHEDULE' : doc.signing.text));
}

const doc = buildWill(exampleWill(), EXAMPLE_TODAY);
const ref = documentRef(plainText(doc));

describe('the will PDF', { timeout: 60_000 }, () => {
  it('contains every clause, in order, every schedule row and both witness blocks', async () => {
    const pages = await pdfPages(await renderToBuffer(<WillPdf doc={doc} draft={false} reference={ref} testator="Rohan Mehta" />));
    const text = pages.join(' ');
    expect(inOrder(text, ordered(doc), true)).toBeNull();
    for (const row of doc.schedule) {
      for (const cell of [row.title, row.kind, row.description, row.ownership]) expect(text, cell).toContain(norm(cell));
    }
    for (const w of doc.attestation.witnesses) {
      expect(text).toContain(w.name);
      expect(text).toContain(w.address);
    }
    expect(text).toContain(norm(doc.signing.text));
    expect(text).toContain(norm(doc.attestation.text));
  });

  it('numbers every page out of the total, with the reference and an initials line, so a swapped page shows', async () => {
    const pages = await pdfPages(await renderToBuffer(<WillPdf doc={doc} draft={false} reference={ref} testator="Rohan Mehta" />));
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((p, i) => {
      expect(p, `page ${i + 1}`).toContain(`Page ${i + 1} of ${pages.length}`);
      expect(p).toContain(`Ref ${ref}`);
      expect(p).toContain('Initials of Rohan Mehta');
    });
  });

  it('never leaves a signature on a page with no will above it', async () => {
    const pages = await pdfPages(await renderToBuffer(<WillPdf doc={doc} draft={false} reference={ref} testator="Rohan Mehta" />));
    const last = pages[pages.length - 1];
    expect(last).toContain(norm(doc.signing.text));
    // Operative text sits above the signature on the same page: the last schedule row.
    const lastRow = doc.schedule[doc.schedule.length - 1];
    expect(last.indexOf(lastRow.title)).toBeGreaterThanOrEqual(0);
    expect(last.indexOf(lastRow.title)).toBeLessThan(last.indexOf(norm(doc.signing.text)));
  });

  it('is marked DRAFT on every page when it is a draft, and not otherwise', async () => {
    const draft = await pdfPages(await renderToBuffer(<WillPdf doc={doc} draft reference={ref} testator="Rohan Mehta" />));
    // The mark is letter-spaced, so the text layer reads it as "D R A F T".
    draft.forEach((p, i) => expect(p, `page ${i + 1}`).toMatch(/D\s*R\s*A\s*F\s*T/));
    const final = await pdfPages(await renderToBuffer(<WillPdf doc={doc} draft={false} reference={ref} testator="Rohan Mehta" />));
    final.forEach((p) => expect(p).not.toMatch(/D\s*R\s*A\s*F\s*T/));
  });

  it('prints a name in Devanagari, in the will and in the footer', async () => {
    // pdf.js reports text in visual order, so a vowel sign drawn before its consonant
    // (ि) reads reversed. These names avoid it, so the comparison is exact.
    const r: WillRecord = structuredClone(exampleWill());
    r.people = r.people.map((p) => (p.id === 'nisha' ? { ...p, name: 'रमा मेहता' } : p));
    const d = buildWill(r, EXAMPLE_TODAY);
    const text = (await pdfPages(await renderToBuffer(<WillPdf doc={d} draft={false} reference="X" testator="सुमन कपूर" />))).join(' ');
    expect(text).toContain('रमा मेहता');
    expect(text).toContain('Initials of सुमन कपूर');
  });

  it('builds from an unfinished record, with blank lines to write on', async () => {
    const d = buildWill(blankWill(), EXAMPLE_TODAY);
    const text = (await pdfPages(await renderToBuffer(<WillPdf doc={d} draft reference="X" testator="Unnamed" />))).join(' ');
    expect(text).toContain('Witness 2');
  });
});

describe('the Word file', { timeout: 60_000 }, () => {
  it('contains every clause in order, every schedule cell and both witness blocks', async () => {
    const blob = await buildDocx(doc, { testator: 'Rohan Mehta', draft: false });
    const paras = docxParagraphs(new Uint8Array(await blob.arrayBuffer()));
    const text = paras.join('\n');
    expect(inOrder(text, ordered(doc).map((s) => s))).toBeNull();
    for (const row of doc.schedule) for (const cell of [row.title, row.kind, row.description, row.ownership]) expect(text, cell).toContain(norm(cell));
    for (const w of doc.attestation.witnesses) expect(text).toContain(w.name);
    expect(text).toContain(norm(doc.signing.text));
    expect(text).toContain(norm(doc.attestation.text));
  });

  it('letters the gifts (a), (b), (c) as the PDF does', async () => {
    const paras = docxParagraphs(new Uint8Array(await (await buildDocx(doc, { testator: 'Rohan Mehta', draft: false })).arrayBuffer()));
    expect(paras.filter((p) => /^\([a-c]\) /.test(p))).toHaveLength(3);
  });

  it('carries "Page x of y" and the testator in the footer, and a banner in the header only for a draft', async () => {
    const draft = new Uint8Array(await (await buildDocx(doc, { testator: 'Rohan Mehta', draft: true })).arrayBuffer());
    const final = new Uint8Array(await (await buildDocx(doc, { testator: 'Rohan Mehta', draft: false })).arrayBuffer());
    const footerXml = strFromU8(unzipSync(final)['word/footer1.xml']);
    expect(footerXml).toContain('Will of Rohan Mehta');
    expect(footerXml).toContain('PAGE');
    expect(footerXml).toContain('NUMPAGES');
    expect(docxParagraphs(draft, 'word/header1.xml').join(' ')).toContain('DRAFT. NOT FOR SIGNING.');
    expect(Object.keys(unzipSync(final)).some((k) => k.includes('header'))).toBe(false);
  });

  it('prints Devanagari as typed', async () => {
    const r: WillRecord = structuredClone(exampleWill());
    r.people = r.people.map((p) => (p.id === 'nisha' ? { ...p, name: 'निशा मेहता' } : p));
    const paras = docxParagraphs(new Uint8Array(await (await buildDocx(buildWill(r, EXAMPLE_TODAY), { testator: 'रोहन', draft: false })).arrayBuffer()));
    expect(paras.join('\n')).toContain('निशा मेहता');
  });
});

describe('the signing guide', { timeout: 60_000 }, () => {
  const ctx = { testator: 'Rohan Mehta', executor: 'Nisha Mehta', witnesses: ['Dev Kulkarni', 'Smita Joshi'], reference: ref, draft: false };

  it('says who made the will, its reference, who the executor and witnesses are, and every step', async () => {
    const text = (await pdfPages(await renderToBuffer(<SigningGuidePdf ctx={ctx} />))).join(' ');
    for (const s of ['Rohan Mehta', ref, 'Nisha Mehta', 'Dev Kulkarni and Smita Joshi']) expect(text).toContain(s);
    for (const part of GUIDE) {
      expect(text).toContain(part.heading);
      for (const st of part.steps) expect(text, st.text).toContain(norm(st.text));
    }
    expect(text).not.toContain('Do not sign a draft');
  });

  it('tells a person not to sign when the will is still a draft, and asks for witnesses when none are named', async () => {
    const text = (await pdfPages(await renderToBuffer(<SigningGuidePdf ctx={{ ...ctx, draft: true, executor: '', witnesses: [] }} />))).join(' ');
    expect(text).toContain('Do not sign a draft');
    expect(text).toContain('Not named yet');
    expect(text).toContain('Not named.');
  });

  it('states which steps the law requires and gives the section, and which are only good practice', async () => {
    const text = (await pdfPages(await renderToBuffer(<SigningGuidePdf ctx={ctx} />))).join(' ');
    expect(text).toContain('REQUIRED BY LAW');
    expect(text).toContain('GOOD PRACTICE');
    expect(text).toContain('S.67');
  });
});

describe('the sample will', { timeout: 60_000 }, () => {
  it('is the worked example, marked SAMPLE on every page, and is never the person’s own record', async () => {
    const mine = blankWill('Somebody Else');
    const f = await willFile('sample-pdf', mine, EXAMPLE_TODAY);
    expect(f.name).toBe('Sample will (invented names).pdf');
    const pages = await pdfPages(Buffer.from(await f.blob.arrayBuffer()));
    pages.forEach((p, i) => {
      expect(p, `page ${i + 1}`).toMatch(/S\s*A\s*M\s*P\s*L\s*E/);
      expect(p.replace(/\s+/g, '')).toContain('INVENTEDNAMES.NOTAREALWILL');
    });
    const text = pages.join(' ');
    expect(text).toContain('Rohan Mehta');
    expect(text).not.toContain('Somebody Else');
  });
});

describe('the document reference', () => {
  it('is the same for the same will and changes when anything in it changes', () => {
    expect(documentRef(plainText(doc))).toBe(documentRef(plainText(buildWill(exampleWill(), EXAMPLE_TODAY))));
    const r = structuredClone(exampleWill());
    r.gifts[0].shares[0].alternateId = 'kavita';
    expect(documentRef(plainText(buildWill(r, EXAMPLE_TODAY)))).not.toBe(ref);
    expect(ref).toMatch(/^[0-9A-Z]{6}$/);
  });
});

describe('willFile', { timeout: 60_000 }, () => {
  it('makes a clean copy of a will with nothing to fix, named for the person and the day', async () => {
    const f = await willFile('will-pdf', exampleWill(), EXAMPLE_TODAY);
    expect(f.draft).toBe(false);
    expect(f.name).toBe('Rohan Mehta - last will 2026-10-24.pdf');
    expect(f.blob.type).toBe('application/pdf');
    expect(exportStatus(exampleWill(), EXAMPLE_TODAY)).toMatchObject({ draft: false, blockers: 0, reference: ref });
  });

  it('makes a DRAFT, in the name and the pages, while anything stops the will, and does not refuse', async () => {
    const r = structuredClone(exampleWill());
    r.gifts[0].shares[0].percent = 40; // a gift that adds up to 40
    const f = await willFile('will-pdf', r, EXAMPLE_TODAY);
    expect(f.draft).toBe(true);
    expect(f.name).toBe('Rohan Mehta - last will 2026-10-24 (DRAFT).pdf');
    const pages = await pdfPages(Buffer.from(await f.blob.arrayBuffer()));
    pages.forEach((p) => expect(p).toContain('DRAFT'));
    expect(exportStatus(r, EXAMPLE_TODAY).blockers).toBeGreaterThan(0);
  });

  it('treats an unticked declaration as a draft', async () => {
    const r = structuredClone(exampleWill());
    r.testator.soundMind = false;
    expect((await willFile('will-pdf', r, EXAMPLE_TODAY)).draft).toBe(true);
  });

  it('makes the Word file and the guide, keeping a Hindi name in the file name', async () => {
    const r = setPerson(structuredClone(exampleWill()), { ...blankPerson('Friend'), id: 'z', name: 'Zubin' });
    r.testator.name = 'रोहन मेहता';
    expect((await willFile('will-docx', r, EXAMPLE_TODAY)).name).toBe('रोहन मेहता - last will 2026-10-24.docx');
    expect((await willFile('guide-pdf', r, EXAMPLE_TODAY)).name).toBe('रोहन मेहता - how to sign your will 2026-10-24.pdf');
  });

  it('leaves the record alone', async () => {
    const r = exampleWill();
    const before = JSON.stringify(r);
    await willFile('will-docx', r, EXAMPLE_TODAY);
    expect(JSON.stringify(r)).toBe(before);
  });
});
