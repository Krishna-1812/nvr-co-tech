import Link from 'next/link';
import {
  ArrowDownWideNarrow,
  Laptop,
  LogIn,
  MousePointerClick,
  Radar,
  Send,
  Signpost,
} from 'lucide-react';
import {
  byBrowser,
  bySystem,
  byVisitor,
  ctaBreakdown,
  formFunnel,
  scrollDepth,
  summarise,
  topLandingPages,
} from '@/lib/analytics/aggregate';
import { readSignedInViews, readVisitorViews } from '@/lib/analytics/store';
import { readGraph, resolveFromGraph } from '@/lib/analytics/graph';
import { resolveVisitors } from '@/lib/analytics/resolve';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardTitle, DataTable, EmptyState, Td, Th, Thead, Tr } from '@/components/ui/primitives';
import { BarList, Funnel, Split } from '@/components/analytics/Charts';
import { Confidence, Identity } from '@/components/analytics/Company';
import { IntentBadge } from '@/components/analytics/Intent';
import { NUM, Pill, ago, duration, number } from '@/components/analytics/Figures';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Public site' };
export const dynamic = 'force-dynamic';

/**
 * The public site: who came, and what they did once they were here.
 *
 * ── Two screens became one ──────────────────────────────────────────────────
 *
 * Visitors listed the sessions; Behaviour described what happened inside them.
 * Both read the same anonymous log, both were about the marketing site, and
 * neither was large enough to justify its own place in the rail — particularly
 * once the company column stopped naming companies, which was most of what made
 * the first one feel important.
 *
 * The route did not move, so the per-session drill-down underneath it is
 * untouched: /analytics/visitors/[id] is still where a single journey is read.
 *
 * ── Every person the site saw, with both overlays on the same row.
 *
 * The two questions are different and the answers come from different places.
 * "Who is this" is answered by the identity graph, and only ever from proof —
 * a login, a form, a webhook. "What company are they from" is answered by the
 * address, and only ever when the connection type allows it. A row can have
 * either, both, or neither, and neither is the ordinary case.
 *
 * The column that makes the whole thing worth building is the last one: whether
 * this browser later signed in. That is the pre-login journey stitched to the
 * post-login one, and it is the reason the visitor id lives in a cookie as well
 * as in localStorage — the server can read a cookie on the request that carries
 * the sign-in, and it cannot read localStorage at all.
 *
 * ── The behaviour half ──────────────────────────────────────────────────────
 *
 * Below the table, and in that order deliberately: the funnel is the only
 * sequence on this screen that ends in somebody asking to be contacted, and the
 * rest describe how the site is read. Three of Behaviour's cards did not come
 * across, all for being unmeasurable rather than wrong — the walkthrough video
 * (there is no video element on the site), search terms (the only search box is
 * the command palette, which is behind authentication while this reads the
 * anonymous log) and rage clicks (a real signal that needs traffic to rise above
 * coincidence; the aggregation is still in aggregate.ts).
 */
export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const days = windowFrom((await searchParams).days);

  const [rows, signedIn, graph] = await Promise.all([
    readVisitorViews(days),
    readSignedInViews(days),
    readGraph(),
  ]);

  const summaries = [...byVisitor(rows).values()]
    .map(summarise)
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, 200);

  const records = await resolveVisitors(summaries);

  // Which of these browsers has been seen carrying a session, and as whom.
  const signedInAs = new Map<string, string>();
  for (const view of signedIn) {
    if (view.visitor_id && view.email) signedInAs.set(view.visitor_id, view.email);
  }

  if (records.length === 0) {
    return (
      <div className="space-y-6">
        <Header days={days} />
        <Card className="overflow-hidden">
          <EmptyState
            icon={<Radar className="size-6" />}
            title="No visitors in this window"
            description="Widen the window, or wait for the first beacon. Nothing is recorded for anybody who has Do Not Track or Global Privacy Control switched on."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header days={days} />

      <Card className="overflow-hidden">
        <CardTitle
          icon={<Radar className="size-4" />}
          title={`${number(records.length)} ${records.length === 1 ? 'person' : 'people'}`}
          description="Most recent first. Open one to read their whole journey and exactly why it did or did not resolve."
        />

        <DataTable>
          <Thead>
            <tr>
              <Th>Who</Th>
              <Th>Came from</Th>
              <Th align="right">Visits</Th>
              <Th align="right">Pages</Th>
              <Th align="right">Attention</Th>
              <Th>Confidence</Th>
              <Th>Intent</Th>
              <Th align="right">Last seen</Th>
            </tr>
          </Thead>
          <tbody className="divide-y">
            {records.map((record) => {
              const person = resolveFromGraph(graph, record.summary.visitorId);
              const email = signedInAs.get(record.summary.visitorId);

              return (
                <Tr key={record.summary.visitorId}>
                  <Td>
                    <Link
                      href={`/analytics/visitors/${encodeURIComponent(record.summary.visitorId)}`}
                      className="block rounded-lg outline-offset-2"
                    >
                      <Identity
                        resolution={record.resolution}
                        company={record.company}
                        person={person}
                        compact
                      />
                    </Link>
                  </Td>

                  <Td>
                    <span className="block max-w-[13rem] truncate text-[12.5px]">
                      {record.summary.referrer}
                    </span>
                    {record.summary.campaign && (
                      <span className="text-subtle block max-w-[13rem] truncate text-[11px]">
                        {record.summary.campaign}
                      </span>
                    )}
                  </Td>

                  <Td align="right" className={NUM}>
                    {number(record.summary.sessions)}
                  </Td>
                  <Td align="right" className={NUM}>
                    {number(record.summary.views)}
                  </Td>
                  <Td align="right" className={cn(NUM, 'whitespace-nowrap')}>
                    {duration(record.summary.engagedSeconds)}
                  </Td>

                  <Td>
                    {record.resolution ? (
                      <Confidence resolution={record.resolution} />
                    ) : (
                      <span className="text-subtle text-[11.5px]">No address</span>
                    )}
                  </Td>

                  <Td>
                    <div className="flex flex-col items-start gap-1.5">
                      <IntentBadge intent={record.intent} />
                      {email && (
                        <Pill tone="var(--status-approved)" title={`Later signed in as ${email}`}>
                          <LogIn className="size-3" aria-hidden />
                          Signed in
                        </Pill>
                      )}
                    </div>
                  </Td>

                  <Td align="right" className="text-subtle text-[11.5px] whitespace-nowrap">
                    {ago(record.summary.lastSeen)}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </DataTable>
      </Card>

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

function Header({ days }: { days: number }) {
  return (
    <PageHeader
      eyebrow="Public site"
      title="Who came by, and what they did"
      description="One row per browser, then how the site itself was used. Who somebody is comes only from proof they gave us. A company name appears only when the address itself named one — a reverse DNS record somebody configured on purpose — and never when it was reconstructed from an organisation name, which is what this screen used to do."
      action={<WindowTabs current={days as 7 | 30 | 90} base="/analytics/visitors" />}
    />
  );
}
