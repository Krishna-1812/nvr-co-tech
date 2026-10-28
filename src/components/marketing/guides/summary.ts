import { agentBySlug, type Agent } from '@/lib/marketing/content';
import { readingMinutes, type Guide } from '@/lib/guides';
import { ACCENT, ACCENT_TEXT, ON_ACCENT } from '../bits';

/**
 * What a card needs to know about a guide, and nothing more.
 *
 * The cards are drawn by client components (the filter, the deck), and a
 * guide's whole text has no business in the browser bundle of a page that only
 * shows its title. So the server reduces each guide to this, and only this
 * crosses to the client.
 */
export type GuideCard = {
  slug: string;
  n: string;
  title: string;
  lead: string;
  topic: string;
  minutes: number;
  figure: Guide['figure'];
  motif: Guide['motif'];
  tool: string;
  toolSlug: string;
  color: string;
  colorText: string;
  onColor: string;
};

export function toCard(g: Guide, index: number): GuideCard {
  const tool = agentBySlug(g.tool) as Agent;
  return {
    slug: g.slug,
    n: String(index + 1).padStart(2, '0'),
    title: g.title,
    lead: g.lead,
    topic: tool.category,
    minutes: readingMinutes(g),
    figure: g.figure,
    motif: g.motif,
    tool: tool.name,
    toolSlug: tool.slug,
    color: ACCENT[tool.accent],
    colorText: ACCENT_TEXT[tool.accent],
    onColor: ON_ACCENT[tool.accent],
  };
}
