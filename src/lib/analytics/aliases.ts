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

/**
 * Old tool slugs, folded into their current one.
 *
 * The sharpest case of the three, because a slug is tied to a usage allowance.
 * If a tool is renamed and its history is left under the old slug, then every
 * person who used it gets a fresh allowance under the new name and the screen
 * reports them as having used nothing — while the old rows sit in the table
 * counting toward a tool that no longer exists.
 *
 * Applied on the way in as well as on the way out, unlike the two above: a run
 * is stored under the current slug so the allowance is correct at the moment it
 * is checked, not only when it is later charted.
 */
export const AGENT_ALIASES: Record<string, string> = {
  // 'nvr-recon': 'ledger-reconciliation',
};

export const aliasPage = (page: string): string => PAGE_ALIASES[page] ?? page;
export const aliasCta = (label: string): string => CTA_ALIASES[label] ?? label;
export const aliasAgent = (slug: string): string => AGENT_ALIASES[slug] ?? slug;
