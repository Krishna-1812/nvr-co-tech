import { Card, CardTitle } from '@/components/ui/primitives';
import { PageHeader } from '@/components/PageHeader';
import { BarList, Funnel, Trend } from '@/components/analytics/Charts';
import { duration, number } from '@/components/analytics/Figures';
import { KpiCard, KpiRow } from '@/components/analytics/Kpi';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';
import { buildPeople, renderedAt, splitStaff, summarise, tally } from '@/lib/analytics/people';
import { readRunCap } from '@/lib/analytics/caps';
import {
  readAllAgentRuns,
  readIdentities,
  readProfileDirectory,
  readSignedInViews,
  readStaffEmails,
  readVisitorViews,
} from '@/lib/analytics/store';
import { MembersBoard } from './MembersBoard';
import { AgentDigest } from './AgentDigest';

export const metadata = { title: 'Members' };
export const dynamic = 'force-dynamic';

/**
 * Everybody who has signed up, and what they did before they did.
 *
 * The mirror of the tenant screen: that one asks how a given organisation is
 * doing, this one asks whether the product is acquiring anybody at all and where
 * from. It is the only screen here that spans both halves of the funnel, which is
 * why the pre-signup linking matters most on it.
 *
 * ── The conversion denominator, which is the one figure here worth arguing about
 *
 * Visitor-to-member excludes staff from the visitor count. Our own people never
 * arrive as anonymous prospects reading the pricing page, so leaving them in the
 * denominator would depress the rate by however much the team happened to browse
 * the public site that month — making the number move for reasons that have
 * nothing to do with acquisition. The rate is stated with its denominator beside
 * it for the same reason: a percentage with no base is trivia.
 */
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const days = windowFrom((await searchParams).days);

  const [signedIn, visitor, identities, runs, profiles, staffEmails, cap] = await Promise.all([
    readSignedInViews(days),
    readVisitorViews(days),
    readIdentities(),
    // Lifetime rather than windowed, to match the allowance the digest reports
    // against. A windowed count would show somebody as having used two of ten
    // when they had in fact used nine.
    readAllAgentRuns(),
    readProfileDirectory(),
    readStaffEmails(),
    readRunCap(),
  ]);

  const everyone = buildPeople({ signedIn, visitor, identities, runs, profiles });
  const { external: members } = splitStaff(everyone, staffEmails);
  const totals = summarise(members);

  const staffSet = new Set(staffEmails);

  /*
   * The visitor denominator: distinct anonymous tracking ids, minus any that
   * belong to a member of staff. Bot rows are already excluded by the store.
   */
  const staffVisitorIds = new Set(
    everyone
      .filter((p) => staffSet.has(p.email))
      .flatMap((p) => p.visitorIds),
  );
  const prospects = new Set(
    visitor
      .filter((row) => !row.is_bot && row.visitor_id && !staffVisitorIds.has(row.visitor_id))
      .map((row) => row.visitor_id),
  );

  const converted = members.filter((m) => m.preSignupPages > 0).length;
  const rate = prospects.size ? Math.round((converted / prospects.size) * 1000) / 10 : 0;

  const engagedBefore = members.filter((m) => m.preSignupPages > 0);

  // One clock read for the whole render, taken through renderedAt for the reason
  // documented there: every relative figure on the page should be measured from
  // the same instant rather than each one asking separately.
  const now = renderedAt();

  // First seen inside the window, so "new" means new to us rather than new to
  // the window's left edge.
  const windowStart = now - days * 86_400_000;
  const newMembers = members.filter((m) => new Date(m.firstSeen).getTime() >= windowStart).length;

  const byDay = new Map<string, { views: number; visitors: Set<string> }>();
  for (let i = days - 1; i >= 0; i -= 1) {
    byDay.set(new Date(now - i * 86_400_000).toISOString().slice(0, 10), {
      views: 0,
      visitors: new Set(),
    });
  }
  for (const row of signedIn) {
    const bucket = byDay.get(row.occurred_on);
    if (bucket) {
      bucket.views += 1;
      if (row.email) bucket.visitors.add(row.email);
    }
  }

  const companies = tally(members.map((m) => m.company), 10);
  const directory = new Map(
    profiles
      .filter((p) => p.email)
      .map((p) => [p.email!.toLowerCase(), { name: p.full_name, photo: p.avatar_url }]),
  );

  const ordered = [...members].sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Members"
        title="Who joined, and what brought them"
        description="Every account, with the browsing that preceded it wherever the tracking cookie survived signing up. Staff are excluded from this view and from the conversion denominator, since they never arrive as anonymous prospects."
        action={<WindowTabs current={days as 7 | 30 | 90} base="/analytics/members" />}
      />

      <KpiRow flow="flex">
        <KpiCard
          label="Members"
          value={totals.people}
          caption={`${number(companies.length)} companies represented`}
          accent="var(--h-violet)"
        />
        <KpiCard
          label="Visits"
          value={totals.visits}
          caption={`${number(totals.pageViews)} page views since joining`}
          accent="var(--h-indigo)"
        />
        <KpiCard
          label="Linked to pre-signup"
          value={totals.linked}
          caption={
            totals.linked
              ? `${totals.avgPagesBefore} pages read on average before joining`
              : 'No member has browsing linked from before they joined'
          }
          accent="var(--h-cyan)"
        />
        <KpiCard
          label="Visitor to member"
          value={`${rate}%`}
          caption={`${number(converted)} of ${number(prospects.size)} tracked prospects, staff excluded`}
          accent="var(--h-emerald)"
        />
        {/*
          Counted, not estimated. An earlier draft of this card showed reading
          time before signing up, derived at half a minute a page — labelled as an
          estimate, and still the wrong thing to put on a dashboard: a figure
          nobody can reconcile against anything, sitting in a row of measured
          ones. New and returning are both real counts.
        */}
        <KpiCard
          label="New in this window"
          value={newMembers}
          caption={`${number(totals.people - newMembers)} were already here before it`}
          accent="var(--h-amber)"
        />
        <KpiCard
          label="Time on screen"
          value={duration(totals.seconds)}
          caption={
            totals.people
              ? `${duration(totals.seconds / totals.people)} each on average`
              : 'Nothing recorded'
          }
          accent="var(--h-lime)"
        />
        <KpiCard
          label="Tool opens"
          value={totals.runs}
          caption={`${number(totals.ranSomething)} members have opened one`}
          accent="var(--h-rose)"
        />
      </KpiRow>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="overflow-hidden">
          <CardTitle
            title="From visitor to member"
            description="Each step counted once per person, not once per session."
          />
          <div className="px-5 py-5">
            <Funnel
              steps={[
                { stage: 'Tracked prospects', sessions: prospects.size },
                { stage: 'Read more than one page', sessions: engagedBefore.length },
                { stage: 'Signed up', sessions: totals.people },
                { stage: 'Came back after joining', sessions: members.filter((m) => m.visits > 1).length },
              ]}
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardTitle title="Activity by day" description="Signed-in page views." />
          <div className="px-5 py-4">
            <Trend
              points={[...byDay.entries()].map(([day, bucket]) => ({
                day,
                views: bucket.views,
                visitors: bucket.visitors.size,
              }))}
            />
          </div>
        </Card>
      </section>

      <MembersBoard members={ordered} now={now} />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden">
          <CardTitle title="Where they came from" description="From their earliest tracked view." />
          <BarList
            items={tally(members.map((m) => m.source), 8)}
            tone="var(--h-cyan)"
            empty="No member has an acquisition source on file."
          />
        </Card>
        <Card className="overflow-hidden">
          <CardTitle title="Companies" description="By members, from the email domain." />
          <BarList items={companies} tone="var(--h-violet)" />
        </Card>
        <Card className="overflow-hidden">
          <CardTitle title="Devices" description="Most recent per member." />
          <BarList items={tally(members.map((m) => m.device))} tone="var(--h-indigo)" />
        </Card>
      </section>

      <AgentDigest runs={runs} cap={cap} directory={directory} />
    </div>
  );
}
