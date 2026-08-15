import {
  Activity,
  ArrowUpRight,
  Compass,
  Gauge,
  MousePointerClick,
  Repeat,
  Users,
} from 'lucide-react';
import {
  byDevice,
  conversionRate,
  daily,
  overview,
  topCampaigns,
  topPages,
  topReferrers,
  webVitals,
} from '@/lib/analytics/aggregate';
import { readVisitorViews } from '@/lib/analytics/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardTitle, EmptyState } from '@/components/ui/primitives';
import { BarList, Split, Trend } from '@/components/analytics/Charts';
import { StatTile, duration, number } from '@/components/analytics/Figures';
import { Vitals } from '@/components/analytics/Vitals';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';

export const metadata = { title: 'Visitor overview' };
export const dynamic = 'force-dynamic';

/**
 * The overview.
 *
 * Ordered by the question somebody actually arrives with, which is "is anything
 * happening" — so the counts and the trend come first, then where the traffic
 * came from, then whether the site itself is holding up. The de-anonymisation
 * lives one screen along under Companies, because it answers a different
 * question and mixing the two produces a dashboard that answers neither.
 *
 * Every figure here excludes bot traffic. Crawlers are counted separately and
 * stated, because "we had four hundred visitors" is worth very little if a
 * hundred and eighty of them were link unfurlers.
 */
export default async function AnalyticsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const days = windowFrom((await searchParams).days);
  const rows = await readVisitorViews(days);

  const totals = overview(rows);
  const series = daily(rows, days);
  const conversion = conversionRate(rows);

  if (totals.pageViews === 0) {
    return (
      <div className="space-y-6">
        <Header days={days} />
        <Card className="overflow-hidden">
          <EmptyState
            icon={<Activity className="size-6" />}
            title="Nothing has been recorded yet"
            description={
              'The tracker runs on every public page and sends one beacon when a visitor leaves it, '
              + 'so the first rows appear a minute or two after the first real visit. Visitors with '
              + 'Do Not Track or Global Privacy Control set are never recorded at all, which is '
              + 'deliberate and will always leave a gap here.'
            }
          />
        </Card>
      </div>
    );
  }

  const returningShare = totals.visitors ? totals.returningVisitors / totals.visitors : 0;

  return (
    <div className="space-y-6">
      <Header days={days} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="People"
          value={number(totals.visitors)}
          hint={`${number(totals.pageViews)} page views across ${number(totals.sessions)} visits`}
          icon={<Users className="size-4" />}
          tone="var(--h-indigo)"
          emphasis
        />
        <StatTile
          label="Came back"
          value={`${Math.round(returningShare * 100)}%`}
          hint={`${number(totals.returningVisitors)} of them had been here before`}
          icon={<Repeat className="size-4" />}
          tone="var(--h-violet)"
        />
        <StatTile
          label="Read one page and left"
          value={`${totals.bounceRate}%`}
          hint={`Of ${number(totals.sessions)} visits, measured on how deep each one got`}
          icon={<Compass className="size-4" />}
          tone="var(--h-amber)"
        />
        <StatTile
          label="Attention per visit"
          value={duration(totals.averageEngaged)}
          hint="Counted only while the tab was in front and something was being touched"
          icon={<Gauge className="size-4" />}
          tone="var(--h-cyan)"
        />
      </section>

      <Card>
        <CardTitle
          icon={<Activity className="size-4" />}
          title="Traffic"
          description={`Page views by day for the last ${days} days. Hover to read one.`}
          action={
            <span className="text-subtle text-[11.5px]">
              {number(totals.botViews)} bot {totals.botViews === 1 ? 'visit' : 'visits'} excluded
            </span>
          }
        />
        <div className="px-5 py-4">
          <Trend points={series} />
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardTitle
            icon={<ArrowUpRight className="size-4" />}
            title="Most read"
            description="Every page view, not one per visit."
          />
          <BarList items={topPages(rows, 8)} tone="var(--h-indigo)" />
        </Card>

        <Card className="overflow-hidden">
          <CardTitle
            icon={<Compass className="size-4" />}
            title="Where they came from"
            description="Referring site, with www stripped so one source is one line."
          />
          <BarList items={topReferrers(rows, 8)} tone="var(--h-violet)" />
        </Card>

        <Card className="overflow-hidden">
          <CardTitle
            icon={<MousePointerClick className="size-4" />}
            title="Campaigns"
            description="Source and campaign, from the UTM tags on the landing URL."
          />
          <BarList
            items={topCampaigns(rows, 6)}
            tone="var(--h-emerald)"
            empty="No visit in this window arrived with a UTM tag."
          />
        </Card>

        <Card className="overflow-hidden">
          <CardTitle
            icon={<Gauge className="size-4" />}
            title="What they were on"
            description="Share of page views by device."
          />
          <Split items={byDevice(rows)} />
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <Card className="overflow-hidden">
          <CardTitle
            icon={<MousePointerClick className="size-4" />}
            title="Got in touch"
            description="A submitted lead form, counted once per person however often they sent it."
          />
          <div className="px-5 py-6 text-center">
            <p className="font-mono text-[2.4rem] leading-none font-semibold tracking-tight tabular-nums">
              {conversion.rate}%
            </p>
            <p className="text-muted mt-3 text-sm text-pretty">
              {number(conversion.converted)} of {number(conversion.visitors)} people asked to be
              contacted.
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardTitle
            icon={<Gauge className="size-4" />}
            title="How the site is holding up"
            description="Measured in real visitors' browsers, not in a lab."
          />
          <Vitals vitals={webVitals(rows)} />
        </Card>
      </section>
    </div>
  );
}

function Header({ days }: { days: number }) {
  return (
    <PageHeader
      eyebrow="Visitor Intelligence"
      title="What is happening on the site"
      description="Measured by our own tracker, on our own origin, into our own database. No Google Analytics and no third-party pixel is involved at any point."
      action={<WindowTabs current={days as 7 | 30 | 90} base="/analytics" />}
    />
  );
}
