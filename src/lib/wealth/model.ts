import { HEADS, head, isHeadId, type Fields, type HeadId } from './heads';

/**
 * The shape of a wealth record, and how to read one back without trusting it.
 *
 * A record is a list of entries (each one bank account, one flat, one loan),
 * plus a small profile about the household: who is in it, whether there is a
 * will, and who would need to know this record exists. Everything a person
 * types lives in `fields`, keyed by the head's field keys, as text exactly as
 * typed. Only the value is a number, because it is the one thing summed.
 *
 * Read back defensively. The record comes from localStorage or from a backup
 * file somebody may have opened in a text editor, and an entry that has lost a
 * field should still load, with the field empty, rather than take the screen
 * down or silently drop the entry.
 */

export type NomineeStatus = 'yes' | 'no' | 'unsure' | '';

export type Nominee = {
  id: string;
  name: string;
  relation: string;
  /** ISO date. Used to tell a minor nominee, who needs a guardian named. */
  dob: string;
  /** Per cent of the account, as typed. Blank means "not split". */
  share: string;
  /** Required in practice when the nominee is a minor. */
  guardian: string;
  phone: string;
};

export type Member = { id: string; name: string; relation: string };

export type Item = {
  id: string;
  head: HeadId;
  kind: string;
  /** The person's own name for it. Blank means use the suggested name. */
  label: string;
  /** Which member of the household holds it. */
  holder: string;
  /** Per cent of the value that is this household's (or this holder's) share. */
  share: number;
  /** Balance, market value or outstanding. Null until entered. */
  value: number | null;
  /** When the value was last set, as an ISO date. */
  asOf: string;
  fields: Fields;
  nominee: { status: NomineeStatus; people: Nominee[] };
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type WillStatus = 'yes' | 'drafting' | 'no' | '';

export type Profile = {
  members: Member[];
  will: WillStatus;
  willKept: string;
  executor: string;
  /** Somebody who knows this record exists and where the backup is. */
  trusted: string;
  emergency: string;
  /** Optional. Lets the overview say how many months of spending the liquid assets cover. */
  monthlyExpenses: number | null;
};

export type WealthRecord = {
  version: 1;
  profile: Profile;
  items: Item[];
  /** When a backup file was last downloaded from this device. */
  lastBackupAt: string | null;
  updatedAt: string;
};

export const SELF = 'self';

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
  'Other',
] as const;

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Today in India, as an ISO date. Values are dated in the reader's own calendar. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

export function blankProfile(selfName = ''): Profile {
  return {
    members: [{ id: SELF, name: selfName, relation: 'Self' }],
    will: '',
    willKept: '',
    executor: '',
    trusted: '',
    emergency: '',
    monthlyExpenses: null,
  };
}

export function blankRecord(selfName = ''): WealthRecord {
  return {
    version: 1,
    profile: blankProfile(selfName),
    items: [],
    lastBackupAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function blankNominee(): Nominee {
  return { id: newId(), name: '', relation: '', dob: '', share: '', guardian: '', phone: '' };
}

export function blankItem(headId: HeadId, holder = SELF): Item {
  const spec = head(headId);
  const now = new Date().toISOString();
  return {
    id: newId(),
    head: headId,
    kind: spec.kinds[0],
    label: '',
    holder,
    share: 100,
    value: null,
    asOf: '',
    fields: {},
    nominee: { status: '', people: [] },
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

/** What an entry is called on screen: its own name, or one built from its details. */
export function itemName(item: Item): string {
  const own = item.label.trim();
  if (own) return own;
  const spec = head(item.head);
  return spec.suggest(item.kind, item.fields) || capitalise(spec.one);
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function memberName(profile: Profile, id: string): string {
  const m = profile.members.find((x) => x.id === id);
  if (!m) return 'Someone removed from the household';
  if (m.id === SELF) return m.name.trim() || 'You';
  return m.name.trim() || m.relation || 'Unnamed member';
}

/** "••••4321": the last four characters, the rest hidden. */
export function mask(value: string): string {
  const v = value.replace(/\s+/g, '');
  if (!v) return '';
  if (v.length <= 4) return v;
  return `••••${v.slice(-4)}`;
}

// ── Reading back ────────────────────────────────────────────────────────────

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const STATUSES: NomineeStatus[] = ['yes', 'no', 'unsure', ''];
const WILLS: WillStatus[] = ['yes', 'drafting', 'no', ''];

function readNominee(raw: unknown): Nominee {
  const o = obj(raw);
  return {
    id: str(o.id) || newId(),
    name: str(o.name),
    relation: str(o.relation),
    dob: str(o.dob),
    share: str(o.share),
    guardian: str(o.guardian),
    phone: str(o.phone),
  };
}

function readFields(raw: unknown): Fields {
  const out: Fields = {};
  for (const [k, val] of Object.entries(obj(raw))) {
    if (typeof val === 'string') out[k] = val;
    else if (typeof val === 'number' && Number.isFinite(val)) out[k] = String(val);
  }
  return out;
}

function readItem(raw: unknown): Item | null {
  const o = obj(raw);
  if (!isHeadId(o.head)) return null;
  const spec = head(o.head);
  const id = str(o.id);
  if (!id) return null;
  const nominee = obj(o.nominee);
  const status = STATUSES.includes(nominee.status as NomineeStatus) ? (nominee.status as NomineeStatus) : '';
  const share = finite(o.share);
  const kind = str(o.kind);
  return {
    id,
    head: o.head,
    kind: spec.kinds.includes(kind) ? kind : spec.kinds[0],
    label: str(o.label),
    holder: str(o.holder, SELF) || SELF,
    share: share !== null && share > 0 && share <= 100 ? share : 100,
    value: finite(o.value) !== null && (o.value as number) >= 0 ? (o.value as number) : null,
    asOf: str(o.asOf),
    fields: readFields(o.fields),
    nominee: { status, people: list(nominee.people).map(readNominee) },
    notes: str(o.notes),
    createdAt: str(o.createdAt, new Date(0).toISOString()),
    updatedAt: str(o.updatedAt, new Date(0).toISOString()),
  };
}

function readProfile(raw: unknown): Profile {
  const o = obj(raw);
  const members = list(o.members)
    .map((m) => {
      const mo = obj(m);
      return { id: str(mo.id) || newId(), name: str(mo.name), relation: str(mo.relation) };
    })
    .filter((m) => m.id !== SELF);
  const selfRaw = obj(list(o.members).find((m) => obj(m).id === SELF));
  const will = WILLS.includes(o.will as WillStatus) ? (o.will as WillStatus) : '';
  const expenses = finite(o.monthlyExpenses);
  return {
    members: [{ id: SELF, name: str(selfRaw.name), relation: 'Self' }, ...members],
    will,
    willKept: str(o.willKept),
    executor: str(o.executor),
    trusted: str(o.trusted),
    emergency: str(o.emergency),
    monthlyExpenses: expenses !== null && expenses >= 0 ? expenses : null,
  };
}

/**
 * A record from anything: parsed JSON from storage or a backup. Returns null
 * only when it is not a wealth record at all, so a restore can say "that is not
 * a backup from this tool" instead of loading an empty record over a real one.
 */
export function readRecord(raw: unknown): WealthRecord | null {
  const o = obj(raw);
  if (o.version !== 1 || !Array.isArray(o.items)) return null;
  const items = o.items.map(readItem).filter((i): i is Item => i !== null);
  return {
    version: 1,
    profile: readProfile(o.profile),
    items,
    lastBackupAt: typeof o.lastBackupAt === 'string' ? o.lastBackupAt : null,
    updatedAt: str(o.updatedAt, new Date().toISOString()),
  };
}

/** Heads in the order the record lists them, each with its entries. */
export function byHead(items: Item[]): { head: (typeof HEADS)[number]; items: Item[] }[] {
  return HEADS.map((h) => ({ head: h, items: items.filter((i) => i.head === h.id) })).filter(
    (g) => g.items.length > 0,
  );
}
