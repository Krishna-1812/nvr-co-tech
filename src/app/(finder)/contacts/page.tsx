import Link from 'next/link';
import { History, KeyRound, MessagesSquare, SlidersHorizontal, Wand2 } from 'lucide-react';
import { buttonClass } from '@/components/ui/primitives';
import { HeroChip, ToolHero } from '@/components/ui/ToolHero';
import { ArchScene } from '@/components/ui/Scene';
import { Workspace } from '@/components/finder/Workspace';
import { apolloConfigured } from '@/lib/finder/apollo/config';
import { PREVIEW } from '@/lib/preview';

export const metadata = { title: 'Contact Finder' };

/**
 * Contact Finder.
 *
 * ── What this screen is going to be ────────────────────────────────────────
 *
 * Two coupled surfaces over the same data: a filter panel that runs live
 * searches, and a chat that answers a plain question by deciding in code which
 * searches to run and then phrasing the answer strictly from what came back.
 * They are one screen rather than two because they are two ways of asking the
 * same thing, and because the answer to a chat question is very often "now
 * refine that in the filters".
 *
 * ── Why the screen will keep telling you what it removed ───────────────────
 *
 * The vendor behind this exposes parameters that read as filters and behave as
 * relevance hints: asking for a healthcare company returns a meditation app,
 * asking for 100 to 2000 employees returns a company with 51. So the shape of
 * this whole tool is: ask broadly, guarantee the answer here in code, and say
 * out loud what was dropped and why. A search that fetched 24 rows and shows 18
 * will say which six went and which filter took them, with each reason a control
 * that removes that filter and runs it again.
 *
 * The other half of the same idea: never let "we could not look" and "there is
 * nothing there" share a code path. A refused credential, a rate limit and a
 * genuinely empty result are three different facts, and only one of them is
 * about the world.
 *
 * ── Where the heading went ─────────────────────────────────────────────────
 *
 * The workspace opens with its own hero, because what that hero says depends on
 * state only the client holds — the live count of the filters as they are set.
 * A page heading above it would be a second title saying less.
 */
export default async function ContactsPage() {
  const configured = !PREVIEW && apolloConfigured();

  return configured ? (
    <Workspace />
  ) : (
    /*
     * Not connected. Still the tool's own opening rather than an empty card,
     * because this is the screen somebody lands on from the rail and it should
     * say what the tool is before it says what is missing — and the one place
     * that still works without a key, the record of what was already done, is
     * one click away.
     */
    <ToolHero
      label="Contact Finder"
      pill={{ icon: KeyRound, text: 'Not connected', tone: 'var(--status-pending)' }}
      title="No contact database is connected here."
      sub={
        PREVIEW
          ? 'Preview mode runs on sample data and never calls a paid service, so nothing on this screen will search for real.'
          : 'APOLLO_API_KEY is not set on this environment. Nothing is broken and nothing is empty: there is simply no credential to search with.'
      }
      scene={<ArchScene motif="seekers" className="h-full min-h-[17rem]" />}
    >
      <div className="mt-7 flex flex-wrap gap-2">
        <HeroChip icon={Wand2}>Describe who you want in a sentence</HeroChip>
        <HeroChip icon={SlidersHorizontal}>Narrow by role, seniority, industry or size</HeroChip>
        <HeroChip icon={MessagesSquare}>Ask a plain question about a company</HeroChip>
      </div>
      <div className="mt-7 flex flex-wrap gap-2.5">
        <Link href="/contacts/activity" className={buttonClass({ className: 'group' })}>
          <History className="size-4" aria-hidden />
          Searches already run
        </Link>
      </div>
    </ToolHero>
  );
}
