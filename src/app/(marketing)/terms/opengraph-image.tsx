import { CARD_SIZE, CARD_TYPE, cardAlt, socialCard } from '@/lib/brand/socialCard';

/*
 * Its own card, because a page that sets its own link preview (pageMeta) no
 * longer inherits the image from the folder above it.
 */
const CARD = {
  eyebrow: 'Terms',
  headline: 'The terms of use for the site and its tools.',
  chips: ['Terms of use', 'The website', 'The tools'],
};

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = cardAlt(CARD);

export default function Image() {
  return socialCard(CARD);
}
