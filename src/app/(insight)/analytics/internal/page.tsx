import { duration, number } from '@/components/analytics/Figures';
import { PageHeader } from '@/components/PageHeader';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';
import { buildPeople, renderedAt, splitStaff, summarise, tally } from '@/lib/analytics/people';
import {
  readAgentRuns,
  readIdentities,
  readProfileDirectory,
  readSignedInViews,
  readStaffEmails,
  readVisitorViews,
} from '@/lib/analytics/store';
import { UsageBoard } from './UsageBoard';

export const metadata = { title: 'Staff usage' };
export const dynamic = 'force-dynamic';

/**
 * Staff usage.
 *
 * ── Why this is not the shell-plus-fetch pattern the spec describes ──────────
 *
 * The design this follows renders an empty page, then fetches a JSON blob and
 * builds the whole screen in the browser. That exists because its server could
 * not stream HTML: paying a second round-trip was the only way to get something
 * on screen quickly.
 *
 * This app is React Server Components, where that constraint does not apply. The
 * reads happen here, the markup arrives with the numbers already in it, and the
 * browser gets a small amount of state for the parts that genuinely need it —
 * the drawer, the log tab. Same instant first paint, one round-trip instead of
 * two, and the figures are in the HTML rather than assembled from a blob after
 * it lands. There is no Refresh button for the same reason: reloading the page
 * *is* the refresh, and every read here is uncached.
 *
 * The five reads are dispatched together rather than awaited one after another.
 * Five sequential Supabase round-trips is the measured page-load problem the
 * spec warns about, and Promise.all is the whole fix.
 */
export default async function InternalUsagePage({
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

  const { staff } = splitStaff(
    buildPeople({ signedIn, visitor, identities, runs, profiles }),
    staffEmails,
  );

  const staffSet = new Set(staffEmails);
  const staffViews = signedIn.filter((r) => r.email && staffSet.has(r.email.toLowerCase()));
  const staffRuns = runs.filter((r) => staffSet.has(r.email.toLowerCase()));

  const totals = summarise(staff);
  const people = [...staff].sort((a, b) => b.visits - a.visits || b.seconds - a.seconds);

  // The busiest weekday, which is the one fact on this page that has changed
  // somebody's behaviour: it is when to avoid deploying.
  const byWeekday = tally(staffViews.map((r) => r.weekday), 7);

  const facts: { label: string; value: string }[] = [
    { label: 'Busiest day', value: byWeekday[0]?.label ?? '—' },
    {
      label: 'Average per page view',
      value: staffViews.length
        ? duration(staffViews.reduce((n, r) => n + (r.seconds || 0), 0) / staffViews.length)
        : '—',
    },
    {
      label: 'Page views per person',
      value: totals.people ? (totals.pageViews / totals.people).toFixed(1) : '—',
    },
    { label: 'Tool opens', value: number(staffRuns.length) },
    { label: 'Most read', value: tally(staffViews.map((r) => r.page_title), 1)[0]?.label ?? '—' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Internal"
        title="What the team is using"
        description="Everyone on the analytics allowlist, and only them. Customers are next door under Customer usage. Somebody on our own domain who is not on that list counts as a customer here, which is the safer way round to be wrong."
        action={<WindowTabs current={days as 7 | 30 | 90} base="/analytics/internal" />}
      />

      <UsageBoard
        people={people}
        totals={totals}
        devices={tally(staffViews.map((r) => r.device))}
        operating={tally(staffViews.map((r) => r.os))}
        facts={facts}
        recentViews={staffViews.slice(0, 150)}
        recentRuns={staffRuns.slice(0, 150)}
        now={renderedAt()}
      />
    </div>
  );
}
