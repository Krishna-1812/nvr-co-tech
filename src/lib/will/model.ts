import { newId, todayIso } from '../wealth/model';
import { ageOn, CIRCUMSTANCES, RELIGIONS, type Circumstance, type Religion } from './law';

/**
 * The shape of a will record, and how to read one back without trusting it.
 *
 * A record is everything the interview collects and nothing the will does not
 * need: who is making it, the people it names, the things it gives, who gets
 * what, and who carries it out. It is NOT the will. The will is built from it
 * by `document.ts`, the same way every time, so the same record always reads
 * the same and nothing a person types is ever used as a clause.
 *
 * People are listed once and referred to by id, everywhere: a beneficiary, an
 * executor, a guardian and a witness are all `Person`s picked from one list.
 * That is what lets a check say "your witness is also getting a gift" without
 * guessing from spelling.
 *
 * Read back defensively, as Wealth Tracker's record is: the data comes from
 * localStorage or from a backup somebody may have opened in a text editor, and
 * a record with a field missing should still load, with the field empty,
 * rather than take the screen down or silently drop a person's work.
 *
 * Field names are stored in people's records and backups. Never rename one; add
 * a new one and leave the old.
 */

export const RELATIONS = [
  'Spouse',
  'Son',
  'Daughter',
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Grandchild',
  'Other relative',
  'Friend',
  'Professional',
  'Other',
] as const;
export type Relation = (typeof RELATIONS)[number];

export const KIN = ['son', 'daughter', 'wife', 'husband'] as const;
export type KinRelation = (typeof KIN)[number] | '';

export const MARITAL = ['single', 'married', 'widowed', 'divorced'] as const;
export type MaritalStatus = (typeof MARITAL)[number] | '';

export type Testator = {
  name: string;
  /** "son of", "wife of": how an Indian will introduces the person. */
  kinRelation: KinRelation;
  kinName: string;
  /** ISO date. */
  dob: string;
  religion: Religion;
  maritalStatus: MaritalStatus;
  occupation: string;
  address: string;
  /** The state the person lives in. Goa is out of scope (law.ts). */
  state: string;
  /** Lives outside India but owns assets here. Allowed; noted on the draft. */
  residesAbroad: boolean;
  /** "I am of sound mind." Ticked by the person, never assumed. */
  soundMind: boolean;
  /** "Nobody is pressing me." Ticked by the person, never assumed. */
  voluntary: boolean;
  circumstances: Circumstance[];
};

export type Person = {
  id: string;
  name: string;
  relation: Relation;
  /** ISO date. Tells a minor beneficiary, who needs a guardian named. */
  dob: string;
  address: string;
};

export const ASSET_KINDS = [
  'property',
  'bank',
  'deposit',
  'investment',
  'retirement',
  'insurance',
  'vehicle',
  'jewellery',
  'business',
  'receivable',
  'other',
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  property: 'Property',
  bank: 'Bank account',
  deposit: 'Deposit',
  investment: 'Shares, funds and bonds',
  retirement: 'Provident fund, PPF and pension',
  insurance: 'Insurance policy',
  vehicle: 'Vehicle',
  jewellery: 'Gold, silver and jewellery',
  business: 'Business interest',
  receivable: 'Money owed to me',
  other: 'Other asset',
};

export type Holding = 'sole' | 'joint';

export type NomineeStatus = 'yes' | 'no' | 'unsure' | '';

export type Asset = {
  id: string;
  kind: AssetKind;
  /** The person's own name for it: "my SBI savings". Blank means use the kind. */
  title: string;
  /** The bank, insurer, fund house, broker. */
  institution: string;
  /** Account, policy, folio or registration number, as typed. */
  identifier: string;
  /**
   * Whether the will prints the whole identifier. Off by default: a will is
   * read by a lot of people, and the last four digits plus the institution
   * find the asset. Turned on per asset by the person.
   */
  fullIdentifier: boolean;
  /** Address or branch. For property, the address as in the sale deed. */
  location: string;
  /** Anything else that pins it down: area, survey number, registration. */
  details: string;
  holding: Holding;
  coOwners: string;
  /** Per cent of the asset that is the testator's own. */
  percent: number;
  nominee: { status: NomineeStatus; names: string[] };
  /** Where this came from, so an import can be repeated without doubling up. */
  source: 'typed' | 'wealth';
  sourceId: string;
};

/** A beneficiary's slice, and who takes it if they do not survive. */
export type Share = {
  personId: string;
  /** Per cent of the gift (or of the residue). */
  percent: number;
  /** Blank means no alternate: the share then falls into the residue. */
  alternateId: string;
};

export type Gift = { id: string; assetId: string; shares: Share[] };

export type Extras = {
  funeral: string;
  digital: string;
  pets: string;
  /** Pay debts and funeral costs out of the residue before it is shared. */
  payDebts: boolean;
};

export type WillRecord = {
  version: 1;
  testator: Testator;
  people: Person[];
  assets: Asset[];
  gifts: Gift[];
  /** Who gets everything not given by name. Percentages sum to 100. */
  residue: Share[];
  /** In order: the first acts; the next takes over if they cannot. */
  executorIds: string[];
  /** In order, as for executors. For children who are minors at the death. */
  guardianIds: string[];
  witnessIds: string[];
  extras: Extras;
  signing: { place: string; date: string };
  updatedAt: string;
};

export function blankTestator(name = ''): Testator {
  return {
    name,
    kinRelation: '',
    kinName: '',
    dob: '',
    religion: '',
    maritalStatus: '',
    occupation: '',
    address: '',
    state: '',
    residesAbroad: false,
    soundMind: false,
    voluntary: false,
    circumstances: [],
  };
}

export function blankWill(name = ''): WillRecord {
  return {
    version: 1,
    testator: blankTestator(name),
    people: [],
    assets: [],
    gifts: [],
    residue: [],
    executorIds: [],
    guardianIds: [],
    witnessIds: [],
    extras: { funeral: '', digital: '', pets: '', payDebts: true },
    signing: { place: '', date: '' },
    updatedAt: new Date().toISOString(),
  };
}

export function blankPerson(relation: Relation = 'Other'): Person {
  return { id: newId(), name: '', relation, dob: '', address: '' };
}

export function blankAsset(kind: AssetKind = 'other'): Asset {
  return {
    id: newId(),
    kind,
    title: '',
    institution: '',
    identifier: '',
    fullIdentifier: false,
    location: '',
    details: '',
    holding: 'sole',
    coOwners: '',
    percent: 100,
    nominee: { status: '', names: [] },
    source: 'typed',
    sourceId: '',
  };
}

export function blankShare(personId = ''): Share {
  return { personId, percent: 100, alternateId: '' };
}

// ── Looking people and things up ───────────────────────────────────────────

export const findPerson = (r: WillRecord, id: string) => r.people.find((p) => p.id === id);
export const findAsset = (r: WillRecord, id: string) => r.assets.find((a) => a.id === id);

/** A person's name, or what to call them when it has not been typed yet. */
export function personName(p: Person | undefined): string {
  if (!p) return 'Someone removed from the list';
  return p.name.trim() || (p.relation === 'Other' ? 'Unnamed person' : `Unnamed ${p.relation.toLowerCase()}`);
}

/** Under 18 on the given day. Unknown date of birth is not treated as a minor. */
export function isMinor(p: Person, today: string = todayIso()): boolean {
  const age = ageOn(p.dob, today);
  return age !== null && age < 18;
}

/** Lower-cased, single-spaced, for comparing a nominee typed as text with a person. */
export const nameKey = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

// ── Reading back ───────────────────────────────────────────────────────────

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);
const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
const strings = (v: unknown): string[] => list(v).filter((x): x is string => typeof x === 'string');

const percent = (v: unknown, fallback: number): number => {
  const n = finite(v);
  return n !== null && n >= 0 && n <= 100 ? n : fallback;
};

function readPerson(raw: unknown): Person | null {
  const o = obj(raw);
  const id = str(o.id);
  if (!id) return null;
  return {
    id,
    name: str(o.name),
    relation: oneOf(o.relation, RELATIONS, 'Other'),
    dob: str(o.dob),
    address: str(o.address),
  };
}

function readAsset(raw: unknown): Asset | null {
  const o = obj(raw);
  const id = str(o.id);
  if (!id) return null;
  const nominee = obj(o.nominee);
  return {
    id,
    kind: oneOf(o.kind, ASSET_KINDS, 'other'),
    title: str(o.title),
    institution: str(o.institution),
    identifier: str(o.identifier),
    fullIdentifier: bool(o.fullIdentifier),
    location: str(o.location),
    details: str(o.details),
    holding: oneOf(o.holding, ['sole', 'joint'] as const, 'sole'),
    coOwners: str(o.coOwners),
    // Zero is not a share anybody owns; treat it as unreadable.
    percent: percent(o.percent, 100) > 0 ? percent(o.percent, 100) : 100,
    nominee: {
      status: oneOf(nominee.status, ['yes', 'no', 'unsure', ''] as const, ''),
      names: strings(nominee.names),
    },
    source: oneOf(o.source, ['typed', 'wealth'] as const, 'typed'),
    sourceId: str(o.sourceId),
  };
}

function readShare(raw: unknown): Share {
  const o = obj(raw);
  return { personId: str(o.personId), percent: percent(o.percent, 0), alternateId: str(o.alternateId) };
}

function readGift(raw: unknown): Gift | null {
  const o = obj(raw);
  const assetId = str(o.assetId);
  if (!assetId) return null;
  return { id: str(o.id) || newId(), assetId, shares: list(o.shares).map(readShare) };
}

function readTestator(raw: unknown): Testator {
  const o = obj(raw);
  return {
    name: str(o.name),
    kinRelation: oneOf(o.kinRelation, KIN, ''),
    kinName: str(o.kinName),
    dob: str(o.dob),
    religion: oneOf(o.religion, RELIGIONS, ''),
    maritalStatus: oneOf(o.maritalStatus, MARITAL, ''),
    occupation: str(o.occupation),
    address: str(o.address),
    state: str(o.state),
    residesAbroad: bool(o.residesAbroad),
    soundMind: bool(o.soundMind),
    voluntary: bool(o.voluntary),
    circumstances: strings(o.circumstances).filter((c): c is Circumstance =>
      (CIRCUMSTANCES as readonly string[]).includes(c),
    ),
  };
}

/**
 * A will record from anything: parsed JSON from storage or a backup. Returns
 * null only when it is not a will record at all, so a restore can say "that is
 * not a backup from this tool" instead of loading an empty will over a real one.
 *
 * References that point at nothing (a share naming a person who was deleted)
 * are kept as they are and flagged by the checks, not silently removed: the
 * person should see that something is missing, not find a gift quietly gone.
 */
export function readWill(raw: unknown): WillRecord | null {
  const o = obj(raw);
  if (o.version !== 1 || !Array.isArray(o.people) || !Array.isArray(o.assets)) return null;
  const extras = obj(o.extras);
  const signing = obj(o.signing);
  return {
    version: 1,
    testator: readTestator(o.testator),
    people: o.people.map(readPerson).filter((p): p is Person => p !== null),
    assets: o.assets.map(readAsset).filter((a): a is Asset => a !== null),
    gifts: list(o.gifts)
      .map(readGift)
      .filter((g): g is Gift => g !== null),
    residue: list(o.residue).map(readShare),
    executorIds: strings(o.executorIds),
    guardianIds: strings(o.guardianIds),
    witnessIds: strings(o.witnessIds),
    extras: {
      funeral: str(extras.funeral),
      digital: str(extras.digital),
      pets: str(extras.pets),
      payDebts: bool(extras.payDebts, true),
    },
    signing: { place: str(signing.place), date: str(signing.date) },
    updatedAt: str(o.updatedAt, new Date().toISOString()),
  };
}
