import {
  ArrowDownWideNarrow,
  Flame,
  Laptop,
  MousePointerClick,
  PlayCircle,
  Search,
  Send,
  Signpost,
} from 'lucide-react';
import {
  bySystem,
  byBrowser,
  ctaBreakdown,
  formFunnel,
  rageHotspots,
  scrollDepth,
  searchTerms,
  topLandingPages,
  videoPlays,
} from '@/lib/analytics/aggregate';
import { readVisitorViews } from '@/lib/analytics/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardTitle } from '@/components/ui/primitives';
import { BarList, Funnel, Split } from '@/components/analytics/Charts';
import { number } from '@/components/analytics/Figures';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';

export const metadata = { title: 'Behaviour' };
export const dynamic = 'force-dynamic';

/**
 * What people did, as opposed to how many of them there were.
 *
 * Two things on this screen are worth more than the rest and are placed
 * accordingly. The lead funnel is the only sequence here that ends in money, so
 * it goes at the top. Rage clicks go near it because they are the one metric on
 * any of these screens that names a specific broken thing on a specific page —
 * everything else describes, and that one accuses.
 *
 * The search terms are the quiet favourite: they are a list of what people
 * expected to find and could not, written in their own words.
 */
export default async function BehaviourPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const days = windowFrom((await searchParams).days);
  const rows = await readVisitorViews(days);

  const video = videoPlays(rows);
  const rage = rageHotspots(rows);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Visitor Intelligence"
        title="How the site is actually used"
        description="Scrolling, clicking, searching, and the one sequence that ends in somebody asking to be contacted."
        action={<WindowTabs current={days as 7 | 30 | 90} base="/analytics/behaviour" />}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardTitle
            icon={<Send className="size-4" />}
            title="The lead funnel"
            description="Counted per visit, and cumulative: anybody who sent the form also opened it."
          />
          <Funnel steps={formFunnel(rows)} />
        </Card>

        <Card className="overflow-hidden">
          <CardTitle
            icon={<Flame className="size-4" />}
            title="Rage clicks"
            description="Two clicks inside 800ms and 32px of each other. Something is not responding."
          />
          <BarList
            items={rage}
            tone="var(--status-rejected)"
            empty="Nobody has clicked at anything twice in frustration. Take the win."
          />
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardTitle
            icon={<MousePointerClick className="size-4" />}
            title="What got clicked"
            description="Every tracked call to action, summed across page views rather than counted per row."
          />
          <BarList items={ctaBreakdown(rows).slice(0, 10)} tone="var(--h-emerald)" />
        </Card>

        <Card className="overflow-hidden">
          <CardTitle
            icon={<Search className="size-4" />}
            title="What they searched for"
            description="Typed into a search box on the site. A list of things people expected to find."
          />
          <BarList
            items={searchTerms(rows, 10)}
            tone="var(--h-cyan)"
            empty="Nobody has used a search box in this window."
          />
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardTitle
            icon={<ArrowDownWideNarrow className="size-4" />}
            title="How far down they got"
            description="The furthest point reached on a page, bucketed. A page with nothing to scroll counts as read."
          />
          <Split items={scrollDepth(rows)} />
        </Card>

        <Card className="overflow-hidden">
          <CardTitle
            icon={<Signpost className="size-4" />}
            title="Where visits began"
            description="One landing page per visit, so a long visit does not vote for its entrance repeatedly."
          />
          <BarList items={topLandingPages(rows, 8)} tone="var(--h-amber)" />
        </Card>

        <Card className="overflow-hidden">
          <CardTitle
            icon={<Laptop className="size-4" />}
            title="Browsers"
            description="Read from the request header rather than from anything the page claimed."
          />
          <Split items={byBrowser(rows)} />
        </Card>

        <Card className="overflow-hidden">
          <CardTitle icon={<Laptop className="size-4" />} title="Systems" description="Same source." />
          <Split items={bySystem(rows)} />
        </Card>
      </section>

      <Card className="overflow-hidden">
        <CardTitle
          icon={<PlayCircle className="size-4" />}
          title="The walkthrough video"
          description={
            video.sessions === 0
              ? 'Nobody has opened it in this window.'
              : `Opened in ${number(video.sessions)} ${video.sessions === 1 ? 'visit' : 'visits'}, most often from these pages.`
          }
        />
        {video.sessions > 0 && <BarList items={video.pages} tone="var(--h-magenta)" />}
      </Card>
    </div>
  );
}
