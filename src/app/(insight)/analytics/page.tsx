import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Compass,
  Gauge,
  Inbox,
  Radar,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  byDevice,
  conversionRate,
  daily,
  overview,
  topPages,
  topReferrers,
  webVitals,
} from '@/lib/analytics/aggregate';
import {
  readProductEvents,
  readStuckVouchers,
  readVisitorViews,
} from '@/lib/analytics/store';
import { activation } from '@/lib/analytics/funnel';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardTitle, EmptyState } from '@/components/ui/primitives';
import { BarList, Split, Trend } from '@/components/analytics/Charts';
import { duration, number } from '@/components/analytics/Figures';
import { KpiCard, KpiRow } from '@/components/analytics/Kpi';
import { Vitals } from '@/components/analytics/Vitals';
import { WindowTabs, windowFrom } from '@/components/analytics/Window';

export const metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

/**
 * The front door, for a section that now has eight screens behind it.
 *
 * It used to be the visitor overview and nothing else, which was right when
 * visitors were all this section covered. There are now two halves — people who
 * are not signed in, and people who are — and an entry point that showed only one
 * of them left the other findable by luck.
 *
 * ── Why the cards link out instead of opening drawers ───────────────────────
 *
 * The design this follows opens a panel from each card with a breakdown inside
 * it. Here, most of those breakdowns already exist as whole screens, built for
 * exactly the question the card raises. Sending somebody to the real thing beats
 * rebuilding a smaller version of it in a drawer, and — the part that matters
 * more — it keeps one implementation of each number instead of two that drift
 * apart. Cards whose answer is not a screen are not clickable at all.
 *
 * ── What is deliberately not computed here ──────────────────────────────────
 *
 * Company resolution. Turning an address into a company means reverse DNS, a
 * registry lookup and a paid API, and doing it for every visitor on the section's
 * front page would make the cheapest screen the most expensive one. The card
 * counts companies we know by name from an explicit identity capture — which is
 * free, deterministic, and never a guess — and points at Companies for the
 * resolved view.
 */
export default async function AnalyticsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const days = windowFrom((await searchParams).days);

  const [rows, events, stuck] = await Promise.all([
    readVisitorViews(days),
    readProductEvents(),
    readStuckVouchers(14),
  ]);

  const totals = overview(rows);

  /*
   * The product row, computed before the early return below, because it is the
   * half of this page that does not depend on there being any traffic. A brand
   * new deployment with tenants and no marketing visitors used to render an
   * empty state on this screen and say nothing about the tenants.
   */
  const funnel = activation(events);
  const waiting = stuck.reduce((n, row) => n + row.waiting, 0);
  const product = (
    <KpiRow flow="flex">
      <KpiCard
        label="Signed up"
        value={funnel[0]?.reached ?? 0}
        caption="Accounts that exist, counted by the database itself rather than by the app."
        accent="var(--h-indigo)"
        href="/analytics/activation"
      />
      <KpiCard
        label="Started a workspace"
        value={funnel[1]?.reached ?? 0}
        caption={
          funnel[1]?.fromPrevious === null
            ? 'Nobody has onboarded yet.'
            : `${funnel[1]?.fromPrevious}% of the people who signed up.`
        }
        accent="var(--h-violet)"
        href="/analytics/activation"
      />
      <KpiCard
        label="Ever submitted a voucher"
        value={funnel[3]?.reached ?? 0}
        caption="Organisations that got past every validation. The line between trying it and using it."
        accent="var(--h-emerald)"
        href="/analytics/activation"
      />
      <KpiCard
        label="Waiting on somebody"
        value={waiting}
        caption={
          waiting === 0
            ? 'Nothing has sat in one state for a fortnight.'
            : 'Vouchers stuck for more than a fortnight. Nothing emails the person holding them.'
        }
        accent={waiting > 0 ? 'var(--status-rejected)' : 'var(--h-lime)'}
        href="/analytics/activation"
      />
    </KpiRow>
  );

  if (totals.pageViews === 0) {
    return (
      <div className="space-y-6">
        <Header days={days} />
        {product}
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
        <Directory />
      </div>
    );
  }

  const conversion = conversionRate(rows);

  return (
    <div className="space-y-6">
      <Header days={days} />

      {product}

      {/*
        * Traffic, second and smaller.
        *
        * It used to be first and ten cards long, five of which could not move:
        * two counted things that do not exist on the site, and three counted
        * de-anonymisation that has since been switched off for being wrong. What
        * is left is the four figures that describe the public site honestly, plus
        * the one conversion it exists to produce.
        */}
      <KpiRow flow="flex">
        <KpiCard
          label="Page views"
          value={totals.pageViews}
          caption={`${number(totals.botViews)} bot ${totals.botViews === 1 ? 'visit' : 'visits'} excluded from every figure here`}
          accent="var(--h-cyan)"
        />
        <KpiCard
          label="People"
          value={totals.visitors}
          caption={`${number(totals.newVisitors)} new · ${number(totals.returningVisitors)} came back`}
          accent="var(--h-amber)"
          href={`/analytics/visitors?days=${days}`}
        />
        <KpiCard
          label="Visits"
          value={totals.sessions}
          caption={`${totals.bounceRate}% read one page and left`}
          accent="var(--h-rose)"
          href={`/analytics/visitors?days=${days}`}
        />
        <KpiCard
          label="Attention per visit"
          value={duration(totals.averageEngaged)}
          caption="Counted only while the tab was in front and something was being touched"
          accent="var(--h-magenta)"
        />
        <KpiCard
          label="Asked to be contacted"
          value={conversion.converted}
          caption={`${conversion.rate}% of ${number(conversion.visitors)} people`}
          accent="var(--h-lime)"
          href="/analytics/requests"
        />
      </KpiRow>

      <Card>
        <CardTitle
          icon={<Activity className="size-4" />}
          title="Traffic"
          description={`Page views by day for the last ${days} days. Hover to read one.`}
        />
        <div className="px-5 py-4">
          <Trend points={daily(rows, days)} />
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
            icon={<Gauge className="size-4" />}
            title="What they were on"
            description="Share of page views by device."
          />
          <Split items={byDevice(rows)} />
        </Card>
      </section>

      <Card className="overflow-hidden">
        <CardTitle
          icon={<Gauge className="size-4" />}
          title="How the site is holding up"
          description="Measured in real visitors' browsers, not in a lab."
        />
        <Vitals vitals={webVitals(rows)} />
      </Card>

      <Directory />
    </div>
  );
}

function Header({ days }: { days: number }) {
  return (
    <PageHeader
      eyebrow="Overview"
      title="What is happening"
      description="The product first, the public site second. Everything here is measured by our own tracker, on our own origin, into our own database. There is no Google Analytics and no third-party pixel, and anybody sending Do Not Track is never recorded at all."
      action={<WindowTabs current={days as 7 | 30 | 90} base="/analytics" />}
    />
  );
}

/**
 * The other seven screens, said out loud.
 *
 * A rail of nav items is fine once you know what is on it, and useless the first
 * time. This is the same list with a sentence each, so the section is legible to
 * somebody who has not used it before — and it is grouped by the one distinction
 * that actually organises this material: whether we know who the person is.
 */
const AREAS = [
  {
    group: 'Whether the product works',
    items: [
      { href: '/analytics/activation', label: 'Activation', icon: TrendingUp, note: 'Signups to workspaces to first submitted voucher, how long each step of the workflow takes, and what has stopped moving because nobody was told.' },
      { href: '/analytics/external', label: 'Usage', icon: Users, note: 'Everyone signed in, with a toggle between customers and our own team. The two are never summed, because the combined figure is the misleading one.' },
      { href: '/analytics/orgs', label: 'Organisations', icon: Building2, note: 'Per tenant, ranked by work done rather than pages read. Counts only — no voucher amount, vendor or number reaches these screens.' },
    ],
  },
  {
    group: 'Who is asking, and what is breaking',
    items: [
      { href: '/analytics/requests', label: 'Access requests', icon: Inbox, note: 'Real inbound from people who typed their own details. The highest signal-to-noise screen here.' },
      { href: '/analytics/errors', label: 'Errors', icon: AlertTriangle, note: 'Every failure a page boundary or a route handler caught, newest first.' },
    ],
  },
  {
    group: 'The public site',
    items: [
      { href: '/analytics/visitors', label: 'Public site', icon: Radar, note: 'Anonymous sessions, the lead funnel, what got clicked and how far down people read. A company name appears only when the address itself named one.' },
    ],
  },
] as const;

function Directory() {
  return (
    <section className="space-y-5">
      {AREAS.map((area) => (
        <div key={area.group}>
          <h2 className="a-label mb-3">{area.group}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {area.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="hover-lift a-ring group flex h-full gap-3 rounded-xl border bg-[var(--surface-raised)] p-4"
                >
                  <span
                    aria-hidden
                    className="text-muted surface-sunken mt-px grid size-8 shrink-0 place-items-center rounded-lg border"
                  >
                    <item.icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-[13px] font-semibold">
                      {item.label}
                      <ArrowUpRight
                        className="size-3 opacity-0 transition group-hover:opacity-100"
                        aria-hidden
                      />
                    </span>
                    <span className="text-subtle mt-1 block text-[11.5px] leading-snug text-pretty">
                      {item.note}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
