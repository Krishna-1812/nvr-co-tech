import { BRAND } from '@/lib/marketing/content';
import { CARD_SIZE, CARD_TYPE, cardAlt, socialCard } from '@/lib/brand/socialCard';

/**
 * The home card, and the one every public page falls back to if it has none of
 * its own — which today is only /privacy and /terms, where a link preview is
 * about the site rather than about the clause.
 */
const CARD = {
  eyebrow: BRAND.tagline,
  headline: 'We handle the repetitive work. You make the calls.',
  chips: ['Payments, GST, TDS, bank', 'One set of records', 'Hosted in Mumbai'],
};

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = cardAlt(CARD);

export default function Image() {
  return socialCard(CARD);
}
