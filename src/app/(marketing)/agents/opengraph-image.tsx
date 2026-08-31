import { CARD_SIZE, CARD_TYPE, cardAlt, socialCard } from '@/lib/brand/socialCard';

/**
 * The roster card.
 *
 * No counts on it. A card that says "two are live" after a third has shipped is
 * a stale claim sitting in every Slack thread anybody ever pasted the link into,
 * and the site does not state the count anywhere any more.
 */
const CARD = {
  eyebrow: 'The roster',
  headline: 'Tools for the work that follows rules.',
  chips: [
    'Payments, GST, TDS, bank',
    'Approvals and audit trail',
    'Rules in the database',
  ],
};

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = cardAlt(CARD);

export default function Image() {
  return socialCard(CARD);
}
