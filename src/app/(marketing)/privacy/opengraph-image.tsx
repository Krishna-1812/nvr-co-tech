import { CARD_SIZE, CARD_TYPE, cardAlt, socialCard } from '@/lib/brand/socialCard';

/*
 * Its own card, because a page that sets its own link preview (pageMeta) no
 * longer inherits the image from the folder above it.
 */
const CARD = {
  eyebrow: 'Privacy',
  headline: 'How we collect, use and protect information.',
  chips: ['Privacy policy', 'What is collected', 'How it is protected'],
};

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = cardAlt(CARD);

export default function Image() {
  return socialCard(CARD);
}
