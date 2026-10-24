import { GUIDE, NOT_NEEDED } from './guide';
import { CITE, LAW } from './law';

/**
 * What the public page says about wills, once.
 *
 * Every legal sentence here is lifted from `guide.ts` and `law.ts`, which the
 * advocate reviews, rather than written again: the public page cannot say a thing
 * the signing guide does not, and cannot drift from it. This file is itself among
 * the reviewed files (`REVIEWED_FILES`), and the review packet prints the
 * questions and answers verbatim, so what is published is what was read.
 *
 * Deliberately absent: anything about probate, nominees versus heirs, tax, or
 * what a court will do with a particular will. Those need a source and a lawyer;
 * they are not claims a questionnaire should make to strangers.
 */

export type Faq = { q: string; a: string };

/** A line of the signing guide, by the start of its text. Throws if the guide changes under it. */
function guide(start: string): { text: string; detail: string } {
  for (const part of GUIDE) {
    for (const s of part.steps) if (s.text.startsWith(start) && s.detail) return { text: s.text, detail: s.detail };
  }
  throw new Error(`faq.ts: the signing guide has no step starting “${start}”`);
}

/** A “you do not need” line, by the thing it names. */
function notNeeded(thing: string): string {
  const line = NOT_NEEDED.find((n) => n.startsWith(thing));
  if (!line) throw new Error(`faq.ts: NOT_NEEDED has no line for “${thing}”`);
  return line;
}

const witnesses = guide('Choose');
const each = guide('Each witness');
const register = guide('Consider registering');
const change = guide('Make a new will');

export const FAQ: readonly Faq[] = [
  {
    q: 'Is a will made with Will Maker valid?',
    a: `It becomes a will when you sign it at the end, on paper, in ink, and ${LAW.witnessesNeeded} witnesses each sign in your presence (${CITE.signing}; ${CITE.witnesses}). Until then it is a draft. Will Maker writes the document and shows you how to sign it. It cannot make it valid for you, and it is not a substitute for an advocate if your affairs are out of the ordinary.`,
  },
  {
    q: 'Do I need stamp paper?',
    a: notNeeded('Stamp paper').replace(/^Stamp paper\.\s*/, 'No. '),
  },
  {
    q: 'Do I need a notary?',
    a: notNeeded('A notary').replace(/^A notary\.\s*/, 'No. '),
  },
  {
    q: 'Do I have to register my will?',
    a: `No. ${register.detail}`,
  },
  {
    q: 'Who can be my witness?',
    a: `${witnesses.text} ${witnesses.detail} ${each.detail} (${CITE.witnessGift}; ${CITE.witnesses}).`,
  },
  {
    q: 'Can I sign my will electronically?',
    a: `No. ${notNeeded('An electronic').replace(/^An electronic or typed signature\.\s*/, '')} The law on electronic signatures lists wills among the documents it does not cover (${CITE.noEsign}).`,
  },
  {
    q: 'Who is Will Maker for?',
    a: `Adults of sound mind (${LAW.adultAge} or over) writing their own will, who are not Muslim and do not live in Goa, and whose families and property are ordinary. Muslim personal law limits what a will can give (${CITE.muslims}), Goa has its own rules, and a questionnaire cannot work either out safely, so Will Maker turns those cases away and says so. If something in your situation is out of the ordinary, it tells you to ask an advocate.`,
  },
  {
    q: 'Does anyone read my will?',
    a: 'No. It is written in your browser and kept there, and Will Maker sends it nowhere. If you sign in and lock it with a passcode, an encrypted copy is saved to your account that we cannot read, and a forgotten passcode cannot be recovered. Keep a backup file.',
  },
  {
    q: 'What if my life changes after I sign?',
    a: change.detail,
  },
];
