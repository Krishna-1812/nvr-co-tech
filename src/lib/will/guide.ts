import { CITE, LAW } from './law';

/**
 * How to sign a will, in words, once.
 *
 * The screen's last step, the printed signing guide and the checklist are all
 * drawn from this list, so they cannot say different things. It says what the
 * Succession Act asks and what is ordinary good practice, and it keeps the two
 * apart: `rule` is something the law requires (with the section), `tip` is
 * advice that makes a will easier to prove or to find. Nothing here promises
 * what a court will do with a particular will; the closing line says to ask an
 * advocate if anything is out of the ordinary.
 */

export type GuideStep = { text: string; detail?: string; kind: 'rule' | 'tip'; cite?: string };
export type GuidePart = { id: 'before' | 'day' | 'after'; heading: string; steps: GuideStep[] };

export const GUIDE: readonly GuidePart[] = [
  {
    id: 'before',
    heading: 'Before you sign',
    steps: [
      {
        kind: 'tip',
        text: 'Read every page once more.',
        detail: 'If anything is wrong, change it in Will Maker and print the whole will again. Never correct a printed page by hand.',
      },
      {
        kind: 'tip',
        text: 'Check that every page shows the same reference and “Page x of y”.',
        detail: 'The reference is at the foot of each page. If you change anything, print every page again so they all match.',
      },
      {
        kind: 'rule',
        text: `Choose ${LAW.witnessesNeeded} witnesses.`,
        detail:
          'Adults who will see you sign. They must not receive anything under the will, and must not be married to someone who does. It helps if they are younger than you, and are not your executor or close family.',
        cite: CITE.witnessGift,
      },
    ],
  },
  {
    id: 'day',
    heading: 'On the day',
    steps: [
      {
        kind: 'tip',
        text: 'Sign with both witnesses in the room, in one sitting.',
        detail: 'The law does not require the witnesses to be there at the same time, but one sitting is simplest and leaves the least to explain later.',
      },
      { kind: 'tip', text: 'Initial each page at the foot, in ink.', detail: 'Keep the pages fastened together.' },
      {
        kind: 'rule',
        text: 'Sign at the end of the will, on paper, in ink.',
        detail: 'Sign where the will says, with your usual signature. Write the place and the date if they are blank.',
        cite: CITE.signing,
      },
      {
        kind: 'rule',
        text: 'Each witness signs in front of you.',
        detail: 'They must each have seen you sign, or have heard you say the signature is yours. They then sign the attestation block, writing their name and address.',
        cite: CITE.witnesses,
      },
    ],
  },
  {
    id: 'after',
    heading: 'After you sign',
    steps: [
      {
        kind: 'tip',
        text: 'Keep the signed original somewhere safe, and tell your executor where it is.',
        detail: 'Only the signed original counts. Photocopies are for reference. Choose a place your executor can reach without waiting on anyone.',
      },
      {
        kind: 'tip',
        text: 'Consider registering it.',
        detail: `Registration with the Sub-Registrar is optional (${CITE.registration}). It means going to the office with both witnesses, and it makes the will harder to dispute. The fee depends on the state.`,
        cite: CITE.registration,
      },
      {
        kind: 'tip',
        text: 'Make a new will when your life changes.',
        detail: 'Marriage, children, a death, a new property or a closed loan can all make a will out of date. Never write changes on a signed will: make a new one, or ask an advocate for a codicil.',
      },
    ],
  },
];

/** Things people assume are needed and are not, said once so nobody pays for them by mistake. */
export const NOT_NEEDED: readonly string[] = [
  'Stamp paper. A will carries no stamp duty.',
  'A notary. A will is valid without one.',
  'An electronic or typed signature. A will is signed on paper, in ink.',
];

export const GUIDE_CLOSING =
  'This guide describes what the Indian Succession Act asks and some ordinary good practice. It is not legal advice. If your family, your property or your wishes are out of the ordinary, ask an advocate to read the will before you sign.';
