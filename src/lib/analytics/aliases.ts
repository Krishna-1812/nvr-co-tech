/**
 * What a page used to be called.
 *
 * A stored string outlives the thing that produced it. The moment a page or a
 * call-to-action is renamed, every row recorded before the rename keeps the old
 * label — and a report that groups by label silently forks one page's history
 * into two under-counting buckets. There is no error, no warning and no missing
 * row; the totals are just quietly wrong from that day forward, and the shape
 * of the wrongness is a drop in traffic to a page that did not drop.
 *
 * So every read path that groups by a label goes through here first. It is a
 * plain table because there is no way to derive it: only a person knows that
 * `/agents/nvr-recon` became `/agents/ledger-reconciliation`.
 *
 * Empty today, and that is fine. What matters is that the hook exists before it
 * is needed, because the day it is needed is the day somebody renames something
 * and nobody thinks to look for this file.
 */

/** Old page path or title on the left, what it is called now on the right. */
export const PAGE_ALIASES: Record<string, string> = {
  // '/agents/nvr-recon': '/agents/ledger-reconciliation',
};

/**
 * Old CTA labels, folded into their current spelling.
 *
 * Same problem one level down. The tracker writes a label into the tally, the
 * dashboard groups by it, and renaming the button splits the count.
 */
export const CTA_ALIASES: Record<string, string> = {
  // 'lead:Talk to us': 'lead:Book a walkthrough',
};

export const aliasPage = (page: string): string => PAGE_ALIASES[page] ?? page;
export const aliasCta = (label: string): string => CTA_ALIASES[label] ?? label;
