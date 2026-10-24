import { todayIso } from '../wealth/model';
import { checkWill, readiness } from './checks';
import { buildWill, plainText } from './document';
import { EXAMPLE_TODAY, exampleWill } from './example';
import { findPerson, personName, type WillRecord } from './model';
import { documentRef } from './ref';

/**
 * The files Will Maker can make, all drawn in the browser.
 *
 * Imported only when somebody asks for a file, so the PDF renderer and the Word
 * library (a megabyte or more between them) are never part of the screen's own
 * load.
 *
 * ── Draft or final ──────────────────────────────────────────────────────────
 * A will with anything still to fix (an `act` finding: no residue, shares that
 * do not add up, a witness who is also a beneficiary, the two declarations not
 * ticked) is made as a DRAFT: DRAFT across every page of the PDF, a banner in
 * the Word file, and "(DRAFT)" in the file name. Nothing is refused, because a
 * person should be able to take a work in progress to their advocate, but it
 * cannot be mistaken for a will and signed. Only when nothing is left to fix
 * does the same call produce the clean copy.
 */

export type WillFileKind = 'will-pdf' | 'will-docx' | 'guide-pdf' | 'sample-pdf';

export type WillFile = { blob: Blob; name: string; draft: boolean };

/** What an export of this record would be, without making one. For the screen's buttons. */
export function exportStatus(record: WillRecord, today: string = todayIso()): { draft: boolean; reference: string; blockers: number } {
  const ready = readiness(checkWill(record, today));
  return { draft: !ready.ready, reference: documentRef(plainText(buildWill(record, today))), blockers: ready.act };
}

export async function willFile(kind: WillFileKind, record: WillRecord, today: string = todayIso()): Promise<WillFile> {
  if (kind === 'sample-pdf') {
    // The worked example, never the person's own record: invented names, marked SAMPLE on every page.
    const sample = exampleWill();
    const doc = buildWill(sample, EXAMPLE_TODAY);
    const { pdf } = await import('@react-pdf/renderer');
    const { WillPdf } = await import('./report');
    const blob = await pdf(<WillPdf doc={doc} draft={false} sample reference={documentRef(plainText(doc))} testator={sample.testator.name} />).toBlob();
    return { blob, name: 'Sample will (invented names).pdf', draft: false };
  }
  const doc = buildWill(record, today);
  const reference = documentRef(plainText(doc));
  const draft = !readiness(checkWill(record, today)).ready;
  const testator = record.testator.name.trim() || 'Unnamed';
  const who = fileBase(testator);
  const tag = draft ? ' (DRAFT)' : '';

  if (kind === 'will-docx') {
    const { buildDocx } = await import('./docx');
    const blob = await buildDocx(doc, { testator, draft });
    return { blob, name: `${who} - last will ${today}${tag}.docx`, draft };
  }

  const [{ pdf }, { WillPdf, SigningGuidePdf }] = await Promise.all([import('@react-pdf/renderer'), import('./report')]);
  if (kind === 'guide-pdf') {
    const executor = record.executorIds[0] ? personName(findPerson(record, record.executorIds[0])) : '';
    const witnesses = record.witnessIds.map((id) => findPerson(record, id)).filter((p) => !!p).map((p) => personName(p));
    const blob = await pdf(<SigningGuidePdf ctx={{ testator, executor, witnesses, reference, draft }} />).toBlob();
    return { blob, name: `${who} - how to sign your will ${today}.pdf`, draft };
  }
  const blob = await pdf(<WillPdf doc={doc} draft={draft} reference={reference} testator={testator} />).toBlob();
  return { blob, name: `${who} - last will ${today}${tag}.pdf`, draft };
}

/** Keeps every script's letters, so a Hindi name is not emptied out of a file name. */
function fileBase(name: string): string {
  const clean = name.replace(/[^\p{L}\p{M}\p{N}\- ]+/gu, '').trim();
  return clean || 'My';
}
