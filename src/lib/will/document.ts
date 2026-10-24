import { todayIso } from '../wealth/model';
import { LAW } from './law';
import {
  ASSET_KIND_LABELS,
  findPerson,
  personName,
  type Person,
  type WillRecord,
} from './model';
import * as c from './clauses';

/**
 * The will as a structure: numbered clauses, a Schedule of what is given, and
 * the signature and witness blocks.
 *
 * One builder feeds everything. The screen preview, the PDF, the Word file and
 * the plain-text copy are all drawn from the same `WillDocument`, so they
 * cannot drift apart, and a test can read any of them back and compare it with
 * `plainText()` here. Nothing in this file touches the page or a font.
 *
 * It never refuses. A record that is half filled in still builds, with a blank
 * line to write on where a name or a date is missing; whether the result is
 * fit to sign is the checks' business (`checks.ts`), not this file's. A
 * preview that went blank until the form was perfect would be a worse tool.
 */

export type WillSection = {
  id: string;
  number: number;
  heading: string;
  paragraphs: string[];
  /** Lettered sub-items (a), (b)… for lists of gifts. */
  items: string[];
};

export type ScheduleRow = {
  no: number;
  kind: string;
  title: string;
  description: string;
  /** "The whole", "My 50% share", "My interest". */
  ownership: string;
};

export type WitnessLine = { name: string; address: string };

export type WillDocument = {
  title: string;
  opening: string[];
  sections: WillSection[];
  schedule: ScheduleRow[];
  signing: { text: string; testator: string };
  attestation: { text: string; witnesses: WitnessLine[] };
  /** Which version of the rules the draft was built under. */
  rulesCheckedOn: string;
};

const letter = (i: number) => `(${String.fromCharCode(97 + i)})`;

function witnessLines(r: WillRecord): WitnessLine[] {
  const named = r.witnessIds
    .map((id) => findPerson(r, id))
    .filter((p): p is Person => !!p)
    .map((p) => ({ name: personName(p), address: p.address.trim() }));
  const lines = [...named];
  // Always two lines to sign on, however many are named.
  while (lines.length < LAW.witnessesNeeded) lines.push({ name: '', address: '' });
  return lines;
}

export function buildWill(r: WillRecord, today: string = todayIso()): WillDocument {
  const ctx = { r, today };

  const built = [
    c.revocation(),
    c.family(ctx),
    c.executors(ctx),
    c.debts(ctx),
    c.gifts(ctx),
    c.residue(ctx),
    c.fallback(ctx),
    c.guardian(ctx),
    ...c.wishes(ctx),
    c.general(),
  ].filter((x): x is c.Built => x !== null);

  const sections: WillSection[] = built.map((b, i) => ({ ...b, number: i + 1 }));

  const schedule: ScheduleRow[] = r.assets.map((a, i) => ({
    no: i + 1,
    kind: ASSET_KIND_LABELS[a.kind],
    title: c.assetLabel(a),
    description: c.describeAsset(a) || c.BLANK,
    ownership: c.ownership(a),
  }));

  return {
    title: 'LAST WILL',
    opening: c.openingParagraphs(ctx),
    sections,
    schedule,
    signing: { text: c.signingText(r), testator: c.blank(r.testator.name) },
    attestation: { text: c.attestationText(r), witnesses: witnessLines(r) },
    rulesCheckedOn: LAW.rulesCheckedOn,
  };
}

/** The whole will as plain text, the form every other export is compared against. */
export function plainText(doc: WillDocument): string {
  const out: string[] = [doc.title, '', ...doc.opening.flatMap((p) => [p, ''])];
  for (const s of doc.sections) {
    out.push(`${s.number}. ${s.heading}`, ...s.paragraphs);
    s.items.forEach((it, i) => out.push(`${letter(i)} ${it}`));
    out.push('');
  }
  if (doc.schedule.length > 0) {
    out.push('SCHEDULE', '');
    for (const row of doc.schedule) {
      out.push(`${row.no}. ${row.title} (${row.kind}): ${row.description}. ${row.ownership}.`);
    }
    out.push('');
  }
  out.push(doc.signing.text, '', `Signature: ${c.BLANK}`, doc.signing.testator, '', doc.attestation.text, '');
  doc.attestation.witnesses.forEach((w, i) => {
    out.push(`Witness ${i + 1}: ${w.name || c.BLANK}`, `Address: ${w.address || c.BLANK}`, `Signature: ${c.BLANK}`, '');
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
