import { head, type HeadId } from '../wealth/heads';
import { SELF, type Item, type WealthRecord } from '../wealth/model';
import {
  ASSET_KIND_LABELS,
  blankAsset,
  nameKey,
  RELATIONS,
  type Asset,
  type AssetKind,
  type Person,
  type Relation,
  type WillRecord,
} from './model';

/**
 * Starting a will from a Wealth Tracker record.
 *
 * This is the reason to build the will here and not as a separate site: a
 * person who has already told us what they own, where, and who the nominees
 * are should not type it a second time. Every other will service starts from a
 * blank page and an hour of typing.
 *
 * What it takes, and what it leaves:
 *
 *   - **Assets only.** Loans stay in Wealth Tracker; a will gives what a person
 *     owns. The count of loans left behind is returned so the screen can say so.
 *   - **Identifiers keep their last four digits in the will**, not the whole
 *     number, unless the person turns that on for an asset (`fullIdentifier`).
 *   - **Nominees come across as text on the asset** and as people on the list,
 *     so the check that compares a nominee with who the will gives the asset to
 *     has something to compare.
 *   - **Repeatable.** An imported asset's id is derived from the entry's id, so
 *     importing twice adds only what is new and never doubles up or overwrites
 *     what the person has already changed.
 *
 * Nothing is deleted from the will record and nothing is written back to
 * Wealth Tracker.
 */

const KIND_OF_HEAD: Partial<Record<HeadId, AssetKind>> = {
  bank: 'bank',
  deposit: 'deposit',
  demat: 'investment',
  mutual_fund: 'investment',
  bonds: 'investment',
  retirement: 'retirement',
  insurance: 'insurance',
  property: 'property',
  gold: 'jewellery',
  vehicle: 'vehicle',
  business: 'business',
  receivable: 'receivable',
  other_asset: 'other',
};

/** Lines of an address as one line, without doubling a comma the person already typed. */
const oneLine = (s: string) =>
  s
    .split(/[\r\n]+/)
    .map((l) => l.trim().replace(/[,\s]+$/, ''))
    .filter(Boolean)
    .join(', ');
const joinParts = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(', ');

/** What to call an entry in a sentence, from its head and kind: "savings account", "mutual fund folio". */
function noun(item: Item): string {
  const kind = item.kind.toLowerCase();
  switch (item.head) {
    case 'bank':
      return `${kind} account`;
    case 'mutual_fund':
      return 'mutual fund folio';
    case 'insurance':
      return 'insurance policy';
    case 'retirement':
    case 'demat':
    case 'deposit':
      return kind;
    default:
      return ASSET_KIND_LABELS[KIND_OF_HEAD[item.head] ?? 'other'].toLowerCase();
  }
}

/** A Wealth Tracker relation, said in the will's list of relations. */
export function relationOf(text: string): Relation {
  const t = text.trim().toLowerCase();
  if (t === 'wife' || t === 'husband' || t === 'partner') return 'Spouse';
  const hit = RELATIONS.find((r) => r.toLowerCase() === t);
  return hit ?? 'Other';
}

export const assetId = (itemId: string) => `w-${itemId}`;

function assetFrom(item: Item): Asset | null {
  const spec = head(item.head);
  if (spec.side !== 'asset') return null;
  const kind = KIND_OF_HEAD[item.head];
  if (!kind) return null;
  const f = item.fields;
  const a = blankAsset(kind);

  a.id = assetId(item.id);
  a.source = 'wealth';
  a.sourceId = item.id;
  a.percent = item.share;
  a.identifier = spec.number ? (f[spec.number] ?? '').trim() : '';
  a.nominee = {
    status: item.nominee.status,
    names: item.nominee.people.map((p) => p.name.trim()).filter(Boolean),
  };

  if (item.head === 'property') {
    a.title = item.label.trim() || item.kind;
    a.location = oneLine(joinParts(f.address, f.city, f.state, f.pin));
    a.details = joinParts(
      f.area && `area ${f.area.trim()}`,
      f.surveyNo && `survey or plot no. ${f.surveyNo.trim()}`,
      f.deedNo && `sale deed no. ${f.deedNo.trim()}`,
    );
    a.coOwners = (f.coOwners ?? '').trim();
    a.holding = a.coOwners ? 'joint' : 'sole';
    return a;
  }

  a.institution = (f[spec.who] ?? '').trim();
  a.title = item.label.trim() || (a.institution ? `${a.institution} ${noun(item)}` : '');
  if (item.head === 'bank') a.location = (f.branch ?? '').trim();
  // The kind says more than the title does for a mutual fund ("Equity") or a
  // deposit, and nothing for a bank account, whose kind is already in the title.
  if (item.head !== 'bank' && item.kind && item.kind !== 'Other') a.details = item.kind;
  if (f.holding === 'Joint') {
    a.holding = 'joint';
    a.coOwners = (f.jointHolders ?? '').trim();
  }
  return a;
}

export type WealthImport = {
  assets: Asset[];
  people: Person[];
  /** What the household record says about an executor, as typed. For the screen to offer. */
  executorHint: string;
  /** The name Wealth Tracker has for the person themselves. */
  selfName: string;
  /** Loans and cards left in Wealth Tracker. */
  liabilitiesLeft: number;
};

/** What Wealth Tracker has that a will could use, without touching either record. */
export function fromWealth(w: WealthRecord): WealthImport {
  const assets = w.items.map(assetFrom).filter((a): a is Asset => a !== null);
  const liabilitiesLeft = w.items.filter((i) => head(i.head).side === 'liability').length;

  const people: Person[] = [];
  const seen = new Set<string>();
  const add = (name: string, relation: Relation, id: string, dob = '') => {
    const k = nameKey(name);
    if (!k || seen.has(k)) return;
    seen.add(k);
    people.push({ id, name: name.trim(), relation, dob, address: '' });
  };
  for (const m of w.profile.members) {
    if (m.id !== SELF) add(m.name, relationOf(m.relation), `w-m-${m.id}`);
  }
  for (const item of w.items) {
    for (const n of item.nominee.people) add(n.name, relationOf(n.relation), `w-n-${n.id}`, n.dob);
  }

  const self = w.profile.members.find((m) => m.id === SELF);
  return {
    assets,
    people,
    executorHint: w.profile.executor.trim(),
    selfName: self?.name.trim() ?? '',
    liabilitiesLeft,
  };
}

/**
 * Adds what is new from Wealth Tracker to a will, leaving everything already
 * in it exactly as the person left it. A person already on the list (same
 * name) is not added again; an asset already imported is not imported again.
 */
export function importFromWealth(
  will: WillRecord,
  w: WealthRecord,
): { record: WillRecord; added: { assets: number; people: number }; liabilitiesLeft: number } {
  const imp = fromWealth(w);
  const haveAssets = new Set(will.assets.map((a) => a.id));
  const havePeople = new Set(will.people.map((p) => nameKey(p.name)).filter(Boolean));

  const newAssets = imp.assets.filter((a) => !haveAssets.has(a.id));
  const newPeople = imp.people.filter((p) => !havePeople.has(nameKey(p.name)));

  const record: WillRecord = {
    ...will,
    testator: { ...will.testator, name: will.testator.name.trim() || imp.selfName },
    assets: [...will.assets, ...newAssets],
    people: [...will.people, ...newPeople],
    updatedAt: new Date().toISOString(),
  };
  return { record, added: { assets: newAssets.length, people: newPeople.length }, liabilitiesLeft: imp.liabilitiesLeft };
}
