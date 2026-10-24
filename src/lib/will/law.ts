/**
 * What Indian law asks of a will, written once, with the section beside each rule.
 *
 * Everything the checks, the clauses and the "can we make this will at all"
 * screen say about the law comes from here, so a rule that changes (or that an
 * advocate corrects) changes in one file and one test, not in six places that
 * each remember it slightly differently.
 *
 * Two things this file is careful NOT to be:
 *
 *   - Legal advice. It encodes the statute as the published guides read it and
 *     says so. `LAW.advocateSignOff` stays `null` until a named advocate has
 *     read the rules and the clause library and put that in writing
 *     (docs/will-maker/legal-review.md); the tool is not made public before
 *     then (docs/will-maker/02-plan.md, Phase 5).
 *   - Clever. When the law is unsettled or depends on facts we cannot see, a
 *     rule here says "caution" or "out of scope" and names the reason. It never
 *     picks the likelier reading and carries on, because a will that is wrong
 *     is wrong on the day nobody can fix it.
 */

export const LAW = {
  /** The date the rules below were last read against the sources listed in docs/will-maker/01-research.md. */
  rulesCheckedOn: '2026-10-24',
  /** Who has signed these rules off, and when. Null means nobody yet. */
  advocateSignOff: null as string | null,
  /** An adult for the purposes of making a will. */
  adultAge: 18,
  /** Attesting witnesses a will needs. */
  witnessesNeeded: 2,
} as const;

/** Section references, as they should read on screen and in the code. */
export const CITE = {
  whoMayMake: 'Indian Succession Act, 1925, s.59',
  signing: 'Indian Succession Act, 1925, s.63(a)–(b)',
  witnesses: 'Indian Succession Act, 1925, s.63(c)',
  witnessGift: 'Indian Succession Act, 1925, s.67',
  revocation: 'Indian Succession Act, 1925, s.70',
  wording: 'Indian Succession Act, 1925, s.74',
  lapse: 'Indian Succession Act, 1925, s.105',
  muslims: 'Indian Succession Act, 1925, s.58(1)',
  registration: 'Registration Act, 1908, s.18',
  noEsign: 'Information Technology Act, 2000, First Schedule',
  guardian: 'Hindu Minority and Guardianship Act, 1956, s.9',
} as const;

export const RELIGIONS = ['Hindu', 'Buddhist', 'Jain', 'Sikh', 'Christian', 'Parsi', 'Muslim', 'Other'] as const;
export type Religion = (typeof RELIGIONS)[number] | '';

/**
 * Things that make an online questionnaire the wrong tool, or at least not
 * the only one. Each is a plain statement the person ticks about themselves.
 */
export const CIRCUMSTANCES = [
  'special_needs_dependant',
  'business_interest',
  'second_marriage',
  'excluding_an_heir',
  'expecting_a_dispute',
  'assets_abroad',
] as const;
export type Circumstance = (typeof CIRCUMSTANCES)[number];

export const CIRCUMSTANCE_LABELS: Record<Circumstance, string> = {
  special_needs_dependant: 'Someone who depends on me cannot manage money themselves',
  business_interest: 'I own a share in a business, partnership or company',
  second_marriage: 'I have children from more than one marriage',
  excluding_an_heir: 'I want to leave a close relative out',
  expecting_a_dispute: 'I expect someone to challenge this will',
  assets_abroad: 'I own property or accounts outside India',
};

export type ReasonLevel = 'out' | 'caution';

export type Reason = {
  id: string;
  level: ReasonLevel;
  title: string;
  detail: string;
  cite?: string;
};

/** `ok` means nothing in the answers so far argues against using the tool. */
export type ScopeLevel = 'ok' | 'caution' | 'out';

export type Scope = { level: ScopeLevel; reasons: Reason[] };

/** What the verdict needs to know. A `Testator` carries all of it. */
export type ScopeInput = {
  dob: string;
  religion: Religion;
  state: string;
  circumstances: readonly Circumstance[];
};

/** Whole years between two ISO dates, or null when either is unreadable. */
export function ageOn(dob: string, today: string): number | null {
  const born = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  const now = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today.trim());
  if (!born || !now) return null;
  const [by, bm, bd] = [Number(born[1]), Number(born[2]), Number(born[3])];
  const [ny, nm, nd] = [Number(now[1]), Number(now[2]), Number(now[3])];
  if (bm < 1 || bm > 12 || bd < 1 || bd > 31) return null;
  let years = ny - by;
  if (nm < bm || (nm === bm && nd < bd)) years -= 1;
  return years < 0 ? null : years;
}

export const isGoa = (state: string) => state.trim().toLowerCase() === 'goa';

/**
 * Whether this tool can safely make this person's will, and why not if it cannot.
 *
 * `out` stops the wizard at the front door with the reason in words: Muslim
 * personal law, Goa's own succession law, a testator who is a minor. `caution`
 * lets them carry on but puts the reason on every screen, and in the final
 * checklist, until they have read it. (The two declarations, sound mind and
 * acting freely, are not scope: they are things to tick, and `checks.ts` holds
 * the export until they are.)
 *
 * An unanswered question is never read as a comfortable answer: no religion
 * given is a caution, not a pass, because the rules differ by religion.
 */
export function scopeOf(input: ScopeInput, today: string): Scope {
  const reasons: Reason[] = [];
  const add = (r: Reason) => reasons.push(r);

  const age = ageOn(input.dob, today);
  if (age !== null && age < LAW.adultAge) {
    add({
      id: 'minor',
      level: 'out',
      title: 'Only an adult can make a will',
      detail: `A will can be made by a person of sound mind who is not a minor. At ${age} the law does not let you make one yet.`,
      cite: CITE.whoMayMake,
    });
  } else if (age === null) {
    add({
      id: 'age-unknown',
      level: 'caution',
      title: 'Add your date of birth',
      detail: 'A will can only be made by an adult. We need your date of birth to confirm that and to say how old you are in the will.',
      cite: CITE.whoMayMake,
    });
  }

  if (input.religion === 'Muslim') {
    add({
      id: 'muslim',
      level: 'out',
      title: 'Muslim personal law decides how much a will can give',
      detail:
        'The will provisions of the Indian Succession Act do not apply to a Muslim, and under the personal law the usual understanding is that no more than one-third of the estate can be left by will to anyone when there are heirs, unless the heirs agree after death. A questionnaire cannot work that out safely. Please see an advocate.',
      cite: CITE.muslims,
    });
  }
  if (input.religion === '') {
    add({
      id: 'religion',
      level: 'caution',
      title: 'Say which religion’s law applies to you',
      detail: 'The rules on wills and on who inherits differ by religion. Choose one so we can tell whether this tool fits.',
    });
  }
  if (input.religion === 'Other') {
    add({
      id: 'religion-other',
      level: 'caution',
      title: 'Check your personal law with an advocate',
      detail: 'This tool is built on the Indian Succession Act, which governs wills for most people who are not Muslim. If another personal law applies to you, have an advocate read the draft.',
    });
  }

  if (isGoa(input.state)) {
    add({
      id: 'goa',
      level: 'out',
      title: 'Goa has its own succession law',
      detail:
        'Goa follows the Portuguese Civil Code and its own succession statute, which reserve parts of an estate for certain heirs. This tool is not built for it. Please see an advocate in Goa.',
    });
  }

  const wants = (c: Circumstance) => input.circumstances.includes(c);
  if (wants('special_needs_dependant')) {
    add({
      id: 'special-needs',
      level: 'caution',
      title: 'A trust may suit a dependant better than a gift',
      detail: 'A gift made directly to someone who cannot manage money, or who relies on benefits, can do them harm. A private trust is usually the safer way. An advocate can set one up; this tool cannot.',
    });
  }
  if (wants('business_interest')) {
    add({
      id: 'business',
      level: 'caution',
      title: 'Business interests have their own rules',
      detail: 'A partnership deed, a company’s articles or a shareholders’ agreement can limit who may take your share. Have an advocate or your company secretary check before you sign.',
    });
  }
  if (wants('second_marriage')) {
    add({
      id: 'second-marriage',
      level: 'caution',
      title: 'Families from more than one marriage are where wills are most often challenged',
      detail: 'Name everyone clearly, give each person’s share in numbers, and consider registering the will. An advocate’s read-through is worth it.',
    });
  }
  if (wants('excluding_an_heir')) {
    add({
      id: 'excluding',
      level: 'caution',
      title: 'Leaving a close relative out invites a challenge',
      detail: 'You are free to do it in many cases, but how it is worded matters. Have an advocate look at the draft, and consider registering the will.',
    });
  }
  if (wants('expecting_a_dispute')) {
    add({
      id: 'dispute',
      level: 'caution',
      title: 'If you expect a challenge, register the will and use an advocate',
      detail: 'Registration with the Sub-Registrar is optional, but it makes it much harder to say the will is a forgery or not the latest one.',
      cite: CITE.registration,
    });
  }
  if (wants('assets_abroad')) {
    add({
      id: 'abroad',
      level: 'caution',
      title: 'Property outside India needs a will under that country’s law',
      detail: 'This will can cover what you own in India. For property or accounts abroad, make a separate will in that country, so the two do not contradict each other.',
    });
  }

  const order: Record<ReasonLevel, number> = { out: 0, caution: 1 };
  reasons.sort((a, b) => order[a.level] - order[b.level]);

  const level: ScopeLevel = reasons.some((r) => r.level === 'out')
    ? 'out'
    : reasons.length > 0
      ? 'caution'
      : 'ok';
  return { level, reasons };
}
