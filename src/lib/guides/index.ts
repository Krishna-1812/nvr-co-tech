import { agentBySlug } from '@/lib/marketing/content';
import { BANK_RECONCILIATION, PAYMENT_VOUCHER, SUPPLIER_RECONCILIATION, VOUCHER_TYPES } from './books';
import { NET_WORTH, TAX_NOTICES } from './people';
import { CARPET_AREA, GST_ON_FLATS, PRE_EMI, RENTAL_YIELD, TRUE_COST } from './property';
import type { Guide } from './types';
import { COMPARABLES, EV_EBITDA } from './value';

export type { Block, Guide } from './types';

/** Every guide, published or not, in the order the index lists them. */
export const ALL_GUIDES: readonly Guide[] = [
  TRUE_COST,
  RENTAL_YIELD,
  BANK_RECONCILIATION,
  NET_WORTH,
  TAX_NOTICES,
  COMPARABLES,
  PAYMENT_VOUCHER,
  // Written in the site audit and published at the owner's word (28 Oct).
  PRE_EMI,
  SUPPLIER_RECONCILIATION,
  EV_EBITDA,
  // Written for the search and answer-engine pass (28 Oct), each from its
  // cited primary source, with the worked examples recalculated in the tests.
  CARPET_AREA,
  GST_ON_FLATS,
  VOUCHER_TYPES,
];

/**
 * Whether drafts may be shown: everywhere except the production deployment.
 * Vercel sets VERCEL_ENV to `preview` on a branch's deployment, which is where
 * the owner reads a draft before it is published, and leaves it unset locally.
 */
export function showDrafts(): boolean {
  return process.env.VERCEL_ENV !== 'production';
}

/** What this deployment shows. A guide whose tool is not public is never shown. */
export function visibleGuides(): Guide[] {
  return ALL_GUIDES.filter((g) => (g.status === 'published' || showDrafts()) && agentBySlug(g.tool));
}

/** Only what has been published: what search engines and assistants are told about. */
export function publishedGuides(): Guide[] {
  return ALL_GUIDES.filter((g) => g.status === 'published' && agentBySlug(g.tool));
}

export function guideBySlug(slug: string): Guide | undefined {
  return visibleGuides().find((g) => g.slug === slug);
}

/** The published guides that lead to one tool, for a link from its page. */
export function guidesForTool(slug: string): Guide[] {
  return publishedGuides().filter((g) => g.tool === slug);
}

/** Words in the guide's own text: lead, answer, sections and questions. */
export function guideWords(g: Guide): number {
  return [g.lead, g.answer, ...g.blocks.flatMap(blockText), ...g.faq.flatMap((f) => [f.q, f.a])]
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Minutes to read, at 220 words a minute, rounded up. */
export function readingMinutes(g: Guide): number {
  return Math.max(1, Math.ceil(guideWords(g) / 220));
}

export function blockText(b: Guide['blocks'][number]): string[] {
  switch (b.t) {
    case 'ul':
    case 'ol':
      return b.items;
    case 'table':
      return [b.caption, ...b.head, ...b.rows.flat()];
    case 'note':
      return [b.title, b.text];
    default:
      return [b.text];
  }
}

/** The ids the contents list links to, from each section heading. */
export function sectionId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
