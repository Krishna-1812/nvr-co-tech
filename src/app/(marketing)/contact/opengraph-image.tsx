import { CARD_SIZE, CARD_TYPE, cardAlt, socialCard } from '@/lib/brand/socialCard';

const CARD = {
  eyebrow: 'Contact',
  headline: 'Book a walkthrough.',
  sub: 'Half an hour with the people who built it, using the tool that is actually running.',
  chips: ['A person, not a ticket', 'Nothing to install', 'One working day'],
};

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = cardAlt(CARD);

export default function Image() {
  return socialCard(CARD);
}
