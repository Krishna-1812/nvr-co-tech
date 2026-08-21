import { PageHeader } from '@/components/PageHeader';
import {
  WHO_LABEL,
  WhoTabs,
  WindowTabs,
  whoFrom,
  windowFrom,
  type Who,
} from '@/components/analytics/Window';
import { duration, number } from '@/components/analytics/Figures';
import {
  buildPeople,
  byEngagement,
  renderedAt,
  splitStaff,
  summarise,
  tally,
} from '@/lib/analytics/people';
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

export const metadata = { title: 'Usage' };
export const dynamic = 'force-dynamic';

/**
 * Everyone signed in, in two halves.
 *
 * ── Why one screen with a segment rather than two screens ───────────────────
 *
 * There were two: Customer usage and Staff usage, reading the same three logs
 * with the allowlist inverted, rendering two different boards over the same
 * vocabulary. The second was the poorer of the two — no search, no filters, no
 * profile drawer — for no reason other than having been built separately.
 *
 * The distinction they encoded is real and is kept: a customer-success figure
 * that quietly folds our own demonstrating and fixing into "adoption" reads as
 * adoption when it is not. What was not real was needing two rail slots and two
 * implementations for it.
 *
 * There is deliberately no "everyone" tab. The combined number is the one that
 * misleads, so it is not offered.
 *
 * ── Why the segment is a URL parameter ──────────────────────────────────────
 *
 * Same reason the date window is. An analytics finding gets sent to somebody,
 * and a screen whose state lives in a `useState` cannot be linked to. It also
 * means the whole page is server-rendered per segment: the reads below are
 * scoped before anything is aggregated, so a figure on the staff tab cannot
 * accidentally include a customer's page view.
 *
 * ── What did not survive the merge ──────────────────────────────────────────
 *
 * The staff screen's raw log — two tables of recent page views and recent tool
 * opens. It answered "what has been happening lately", and the profile drawer
 * already answers "what has this person been doing", which is the question that
 * actually gets asked. Its five quick facts did survive, because they are cheap
 * and three of them need the raw view log that the board itself never sees.
 */
export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; who?: string }>;
}) {
  const params = await searchParams;
  const days = windowFrom(params.days);
  const who = whoFrom(params.who);

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

  const { staff, external } = splitStaff(
    buildPeople({ signedIn, visitor, identities, runs, profiles }),
    staffEmails,
  );

  const staffSet = new Set(staffEmails);
  const isStaff = (email: string | null): boolean =>
    Boolean(email) && staffSet.has(email!.toLowerCase());

  // Scoped before anything is counted, so no figure on one tab can be built
  // from the other tab's rows.
  const mine = who === 'us' ? staff : external;
  const theirViews = signedIn.filter((r) => r.email && isStaff(r.email) === (who === 'us'));
  const theirRuns = allRuns.filter((r) => isStaff(r.email) === (who === 'us'));

  const people = [...mine].sort(byEngagement);
  const totals = summarise(mine);

  /*
   * The five quick facts, inherited from the staff screen.
   *
   * The busiest weekday is the one figure in this section that has ever changed
   * somebody's behaviour: it is when not to deploy.
   */
  const facts = [
    { label: 'Busiest day', value: tally(theirViews.map((r) => r.weekday), 7)[0]?.label ?? '—' },
    {
      label: 'Average per view',
      value: theirViews.length
        ? duration(theirViews.reduce((n, r) => n + (r.seconds || 0), 0) / theirViews.length)
        : '—',
    },
    {
      label: 'Views per person',
      value: totals.people ? (totals.pageViews / totals.people).toFixed(1) : '—',
    },
    { label: 'Tool opens', value: number(theirRuns.length) },
    {
      label: 'Most read',
      value: tally(theirViews.map((r) => r.page_title), 1)[0]?.label ?? '—',
    },
  ];

  const directory = new Map(
    profiles
      .filter((p) => p.email)
      .map((p) => [p.email!.toLowerCase(), { name: p.full_name, photo: p.avatar_url }]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Usage"
        title={who === 'us' ? 'What the team is using' : 'Who is using it'}
        description={DESCRIPTION[who]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <WhoTabs current={who} base="/analytics/external" days={days} />
            <WindowTabs current={days} base="/analytics/external" who={who} />
          </div>
        }
      />

      <PeopleBoard
        people={people}
        totals={totals}
        devices={tally(theirViews.map((r) => r.device))}
        operating={tally(theirViews.map((r) => r.os))}
        companies={tally(mine.map((p) => p.organisation ?? p.company), 12)}
        facts={facts}
        who={who}
        days={days}
        now={renderedAt()}
      />

      <AgentDigest runs={theirRuns} cap={cap} directory={directory} />
    </div>
  );
}

const DESCRIPTION: Record<Who, string> = {
  them:
    'Everyone signed in who is not on the analytics allowlist. Enrichment and the written read are '
    + 'third-party or model-generated and are labelled as such; every other figure here is measured '
    + 'by our own tracker.',
  us:
    'Everyone on the analytics allowlist, and only them. Somebody on our own domain who is not on '
    + `that list counts under ${WHO_LABEL.them}, which is the safer way round to be wrong. Neither `
    + 'tab is ever summed with the other, because the combined figure is the misleading one.',
};
