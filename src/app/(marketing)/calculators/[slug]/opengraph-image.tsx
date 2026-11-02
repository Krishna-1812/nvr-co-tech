import { CARD_SIZE, CARD_TYPE, cardAlt, socialCard } from '@/lib/brand/socialCard';
import { CALCULATORS, calculatorBySlug } from '@/lib/calculators';

/** One card per calculator: its name, and what it is for. */
export const size = CARD_SIZE;
export const contentType = CARD_TYPE;

export function generateStaticParams() {
  return CALCULATORS.map((c) => ({ slug: c.slug }));
}

type Params = { params: Promise<{ slug: string }> };

const card = (slug: string) => {
  const c = calculatorBySlug(slug);
  if (!c) return null;
  return { eyebrow: `Free calculator · ${c.topic}`, headline: c.name, chips: ['Worked example', 'Formulas shown', 'No sign-up'] };
};

export async function generateImageMetadata({ params }: Params) {
  const c = card((await params).slug);
  return [{ id: 'card', size, contentType, alt: c ? cardAlt(c) : undefined }];
}

export default async function Image({ params }: Params) {
  // Unreachable through the site (the page 404s first); the index card suits a hand-typed URL.
  return socialCard(card((await params).slug) ?? { eyebrow: 'Free calculators', headline: 'The sums, worked on your figures.', chips: ['No sign-up'] });
}
