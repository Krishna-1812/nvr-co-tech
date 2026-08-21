import { PageHeader } from '@/components/PageHeader';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';
import { buildPeople, byEngagement, renderedAt, splitStaff, summarise, tally } from '@/lib/analytics/people';
import { readRunCap } from '@/lib/analytics/caps';
import {
  readAgentRuns,
  readAllAgentRuns,
  readIdentities,
  readProfileDirectory,
  readSignedInViews,
  readStaffEmails,
  readVisitorViews,
} from '@/lib/analytics/store';
import { AgentDigest } from '@/components/analytics/AgentDigest';
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
 *
 * ── Why the Members screen is gone and its contents are here ────────────────
 *
 * There were two customer rosters. This one, and a Members screen that listed
 * the same people in the same table, differing only in what they had read before
 * signing up — a figure that needs a marketing funnel to be interesting, and
 * this product has invite-only onboarding. Two rosters of one population is how
 * two screens start disagreeing about a number.
 *
 * What Members had that this did not was the tool-usage digest, so that moved
 * here rather than being deleted with it, and it kept its lifetime run count:
 * the allowance it reports against is lifetime, and a windowed count would tell
 * somebody they had used two of ten when they had used nine.
 */
export default async function ExternalUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const days = windowFrom((await searchParams).days);

  const [signedIn, visitor, identities, runs, allRuns, profiles, staffEmails, cap] =
    await Promise.all([
      readSignedInViews(days),
      readVisitorViews(days),
      readIdentities(),
      readAgentRuns(days),
      readAllAgentRuns(),
      readProfileDirectory(),
      readStaffEmails(),
      readRunCap(),
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

  // Names and photographs for the digest, which works off run rows and has only
  // an address to go on otherwise.
  const directory = new Map(
    profiles
      .filter((p) => p.email)
      .map((p) => [p.email!.toLowerCase(), { name: p.full_name, photo: p.avatar_url }]),
  );

  // Customers only, matching the roster above it. Staff tool usage has its own
  // screen and folding it in here would inflate every figure on this page.
  const customerRuns = allRuns.filter((r) => !staffSet.has(r.email.toLowerCase()));

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
        companies={tally(external.map((p) => p.organisation ?? p.company), 12)}
        days={days}
        now={renderedAt()}
      />

      <AgentDigest runs={customerRuns} cap={cap} directory={directory} />
    </div>
  );
}
