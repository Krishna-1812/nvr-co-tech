import { PageHeader } from '@/components/PageHeader';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';
import { buildPeople, byEngagement, renderedAt, splitStaff, summarise, tally } from '@/lib/analytics/people';
import {
  readAgentRuns,
  readIdentities,
  readProfileDirectory,
  readSignedInViews,
  readStaffEmails,
  readVisitorViews,
} from '@/lib/analytics/store';
import { PeopleBoard } from './PeopleBoard';

export const metadata = { title: 'Customer usage' };
export const dynamic = 'force-dynamic';

/**
 * Customer usage — everyone signed in who is not on our own team.
 *
 * The mirror image of the staff page, reading the same logs with the allowlist
 * inverted, and then doing considerably more with them: third-party enrichment,
 * a written read of each person, and an ordering by who looks worth a
 * conversation.
 *
 * Default order is engagement rather than recency — tool opens first, then
 * visits, then how recently. Somebody who ran a reconciliation twice last week
 * matters more than somebody who loaded a page an hour ago, and a recency sort
 * puts the second one at the top every time.
 */
export default async function ExternalUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const days = windowFrom((await searchParams).days);

  const [signedIn, visitor, identities, runs, profiles, staffEmails] = await Promise.all([
    readSignedInViews(days),
    readVisitorViews(days),
    readIdentities(),
    readAgentRuns(days),
    readProfileDirectory(),
    readStaffEmails(),
  ]);

  const { external } = splitStaff(
    buildPeople({ signedIn, visitor, identities, runs, profiles }),
    staffEmails,
  );

  const staffSet = new Set(staffEmails);
  const theirViews = signedIn.filter(
    (r) => r.email && !staffSet.has(r.email.toLowerCase()),
  );

  const people = [...external].sort(byEngagement);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customers"
        title="Who is using it, and who to talk to"
        description="Everyone signed in who is not on the analytics allowlist. Enrichment and the written read are both third-party or model-generated and are labelled as such — every other figure here is measured by our own tracker."
        action={<WindowTabs current={days as 7 | 30 | 90} base="/analytics/external" />}
      />

      <PeopleBoard
        people={people}
        totals={summarise(external)}
        devices={tally(theirViews.map((r) => r.device))}
        operating={tally(theirViews.map((r) => r.os))}
        companies={tally(external.map((p) => p.company), 12)}
        days={days}
        now={renderedAt()}
      />
    </div>
  );
}
