import { CARD_SIZE, CARD_TYPE, cardAlt, socialCard } from '@/lib/brand/socialCard';

const CARD = {
  eyebrow: 'About',
  headline: 'Accountants building their own tools.',
  chips: ['Chartered accountants', 'Rules in the database', 'Built in Mumbai'],
};

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = cardAlt(CARD);

export default function Image() {
  return socialCard(CARD);
}
