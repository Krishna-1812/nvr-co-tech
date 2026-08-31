import { AGENTS, STAGE_LABEL, agentBySlug } from '@/lib/marketing/content';
import { CARD_SIZE, CARD_TYPE, cardAlt, socialCard } from '@/lib/brand/socialCard';

/**
 * One card per agent, which is the case the whole per-page split was for: eight
 * of the site's twelve public URLs live under this template, and before this
 * every one of them previewed as the home page.
 *
 * The stage is the first chip, and deliberately the first. Six of the eight are
 * not built, and a card that shows a name, a category and a confident dark
 * gradient reads as a product you can go and buy. The page says otherwise in
 * three places; the preview that reaches ten times as many people has to say it
 * too.
 */
export const size = CARD_SIZE;
export const contentType = CARD_TYPE;

export function generateStaticParams() {
  return AGENTS.map((agent) => ({ slug: agent.slug }));
}

type Params = { params: Promise<{ slug: string }> };

const card = (slug: string) => {
  const agent = agentBySlug(slug);
  if (!agent) return null;

  return {
    eyebrow: agent.category,
    headline: agent.name,
    sub: agent.summary,
    chips: [STAGE_LABEL[agent.stage], agent.outputs],
  };
};

export async function generateImageMetadata({ params }: Params) {
  const c = card((await params).slug);
  return [{ id: 'card', size, contentType, alt: c ? cardAlt(c) : undefined }];
}

export default async function Image({ params }: Params) {
  /*
   * An unknown slug cannot reach this in practice — generateStaticParams comes
   * from the same roster, and the page itself calls notFound() — but the route
   * is still reachable by hand, and an OG route has no notFound() to call. The
   * site card is the right thing to serve rather than an error image.
   */
  const c = card((await params).slug) ?? {
    eyebrow: 'The roster',
    headline: 'Tools for the work that follows rules.',
    chips: ['Payments, GST, TDS, bank'],
  };

  return socialCard(c);
}
