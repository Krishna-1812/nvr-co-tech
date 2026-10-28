import { agentBySlug } from '@/lib/marketing/content';
import { CARD_SIZE, CARD_TYPE, cardAlt, socialCard } from '@/lib/brand/socialCard';
import { guideBySlug, readingMinutes, visibleGuides } from '@/lib/guides';

/** One card per guide: its heading, and the tool it leads to. */
export const size = CARD_SIZE;
export const contentType = CARD_TYPE;

export function generateStaticParams() {
  return visibleGuides().map((g) => ({ slug: g.slug }));
}

type Params = { params: Promise<{ slug: string }> };

const card = (slug: string) => {
  const guide = guideBySlug(slug);
  if (!guide) return null;
  return {
    eyebrow: 'Guide',
    headline: guide.title,
    chips: [`${readingMinutes(guide)} min read`, `With ${agentBySlug(guide.tool)?.name ?? 'the tool'}`],
  };
};

export async function generateImageMetadata({ params }: Params) {
  const c = card((await params).slug);
  return [{ id: 'card', size, contentType, alt: c ? cardAlt(c) : undefined }];
}

export default async function Image({ params }: Params) {
  // Unreachable through the site (the page 404s first); the index card is the
  // right thing to serve to a hand-typed URL rather than an error image.
  return socialCard(card((await params).slug) ?? { eyebrow: 'Guides', headline: 'Answers, worked through.', chips: ['Guides'] });
}
