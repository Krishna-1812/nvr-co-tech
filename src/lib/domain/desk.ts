/**
 * One answer to "what should I do next", for every screen that asks it.
 *
 * ── Why this is not two functions ───────────────────────────────────────────
 *
 * The workspace and the dashboard both opened with a greeting, a date and one
 * sentence picked from the same counts, and they picked it with two different
 * chains written three months apart. The orderings disagreed about drafts: the
 * workspace put your unfinished drafts ahead of the vouchers sitting with
 * approvers, the dashboard put them behind. So one person, one set of counts, two
 * consecutive screens, and two different accounts of what mattered most.
 *
 * Nobody was ever going to notice that by reading either file. Both now call
 * this, and the ordering is stated once, here, where it can be argued with.
 *
 * ── The ordering, and why it is this ────────────────────────────────────────
 *
 * By whether the reader can act, then by how much it hurts to leave:
 *
 *   1. Sent back to you. Nobody else can clear it, and it is already late by
 *      definition: it has been round the loop once.
 *   2. Waiting on your approval. You can act, and other people are held up.
 *   3. Your drafts. You can act, and nobody is waiting.
 *   4. With approvers. You cannot act at all. Worth saying, because "nothing is
 *      waiting on you" is the useful half of it.
 *   5. Nothing has ever been raised. Not the same fact as a clear desk, and the
 *      only one of these that needs telling somebody where to start.
 *   6. Clear.
 *
 * The dashboard used to run 1, 2, 4, 3 and would tell an approver with two
 * drafts of their own that nothing was waiting on them, which was true of the
 * queue and not of them.
 */

export type DeskCounts = {
  /** Yours, sent back for correction. */
  sentBack: number;
  /** Submitted vouchers you are allowed to approve. Zero if you cannot approve. */
  queue: number;
  /** Yours, started and not submitted. */
  drafts: number;
  /** Yours, submitted and waiting on somebody else. */
  withApprovers: number;
  /**
   * Everything, at any status, from anybody the reader is allowed to see.
   *
   * The only count that can tell a workspace nobody has used from a quiet one:
   * a voucher raised and paid last March leaves no drafts and nothing pending.
   */
  everRaised: number;
  /** How long the head of your approval queue has been waiting, in days. */
  oldestQueueDays?: number;
};

export type DeskBrief = {
  /**
   * A headline for a screen whose job is the work rather than the welcome.
   *
   * Sentence case with a full stop, because it is a statement and not a label.
   */
  headline: string;
  /**
   * What sits under the headline, on a screen that shows both.
   *
   * It has to add something. The first version of this file used one string for
   * the heading and the paragraph, so the dashboard read "1 voucher came back."
   * and then "1 voucher came back for correction", which is a stutter rather
   * than a briefing. There is a test that keeps them from converging again.
   */
  detail: string;
  /**
   * The workspace card's one line, which has no headline above it.
   *
   * Self-contained for that reason: it can never say "that one" or "those",
   * because the reader has not been told what they are.
   */
  note: string;
  /** A --status-* variable, so the same fact is the same colour on both screens. */
  tone: string;
  cta: { href: string; label: string; primary: boolean };
};

/** "1 voucher" / "3 vouchers". */
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Waiting this long is worth naming in the sentence rather than leaving implied. */
const STALE_DAYS = 3;

export function deskBrief(n: DeskCounts): DeskBrief {
  if (n.sentBack > 0) {
    const it = n.sentBack === 1 ? 'it' : 'them';
    return {
      headline: `${count(n.sentBack, 'voucher')} came back.`,
      detail: `Nobody else can clear ${it} for you. Correct ${it} and submit again.`,
      note: `${count(n.sentBack, 'voucher')} came back for correction, and nobody else can clear ${it} for you.`,
      tone: 'var(--status-rejected)',
      cta: { href: '/vouchers?status=rejected', label: 'See what came back', primary: true },
    };
  }

  if (n.queue > 0) {
    const old = n.oldestQueueDays ?? 0;
    return {
      headline: `${count(n.queue, 'voucher')} ${n.queue === 1 ? 'needs' : 'need'} your approval.`,
      detail:
        old >= STALE_DAYS
          ? `Oldest first, and the one at the top has been waiting ${old} days.`
          : 'Oldest first, and none of them has been waiting long.',
      note: `${count(n.queue, 'voucher')} ${n.queue === 1 ? 'is' : 'are'} waiting for your approval${old >= STALE_DAYS ? `, the oldest for ${old} days` : ''}.`,
      tone: 'var(--status-pending)',
      cta: { href: '/approvals', label: 'Open the queue', primary: true },
    };
  }

  if (n.drafts > 0) {
    return {
      headline: `${count(n.drafts, 'draft')} still to finish.`,
      detail: 'Nothing else needs you. Only you can see a draft until it is submitted.',
      note: `${count(n.drafts, 'draft')} started and not submitted. Nothing else needs you.`,
      tone: 'var(--status-warn)',
      cta: { href: '/vouchers?status=draft', label: 'Finish your drafts', primary: true },
    };
  }

  if (n.withApprovers > 0) {
    return {
      headline: 'Nothing is waiting on you.',
      detail: `${count(n.withApprovers, 'voucher')} of yours ${n.withApprovers === 1 ? 'is' : 'are'} with approvers.`,
      note: `${count(n.withApprovers, 'voucher')} of yours ${n.withApprovers === 1 ? 'is' : 'are'} with approvers. Nothing is waiting on you.`,
      tone: 'var(--status-pending)',
      cta: {
        href: '/vouchers?status=pending_first',
        label: 'See where they are',
        primary: false,
      },
    };
  }

  if (n.everRaised === 0) {
    /*
     * Not "the number writes itself". Since 0019 the voucher number is typed by
     * hand, with the next one in the chapter's run offered as a suggestion, and
     * the first thing this product says about itself should not be the thing it
     * stopped doing.
     */
    const start =
      'A chapter, a payee and an amount is most of a voucher, and the number is suggested for you.';
    return {
      headline: 'Nothing raised yet.',
      detail: start,
      note: `Nothing raised yet. ${start}`,
      tone: 'var(--status-draft)',
      cta: { href: '/vouchers/new', label: 'Raise a voucher', primary: true },
    };
  }

  return {
    headline: 'The desk is clear.',
    detail: 'Nothing is waiting on you, and nothing has come back.',
    note: 'Nothing is waiting on you, and nothing has come back.',
    tone: 'var(--status-approved)',
    cta: { href: '/vouchers/new', label: 'Raise a voucher', primary: true },
  };
}
