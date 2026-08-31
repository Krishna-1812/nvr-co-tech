import { ROSTER } from '@/lib/marketing/content';
import { CARD_SIZE, CARD_TYPE, cardAlt, socialCard } from '@/lib/brand/socialCard';

/**
 * The roster card.
 *
 * The counts are read from ROSTER rather than written down, because a card that
 * says "two are live" after a third has shipped is a stale claim sitting in
 * every Slack thread anybody ever pasted the link into.
 */
const CARD = {
  eyebrow: 'The roster',
  headline: 'Tools for the work that follows rules.',
  chips: [
    `${ROSTER.live} live today`,
    `${ROSTER.coming} on the way`,
    'Payments, GST, TDS, bank',
  ],
};

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = cardAlt(CARD);

export default function Image() {
  return socialCard(CARD);
}
