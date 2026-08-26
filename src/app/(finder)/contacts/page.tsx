import { KeyRound, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, EmptyState } from '@/components/ui/primitives';
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
 */
export default async function ContactsPage() {
  const configured = !PREVIEW && apolloConfigured();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Contact Finder"
        title="Find the person"
        description="Search live for people and companies by role, seniority, industry or size, or ask a plain question and get an answer built only from what came back."
      />

      <Card>
        {configured ? (
          <EmptyState
            icon={<Search className="size-6" aria-hidden />}
            title="The search panel is being built"
            description="The credential is in place, so this environment can reach the contact database. The filters, the results grid and the chat land next."
          />
        ) : (
          <EmptyState
            icon={<KeyRound className="size-6" aria-hidden />}
            title="No contact database is connected here"
            description={
              PREVIEW
                ? 'Preview mode runs on sample data and never calls a paid service, so nothing on this screen will search for real.'
                : 'APOLLO_API_KEY is not set on this environment. Nothing is broken and nothing is empty: there is simply no credential to search with.'
            }
          />
        )}
      </Card>
    </div>
  );
}
