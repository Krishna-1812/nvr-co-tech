import { equalPercents, setGift, setResidue } from './edit';
import { findAsset, isMinor, type Person, type Share, type WillRecord } from './model';

/**
 * The guided way through a will: one plain question at a time.
 *
 * This is only a different order and a different set of questions over the same record
 * and the same rules (checks.ts, clauses.ts). Nothing here writes a clause or decides
 * what is legal; it maps an answer such as "everything to my wife" onto the shares the
 * record already knows how to hold, and says which question is next.
 *
 * The order follows how people think about a will, not how a will is laid out: who you
 * are, who your family is, who gets everything, then (only if they want) particular
 * things for particular people, who carries it out, and who watches you sign.
 */

export type QuestionId = 'name' | 'born' | 'home' | 'family' | 'everything' | 'gifts' | 'executor' | 'guardian' | 'witnesses' | 'confirm';

/** The questions this person will be asked, in order. The guardian question exists only if a child is under 18. */
export function questionsFor(r: WillRecord, today: string): QuestionId[] {
  const hasMinor = r.people.some((p) => isMinor(p, today));
  const out: QuestionId[] = ['name', 'born', 'home', 'family', 'everything', 'gifts', 'executor'];
  if (hasMinor) out.push('guardian');
  out.push('witnesses', 'confirm');
  return out;
}

/** The questions a will cannot be made without. Everything else may be skipped and settled later. */
export const REQUIRED: readonly QuestionId[] = ['name', 'born', 'home', 'everything', 'confirm'];

const sum = (shares: Share[]) => Math.round(shares.reduce((n, s) => n + s.percent, 0) * 100) / 100;

/** Whether the residue is a complete, valid set of shares: somebody who exists, adding to 100. */
export function residueDone(r: WillRecord): boolean {
  return r.residue.length > 0 && sum(r.residue) === 100 && r.residue.every((s) => s.personId && r.people.some((p) => p.id === s.personId));
}

/** Whether a question has what the will needs from it. Optional questions are always "answered". */
export function isAnswered(id: QuestionId, r: WillRecord): boolean {
  const t = r.testator;
  switch (id) {
    case 'name':
      return t.name.trim() !== '';
    case 'born':
      return t.dob !== '' && t.religion !== '';
    case 'home':
      return t.address.trim() !== '' && t.state.trim() !== '';
    case 'everything':
      return residueDone(r);
    case 'confirm':
      return t.soundMind && t.voluntary;
    default:
      return true;
  }
}

/** Where to pick up: the first required question still open, or the last question when all are done. */
export function resumeAt(r: WillRecord, today: string): QuestionId {
  const qs = questionsFor(r, today);
  return qs.find((q) => REQUIRED.includes(q) && !isAnswered(q, r)) ?? 'confirm';
}

// ── Who gets everything ─────────────────────────────────────────────────────

export type ResiduePreset = 'spouse' | 'spouse-children' | 'children' | 'custom';

const isChild = (p: Person) => p.relation === 'Son' || p.relation === 'Daughter';
const spouseOf = (r: WillRecord) => r.people.find((p) => p.relation === 'Spouse');
const childrenOf = (r: WillRecord) => r.people.filter(isChild);

function equalShares(people: Person[]): Share[] {
  const pct = equalPercents(people.length);
  return people.map((p, i) => ({ personId: p.id, percent: pct[i], alternateId: '' }));
}

/** The ready-made answers this family allows, with the people they name. `custom` is always last. */
export function residueOptions(r: WillRecord): { id: ResiduePreset; people: Person[] }[] {
  const spouse = spouseOf(r);
  const kids = childrenOf(r);
  const out: { id: ResiduePreset; people: Person[] }[] = [];
  if (spouse) out.push({ id: 'spouse', people: [spouse] });
  if (spouse && kids.length > 0) out.push({ id: 'spouse-children', people: [spouse, ...kids] });
  if (kids.length > 0) out.push({ id: 'children', people: kids });
  out.push({ id: 'custom', people: [] });
  return out;
}

/** Sets "everything else" from a ready-made answer. `custom` leaves the shares for the person to set. */
export function applyResiduePreset(r: WillRecord, preset: ResiduePreset): WillRecord {
  if (preset === 'custom') return r;
  const opt = residueOptions(r).find((o) => o.id === preset);
  return opt ? setResidue(r, equalShares(opt.people)) : r;
}

/** Which ready-made answer the current shares are, ignoring backups; `custom` if they are something else, '' if none. */
export function currentResiduePreset(r: WillRecord): ResiduePreset | '' {
  if (r.residue.length === 0) return '';
  const key = (shares: Share[]) => shares.map((s) => `${s.personId}:${s.percent}`).sort().join('|');
  const mine = key(r.residue);
  for (const o of residueOptions(r)) {
    if (o.id !== 'custom' && key(equalShares(o.people)) === mine) return o.id;
  }
  return 'custom';
}

/** The backup for a gift to one person: who takes it if they are not alive. */
export function setSoleBackup(r: WillRecord, personId: string): WillRecord {
  return r.residue.length === 1 ? setResidue(r, [{ ...r.residue[0], alternateId: personId }]) : r;
}

// ── A particular thing for a particular person ──────────────────────────────

/** Who gets this asset if it goes to exactly one person in full; 'many' if it is split; '' if not given by name. */
export function recipientOf(r: WillRecord, assetId: string): string {
  const g = r.gifts.find((x) => x.assetId === assetId);
  if (!g || g.shares.length === 0) return '';
  return g.shares.length === 1 && g.shares[0].percent === 100 ? g.shares[0].personId : 'many';
}

/** Gives an asset in full to one person, or stops giving it by name when `personId` is blank. */
export function giveTo(r: WillRecord, assetId: string, personId: string): WillRecord {
  if (!findAsset(r, assetId)) return r;
  return setGift(r, assetId, personId ? [{ personId, percent: 100, alternateId: '' }] : []);
}
