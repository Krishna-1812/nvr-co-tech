import { ageOn } from './law';
import {
  ASSET_KIND_LABELS,
  findAsset,
  findPerson,
  personName,
  type Asset,
  type Gift,
  type Person,
  type Share,
  type WillRecord,
} from './model';

/**
 * The words of the will, written once, in plain English.
 *
 * Every sentence a will says is here. Nothing a person types is ever made
 * into a clause: their names, addresses and descriptions are slotted into
 * sentences written in advance, and their three free-text wishes (funeral,
 * online accounts, pets) are printed under their own headings as wishes, never
 * merged into the legal text around them. That is what makes the same record
 * produce the same will every time, and what lets an advocate review the whole
 * library once instead of every will.
 *
 * Wording is our own, written from the Indian Succession Act and from how wills
 * are ordinarily drafted. It avoids "he" and "she": it repeats the name or says
 * "that person", which is also how a careful drafter avoids a mistaken
 * pronoun. No clause gives advice; the checks do that, before the draft.
 *
 * `ADVOCATE_QUESTIONS` lists the choices in these clauses that rest on a
 * judgement rather than on a section number. They go to the advocate who signs
 * the library off (docs/will-maker/02-plan.md, Phase 5), and a clause is not
 * final until each has an answer in writing.
 */

export const ADVOCATE_QUESTIONS: readonly { clause: string; question: string }[] = [
  { clause: 'fallback', question: 'Is “to my heirs under the law that would have applied to me had I died without a will” the right last-resort gift for every religion in scope, and is it safe when the testator has no heirs?' },
  { clause: 'debts', question: 'Is directing debts and funeral costs to come first out of “everything else” correct where a gifted asset carries a loan (a flat with a home loan)?' },
  { clause: 'guardian', question: 'Is the guardian clause (conditional on the other parent not surviving) correct for each religion in scope, and for a testator with no spouse?' },
  { clause: 'digital', question: 'Is authorising the executor to deal with online accounts enforceable against platform terms, or should the wording be softer?' },
  { clause: 'joint', question: 'Is “my interest in” the right phrase for a jointly held asset, and should the draft say more where survivorship may apply?' },
  { clause: 'attestation', question: 'Does the attestation wording satisfy s.63(c) as read with the Bharatiya Sakshya Adhiniyam, 2023 proof-of-execution provisions?' },
  { clause: 'identification', question: 'Is the last four digits plus institution enough to identify an account in a will, or should the full number be the default?' },
];

// ── Small words ────────────────────────────────────────────────────────────

/** A line to write on by hand where nothing has been entered. */
export const BLANK = '______________________';

export const blank = (v: string) => v.trim() || BLANK;

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "24 October 2026" from an ISO date, or '' when it is not one. */
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return '';
  const month = Number(m[2]);
  if (month < 1 || month > 12) return '';
  return `${Number(m[3])} ${MONTHS[month - 1]} ${m[1]}`;
}

const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

const lower = (s: string) => s.toLowerCase();

/**
 * "Asha Rao (my daughter)": the name, then how they are related when that
 * helps. In brackets, not after a comma, so it reads the same in the middle
 * of a sentence as at the end of one.
 */
export function named(p: Person | undefined): string {
  if (!p) return BLANK;
  const name = personName(p);
  switch (p.relation) {
    case 'Other':
    case 'Professional':
      return name;
    case 'Other relative':
      return `${name} (my relative)`;
    default:
      return `${name} (my ${lower(p.relation)})`;
  }
}

const bareName = (p: Person | undefined) => (p ? personName(p) : BLANK);

/** `named`, then where they live, for the people who must be found (executor, guardian). */
const namedAt = (p: Person): string => (p.address.trim() ? `${named(p)}, of ${p.address.trim()},` : named(p));

// ── The Schedule ───────────────────────────────────────────────────────────

/**
 * How an asset is identified: the institution, then the number, the place and
 * anything else, in the order a registrar or a bank would look for them.
 * A number is shown by its last four digits unless the person chose to print
 * the whole thing.
 */
export function shownIdentifier(a: Asset): string {
  const id = a.identifier.replace(/\s+/g, '');
  if (!id) return '';
  if (a.fullIdentifier || id.length <= 4) return id;
  return `ending ${id.slice(-4)}`;
}

export function describeAsset(a: Asset): string {
  const parts = [
    a.institution.trim(),
    shownIdentifier(a) && `no. ${shownIdentifier(a)}`,
    a.location.trim(),
    a.details.trim(),
  ].filter(Boolean);
  return parts.join(', ');
}

/** What the asset is, for a sentence: its own name, or its kind. */
export const assetLabel = (a: Asset) => a.title.trim() || ASSET_KIND_LABELS[a.kind];

/** Which part of it is being given: the whole, a share, or an interest in a joint holding. */
export function ownership(a: Asset): string {
  if (a.percent < 100) return `My ${pct(a.percent)} share`;
  if (a.holding === 'joint') return 'My interest';
  return 'The whole';
}

// ── Clauses ────────────────────────────────────────────────────────────────

export type Built = { id: string; heading: string; paragraphs: string[]; items: string[] };

type Ctx = { r: WillRecord; today: string };

export function openingParagraphs({ r, today }: Ctx): string[] {
  const t = r.testator;
  const age = ageOn(t.dob, today);
  const kin = t.kinRelation && t.kinName.trim() ? `${t.kinRelation} of ${t.kinName.trim()}` : '';
  const who = [
    `I, ${blank(t.name)}`,
    kin,
    age !== null ? `aged about ${age} years` : '',
    t.religion ? `${t.religion} by religion` : '',
    t.occupation.trim(),
    `living at ${blank(t.address)}`,
  ]
    .filter(Boolean)
    .join(', ');
  return [`${who}, make this will of my own free will, while of sound mind and not under pressure from anyone.`];
}

export function revocation(): Built {
  return { id: 'revocation', heading: 'Earlier wills', paragraphs: ['I cancel every will and codicil I have made before this one.'], items: [] };
}

export function family({ r }: Ctx): Built | null {
  const spouse = r.people.filter((p) => p.relation === 'Spouse' && p.name.trim());
  const children = r.people.filter((p) => (p.relation === 'Son' || p.relation === 'Daughter') && p.name.trim());
  const lines: string[] = [];
  if (spouse.length > 0) lines.push(`My spouse is ${joinNames(spouse.map(bareName))}.`);
  if (children.length > 0) lines.push(`My ${children.length === 1 ? 'child is' : 'children are'} ${joinNames(children.map(bareName))}.`);
  if (lines.length === 0) return null;
  return { id: 'family', heading: 'My family', paragraphs: lines, items: [] };
}

export function executors({ r }: Ctx): Built | null {
  const people = r.executorIds.map((id) => findPerson(r, id)).filter((p): p is Person => !!p);
  if (people.length === 0) return null;
  const [first, ...rest] = people;
  const lines = [`I appoint ${namedAt(first)} as executor of this will.`];
  rest.forEach((p, i) => {
    const before = i === 0 ? bareName(first) : bareName(rest[i - 1]);
    lines.push(`If ${before} dies before me, or cannot or will not act, I appoint ${namedAt(p)} as executor in that person’s place.`);
  });
  return { id: 'executors', heading: 'My executor', paragraphs: lines, items: [] };
}

export function debts({ r }: Ctx): Built | null {
  if (!r.extras.payDebts) return null;
  return {
    id: 'debts',
    heading: 'Debts and funeral costs',
    paragraphs: ['My executor is to pay my funeral costs, my debts and the cost of carrying out this will out of what I leave, before the property described under “Everything else” is shared.'],
    items: [],
  };
}

function backupSentences(r: WillRecord, shares: Share[], single: boolean): string[] {
  const out: string[] = [];
  for (const s of shares) {
    if (!s.alternateId) continue;
    const taker = bareName(findPerson(r, s.personId));
    const alt = named(findPerson(r, s.alternateId));
    out.push(single ? `If ${taker} does not survive me, I give it to ${alt}.` : `If ${taker} does not survive me, that share goes to ${alt}.`);
  }
  return out;
}

function giftItem(r: WillRecord, g: Gift, no: number): string | null {
  const asset = findAsset(r, g.assetId);
  if (!asset || g.shares.length === 0) return null;
  const whole = ownership(asset) === 'The whole';
  const subject = `item ${no} of the Schedule (${assetLabel(asset)})`;
  const what = whole ? subject : `${ownership(asset).toLowerCase()} in ${subject}`;
  const single = g.shares.length === 1;
  const to = single
    ? named(findPerson(r, g.shares[0].personId))
    : `the following people, in these shares: ${joinNames(g.shares.map((s) => `${bareName(findPerson(r, s.personId))} (${pct(s.percent)})`))}`;
  return [`I give ${what} to ${to}.`, ...backupSentences(r, g.shares, single)].join(' ');
}

/** Which Schedule item number an asset is, 1-based, in the order of the record. */
export const scheduleNo = (r: WillRecord, assetId: string) => r.assets.findIndex((a) => a.id === assetId) + 1;

export function gifts({ r }: Ctx): Built | null {
  const items = r.gifts
    .map((g) => giftItem(r, g, scheduleNo(r, g.assetId)))
    .filter((x): x is string => x !== null);
  if (items.length === 0) return null;
  return { id: 'gifts', heading: 'Gifts of particular things', paragraphs: ['I make these gifts. Each item is described in the Schedule at the end of this will.'], items };
}

export function residue({ r }: Ctx): Built | null {
  if (r.residue.length === 0) return null;
  const single = r.residue.length === 1;
  const to = single
    ? named(findPerson(r, r.residue[0].personId))
    : `the following people, in these shares: ${joinNames(r.residue.map((s) => `${bareName(findPerson(r, s.personId))} (${pct(s.percent)})`))}`;
  const lines = [
    `I give everything else I own, of every kind and wherever it is, including anything I get after I sign this will and any gift above that cannot take effect, to ${to}.`,
    ...backupSentences(r, r.residue, single),
  ];
  return { id: 'residue', heading: 'Everything else', paragraphs: lines, items: [] };
}

export function fallback({ r }: Ctx): Built | null {
  if (r.residue.length === 0) return null;
  return {
    id: 'fallback',
    heading: 'If nobody can take',
    paragraphs: ['If none of the people named under “Everything else” can take, I give that property to my heirs, in the shares the law that applies to me would give them had I died without a will.'],
    items: [],
  };
}

export function guardian({ r }: Ctx): Built | null {
  const people = r.guardianIds.map((id) => findPerson(r, id)).filter((p): p is Person => !!p);
  if (people.length === 0) return null;
  // The clause is conditional in its own words ("if a child is under 18 when I
  // die"), so it is printed whenever a guardian is named; the checks, not this
  // clause, say which children are minors today.
  const [first, ...rest] = people;
  const lines = [`If, when I die, a child of mine is under 18 and the child’s other parent has not survived me, I appoint ${namedAt(first)} as the child’s guardian.`];
  rest.forEach((p, i) => {
    const before = i === 0 ? bareName(first) : bareName(rest[i - 1]);
    lines.push(`If ${before} dies before me, or cannot or will not act, I appoint ${namedAt(p)} as guardian in that person’s place.`);
  });
  return { id: 'guardian', heading: 'Guardian for my children', paragraphs: lines, items: [] };
}

export function wishes({ r }: Ctx): Built[] {
  const out: Built[] = [];
  const e = r.extras;
  if (e.funeral.trim()) {
    out.push({ id: 'funeral', heading: 'My wishes for my funeral', paragraphs: ['These are my wishes. I ask my family to follow them; carrying out this will does not wait on them.', e.funeral.trim()], items: [] });
  }
  if (e.digital.trim()) {
    out.push({ id: 'digital', heading: 'My online accounts', paragraphs: ['I authorise my executor to deal with, close or pass on my online accounts, as set out below, as far as the law and the providers allow.', e.digital.trim()], items: [] });
  }
  if (e.pets.trim()) {
    out.push({ id: 'pets', heading: 'My pets', paragraphs: ['This is what I want for my pets. I ask my family to follow it.', e.pets.trim()], items: [] });
  }
  return out;
}

export function general(): Built {
  return {
    id: 'general',
    heading: 'How to read this will',
    paragraphs: [
      'A person named as executor or guardian includes the person named in that person’s place. Headings are for ease of reading and do not change what a clause means. If any part of this will cannot be carried out, the rest still stands.',
    ],
    items: [],
  };
}

export function signingText(r: WillRecord): string {
  const place = r.signing.place.trim() || BLANK;
  const date = longDate(r.signing.date) || BLANK;
  return `Signed by me, ${blank(r.testator.name)}, at ${place} on ${date}, as my last will, in front of the two witnesses named below, who have each signed in my presence.`;
}

export function attestationText(r: WillRecord): string {
  return `We each saw ${blank(r.testator.name)} sign this will, or received from that person a personal acknowledgement of their signature. We have each signed below as a witness, in that person’s presence.`;
}
