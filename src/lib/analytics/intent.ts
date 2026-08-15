import type { FunnelStage, IntentScore } from './types';

/**
 * How close somebody looks to buying, from what they read.
 *
 * Deliberately simple and deliberately transparent. There is no model here and
 * there is not going to be one: the output of this function is handed to a
 * person who has to decide whether to spend half an hour on a phone call, and
 * the only scores anybody acts on are the ones they can argue with. So it is
 * keyword tiers and arithmetic, every component is capped so that no single
 * behaviour can run away with the total, and the breakdown comes back with the
 * number.
 *
 * The caps are the part worth defending. Without them, somebody who refreshed
 * the pricing page eleven times would outrank somebody who read the pricing
 * page, the integrations page and two case studies — and the second person is
 * obviously the better conversation.
 */

/** Pages somebody only opens when they are thinking about actually buying. */
const HIGH_INTENT = [
  'pricing', 'demo', 'contact', 'trial', 'buy', 'checkout', 'book', 'quote',
  'roi', 'compare', 'get-started', 'get started', 'request', 'talk-to', 'talk to',
  'walkthrough', 'signup', 'sign-up',
];

/** Pages somebody opens while working out whether the thing is for them. */
const MID_INTENT = [
  'product', 'features', 'solutions', 'integrations', 'docs', 'case-study',
  'case study', 'customers', 'platform', 'use-case', 'use case', 'how-it-works',
  'how it works', 'services', 'agents', 'about',
];

const HIGH_POINTS = 20;
const HIGH_CAP = 40;
const MID_POINTS = 7;
const MID_CAP = 20;
const DEPTH_CAP = 15;
const RETURN_CAP = 15;
const ENGAGEMENT_CAP = 10;
const THIRD_PARTY_CAP = 20;

export type IntentInput = {
  /** Every path or title the visitor has been seen on, duplicates included. */
  pages: string[];
  /** Distinct sessions. Two or more is somebody who came back. */
  sessions: number;
  /** Total engaged seconds, which is attention rather than tab-open time. */
  engagedSeconds: number;
  /** A purchased intent signal, 0-1, when a paid provider supplied one. */
  thirdParty?: number | null;
};

const matches = (page: string, words: string[]) => {
  const p = page.toLowerCase();
  return words.some((w) => p.includes(w));
};

export function scoreIntent({
  pages,
  sessions,
  engagedSeconds,
  thirdParty = null,
}: IntentInput): IntentScore {
  const factors: { label: string; points: number }[] = [];
  const add = (label: string, points: number) => {
    if (points > 0) factors.push({ label, points: Math.round(points * 10) / 10 });
    return points;
  };

  const highPages = pages.filter((p) => matches(p, HIGH_INTENT));
  const midPages = pages.filter((p) => !matches(p, HIGH_INTENT) && matches(p, MID_INTENT));

  let total = 0;

  total += add(
    `${highPages.length} high-intent ${highPages.length === 1 ? 'page' : 'pages'} read`,
    Math.min(highPages.length * HIGH_POINTS, HIGH_CAP),
  );

  total += add(
    `${midPages.length} mid-intent ${midPages.length === 1 ? 'page' : 'pages'} read`,
    Math.min(midPages.length * MID_POINTS, MID_CAP),
  );

  total += add(
    `${pages.length} pages in total`,
    Math.min(Math.max(pages.length - 1, 0) * 2, DEPTH_CAP),
  );

  if (sessions >= 2) {
    total += add(`Came back — ${sessions} separate visits`, Math.min(sessions * 5, RETURN_CAP));
  }

  if (engagedSeconds >= 120) {
    total += add(
      `${Math.round(engagedSeconds / 60)} minutes of actual attention`,
      Math.min(Math.floor(engagedSeconds / 120) * 5, ENGAGEMENT_CAP),
    );
  }

  if (thirdParty != null && thirdParty > 0) {
    total += add(
      'Third-party intent signal',
      Math.min(thirdParty * 20, THIRD_PARTY_CAP),
    );
  }

  const score = Math.round(Math.min(total, 100) * 10) / 10;
  return { score, stage: stageFor(score), factors };
}

export function stageFor(score: number): FunnelStage {
  if (score >= 70) return 'decision';
  if (score >= 40) return 'consideration';
  if (score >= 15) return 'interest';
  return 'awareness';
}

/** What each stage is called on screen, and what it actually means. */
export const STAGE_COPY: Record<FunnelStage, { label: string; meaning: string }> = {
  decision: { label: 'Decision', meaning: 'Reading the pages people read before they get in touch.' },
  consideration: { label: 'Consideration', meaning: 'Working out whether this is for them.' },
  interest: { label: 'Interest', meaning: 'Looked at more than one thing on purpose.' },
  awareness: { label: 'Awareness', meaning: 'Arrived, had a look. Nothing to read into yet.' },
};
