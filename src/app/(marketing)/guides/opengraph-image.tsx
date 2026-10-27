import { CARD_SIZE, CARD_TYPE, cardAlt, socialCard } from '@/lib/brand/socialCard';

const CARD = {
  eyebrow: 'Guides',
  headline: 'Answers, worked through.',
  chips: ['Worked examples', 'Plain language', 'The tool that does it'],
};

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = cardAlt(CARD);

export default function Image() {
  return socialCard(CARD);
}
