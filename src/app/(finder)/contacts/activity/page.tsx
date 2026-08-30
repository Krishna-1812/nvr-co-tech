import Link from 'next/link';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
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
 */
export default function ContactActivityPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Contact Finder"
        title="Activity"
        description="Searches you have run, the rows you kept out of them, and what the credits went on. Reopening a search from here costs nothing — it returns the rows you already paid for rather than running it again."
        action={
          <Link
            href="/contacts"
            className="gradient-brand elev-brand inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition hover:brightness-110"
          >
            <Search className="size-4" aria-hidden />
            New search
          </Link>
        }
      />

      <ActivityBoard />
    </div>
  );
}
