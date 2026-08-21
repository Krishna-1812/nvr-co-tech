import {
  ArrowDownWideNarrow,
  Laptop,
  MousePointerClick,
  Send,
  Signpost,
} from 'lucide-react';
import {
  bySystem,
  byBrowser,
  ctaBreakdown,
  formFunnel,
  scrollDepth,
  topLandingPages,
} from '@/lib/analytics/aggregate';
import { readVisitorViews } from '@/lib/analytics/store';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardTitle } from '@/components/ui/primitives';
import { BarList, Funnel, Split } from '@/components/analytics/Charts';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';

export const metadata = { title: 'Behaviour' };
export const dynamic = 'force-dynamic';

/**
 * What people did, as opposed to how many of them there were.
 *
 * The lead funnel goes first because it is the only sequence here that ends in
 * somebody asking to be contacted, which is the only outcome on this screen that
 * a public page exists to produce.
 *
 * ── Three cards were removed, and why ───────────────────────────────────────
 *
 * They were not wrong. They were unmeasurable, which looks the same on screen
 * and is worse, because an empty panel reads as a zero rather than as an absence.
 *
 *   * **The walkthrough video.** There is no video element anywhere on the
 *     marketing site. The tracker has a field for it and nothing ever sets it,
 *     so the card reported no interest in something that does not exist.
 *
 *   * **What they searched for.** The tracker accepts search terms, and the only
 *     search box in the product is the command palette, which is behind
 *     authentication. This screen reads the anonymous log. The two could never
 *     meet.
 *
 *   * **Rage clicks.** The one genuine loss. Two clicks inside 800ms and 32px is
 *     a real signal and it names a specific broken thing on a specific page —
 *     but it needs traffic to rise above coincidence, and at current volumes a
 *     single mis-click would be rendered as a hotspot. Worth restoring when
 *     there are enough visits for the number to mean anything; the aggregation
 *     is still in aggregate.ts, untouched.
 */
export default async function BehaviourPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const days = windowFrom((await searchParams).days);
  const rows = await readVisitorViews(days);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Visitor Intelligence"
        title="How the site is actually used"
        description="Scrolling, clicking, and the one sequence that ends in somebody asking to be contacted. Measured on public pages only, so nothing here includes anybody signed in."
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
            icon={<MousePointerClick className="size-4" />}
            title="What got clicked"
            description="Every tracked call to action, summed across page views rather than counted per row."
          />
          <BarList items={ctaBreakdown(rows).slice(0, 10)} tone="var(--h-emerald)" />
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
    </div>
  );
}
