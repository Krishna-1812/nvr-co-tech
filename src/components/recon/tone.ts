import type { DifferenceType, LedgerKey } from '@/lib/recon/types';

/**
 * The colours this tool thinks in.
 *
 * Two decisions, both worth stating once rather than being re-made per
 * component. First, the two ledgers get a colour each and keep it everywhere —
 * the dropzone, the summary card, the table column, the statement — because the
 * single question the reader is holding throughout is "which book was that in",
 * and a colour answers it faster than a heading does.
 *
 * Second, neither ledger colour is one of the status colours. A ledger being A
 * or B is not good or bad news, and using amber for a ledger on a screen where
 * amber also means "look at this" would be spending the alarm on the furniture.
 */
export const LEDGER_TONE: Record<LedgerKey, string> = {
  A: 'var(--h-indigo)',
  B: 'var(--h-cyan)',
};

/**
 * What each kind of difference is worth.
 *
 * Green for agreement, blue for a lag that will sort itself out, violet for
 * something that exists on one side only, red for two books that disagree about
 * a number. The last is the one that costs money, so it is the only one that
 * gets an alarm colour.
 */
export const CATEGORY_TONE: Record<DifferenceType, string> = {
  MATCHED: 'var(--status-approved)',
  TIMING: 'var(--status-pending)',
  ONE_SIDED: 'var(--h-violet)',
  AMOUNT_DIFF: 'var(--status-rejected)',
};

export const CATEGORY_LABEL: Record<DifferenceType, string> = {
  MATCHED: 'Matched',
  TIMING: 'Timing',
  ONE_SIDED: 'One-sided',
  AMOUNT_DIFF: 'Amount differs',
};

/** Said in full where there is room: the filter chips and the table legend. */
export const CATEGORY_NOTE: Record<DifferenceType, string> = {
  MATCHED: 'In both books, agreed, and both have posted it. Nothing to do.',
  TIMING: 'In both books, but only one has posted it by the date you chose.',
  ONE_SIDED: 'In one book and not the other.',
  AMOUNT_DIFF: 'In both books, at two different amounts.',
};
