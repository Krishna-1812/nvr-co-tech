import { CARD_SIZE, CARD_TYPE, cardAlt, socialCard } from '@/lib/brand/socialCard';

const CARD = {
  eyebrow: 'Glossary',
  headline: 'Finance terms, in plain words.',
  chips: ['Property', 'Income tax', 'Valuation'],
};

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = cardAlt(CARD);

export default function Image() {
  return socialCard(CARD);
}
