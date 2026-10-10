import { ActivityBoard } from '@/components/finder/Activity';

export const metadata = { title: 'Activity · Contact Finder' };

/**
 * What Contact Finder has already done.
 *
 * No credential gate, unlike the search screen next door. Everything here is
 * read out of our own tables — the history, the working list and the credit
 * ledger — and none of it touches Apollo. Hiding it when APOLLO_API_KEY is
 * missing would hide a record of money already spent because the key that spent
 * it has since been removed, which is exactly backwards.
 *
 * The layout gate above still applies: this route sits inside `(finder)`, so the
 * same short list decides who may read it.
 *
 * No page heading: the board opens with a hero whose title is the month's spend,
 * which only the client has once its requests land, and a heading above that
 * would be a second title saying less.
 */
export default function ContactActivityPage() {
  return <ActivityBoard />;
}
