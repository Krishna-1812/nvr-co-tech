import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import type { WillDocument } from './document';

/**
 * The will as a Word file, drawn from the same `WillDocument` as the screen and
 * the PDF.
 *
 * Why Word at all: an advocate will want to edit it, and a person may want to
 * adjust a sentence in their own words. So this is the editable copy, and it
 * says so: it carries no document reference (the reference proves a printout
 * matches what was built here, and an edited file no longer does), and a draft
 * is marked in the page header, since a diagonal watermark is not something the
 * library can draw reliably across Word versions.
 *
 * Built with the `docx` library, in the browser, only when somebody asks for
 * the file. A test unzips the result and checks every piece of the will is in
 * it, in order.
 */

const FONT = 'Times New Roman';
const SIZE = 24; // half-points: 12 pt
const SMALL = 19;
const AFTER = 140;
const LINE = 320;

const run = (text: string, o: { bold?: boolean; size?: number; color?: string; spacing?: number } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? SIZE, bold: o.bold, color: o.color, characterSpacing: o.spacing });

const body = (text: string, o: { keepNext?: boolean; before?: number } = {}) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: AFTER, before: o.before, line: LINE },
    keepNext: o.keepNext,
    keepLines: true,
    children: [run(text)],
  });

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE } as const;

const rule = new Paragraph({
  spacing: { before: 520, after: 40 },
  keepNext: true,
  border: { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } },
  children: [],
});

export async function buildDocx(
  doc: WillDocument,
  opts: { testator: string; draft: boolean; title?: string },
): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      children: [run(doc.title, { bold: true, size: 30, spacing: 80 })],
    }),
  );
  for (const p of doc.opening) children.push(body(p));

  doc.sections.forEach((s, idx) => {
    const last = idx === doc.sections.length - 1;
    // The heading stays with the line under it; the last clause stays with the
    // signature, so the signature page carries operative text.
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 60 },
        keepNext: true,
        children: [run(`${s.number}. ${s.heading}`, { bold: true })],
      }),
    );
    s.paragraphs.forEach((p, i) => children.push(body(p, { keepNext: last || (i === 0 && s.items.length > 0) })));
    s.items.forEach((it, i) =>
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: AFTER, line: LINE },
          indent: { left: 567, hanging: 567 },
          tabStops: [{ type: TabStopType.LEFT, position: 567 }],
          keepLines: true,
          children: [run(`(${String.fromCharCode(97 + i)})\t${it}`)],
        }),
      ),
    );
  });

  if (doc.schedule.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 160 },
        keepNext: true,
        children: [run('SCHEDULE', { bold: true, spacing: 60 })],
      }),
    );
    const cell = (w: number, lines: { text: string; bold?: boolean; small?: boolean }[], head = false) =>
      new TableCell({
        width: { size: w, type: WidthType.PERCENTAGE },
        borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: head ? 8 : 4, color: head ? '000000' : '999999' } },
        margins: { top: 60, bottom: 60, left: 40, right: 100 },
        children: lines.map(
          (l) => new Paragraph({ spacing: { after: 0 }, children: [run(l.text, { bold: l.bold, size: l.small ? SMALL - 2 : SMALL })] }),
        ),
      });
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: [
              cell(7, [{ text: 'No.', bold: true }], true),
              cell(29, [{ text: 'What', bold: true }], true),
              cell(46, [{ text: 'How to find it', bold: true }], true),
              cell(18, [{ text: 'Given', bold: true }], true),
            ],
          }),
          ...doc.schedule.map(
            (r) =>
              new TableRow({
                cantSplit: true,
                children: [
                  cell(7, [{ text: String(r.no) }]),
                  cell(29, [{ text: r.title }, { text: r.kind, small: true }]),
                  cell(46, [{ text: r.description }]),
                  cell(18, [{ text: r.ownership }]),
                ],
              }),
          ),
        ],
      }),
    );
  }

  // The signature and the witnesses, kept together.
  children.push(body(doc.signing.text, { before: 360, keepNext: true }));
  children.push(rule);
  children.push(new Paragraph({ spacing: { after: 280 }, keepNext: true, children: [run(doc.signing.testator, { size: SMALL })] }));
  children.push(body(doc.attestation.text, { keepNext: true }));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { ...noBorders, insideHorizontal: NONE, insideVertical: NONE },
      rows: [
        new TableRow({
          cantSplit: true,
          children: doc.attestation.witnesses.map(
            (w, i) =>
              new TableCell({
                width: { size: 100 / doc.attestation.witnesses.length, type: WidthType.PERCENTAGE },
                borders: noBorders,
                verticalAlign: VerticalAlign.TOP,
                margins: { right: 300, top: 300 },
                children: [
                  new Paragraph({
                    spacing: { before: 360, after: 40 },
                    border: { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 2 } },
                    children: [run(`Witness ${i + 1}: signature`, { size: SMALL })],
                  }),
                  new Paragraph({ spacing: { after: 40 }, children: [run(`Name: ${w.name || '______________________________'}`, { size: SMALL })] }),
                  new Paragraph({ spacing: { after: 40 }, children: [run(`Address: ${w.address || '______________________________'}`, { size: SMALL })] }),
                  ...(w.address ? [] : [new Paragraph({ children: [run('______________________________________', { size: SMALL })] })]),
                ],
              }),
          ),
        }),
      ],
    }),
  );

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: '999999', space: 6 } },
        children: [
          run(`Will of ${opts.testator}`, { size: 16, color: '555555' }),
          run('   ·   Initials ________   ·   Page ', { size: 16, color: '555555' }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '555555' }),
          run(' of ', { size: 16, color: '555555' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: '555555' }),
        ],
      }),
    ],
  });

  const file = new Document({
    title: opts.title ?? `Last will of ${opts.testator}${opts.draft ? ' (draft)' : ''}`,
    creator: opts.testator,
    description: 'Last will',
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1300, bottom: 1300, left: 1500, right: 1500 } } },
        headers: opts.draft
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [run('DRAFT. NOT FOR SIGNING.', { bold: true, color: 'B3261E', spacing: 40 })],
                  }),
                ],
              }),
            }
          : undefined,
        footers: { default: footer },
        children,
      },
    ],
  });

  return Packer.toBlob(file);
}
