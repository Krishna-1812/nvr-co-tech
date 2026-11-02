import { CARD_SIZE, CARD_TYPE, cardAlt, socialCard } from '@/lib/brand/socialCard';

const CARD = {
  eyebrow: 'Free calculators',
  headline: 'The sums, worked on your figures.',
  chips: ['Worked examples', 'Formulas shown', 'No sign-up'],
};

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = cardAlt(CARD);

export default function Image() {
  return socialCard(CARD);
}
