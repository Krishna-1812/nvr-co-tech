import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  Building2,
  Compass,
  Gauge,
  Inbox,
  MousePointerClick,
  Radar,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  byDevice,
  conversionRate,
  ctaBreakdown,
  daily,
  overview,
  topCampaigns,
  topPages,
  topReferrers,
  videoPlays,
  webVitals,
} from '@/lib/analytics/aggregate';
import { readIdentities, readSignedInViews, readVisitorViews } from '@/lib/analytics/store';
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

  const [rows, signedIn, identities] = await Promise.all([
    readVisitorViews(days),
    readSignedInViews(days),
    readIdentities(),
  ]);

  const totals = overview(rows);

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
        <Directory />
      </div>
    );
  }

  const conversion = conversionRate(rows);
  const video = videoPlays(rows);

  const signUpClicks = ctaBreakdown(rows)
    .filter((item) => /sign|start|try|create/i.test(item.label))
    .reduce((n, item) => n + item.count, 0);

  /*
   * Anonymous visitors who later turned out to be somebody. Deterministic in
   * both directions: either their tracking id appears against a signed-in page
   * view, or an identity row names them outright. No inference.
   */
  const knownIds = new Set<string>([
    ...signedIn.map((r) => r.visitor_id).filter((v): v is string => Boolean(v)),
    ...identities.map((r) => r.visitor_id),
  ]);
  const signedInLater = new Set(
    rows
      .filter((r) => !r.is_bot && r.visitor_id && knownIds.has(r.visitor_id))
      .map((r) => r.visitor_id),
  ).size;

  const namedPeople = new Set(
    identities.map((r) => r.email?.toLowerCase()).filter(Boolean),
  ).size;
  const namedCompanies = new Set(
    identities.map((r) => r.company?.trim().toLowerCase()).filter(Boolean),
  ).size;

  const share = (n: number): string =>
    totals.visitors ? `${Math.round((n / totals.visitors) * 1000) / 10}% of visitors` : '—';

  return (
    <div className="space-y-6">
      <Header days={days} />

      <KpiRow flow="flex">
        <KpiCard
          label="Page views"
          value={totals.pageViews}
          caption={`${number(totals.botViews)} bot ${totals.botViews === 1 ? 'visit' : 'visits'} excluded from every figure here`}
          accent="var(--h-indigo)"
        />
        <KpiCard
          label="People"
          value={totals.visitors}
          caption={`${number(totals.newVisitors)} new · ${number(totals.returningVisitors)} came back`}
          accent="var(--h-violet)"
          href={`/analytics/visitors?days=${days}`}
        />
        <KpiCard
          label="Visits"
          value={totals.sessions}
          caption={`${totals.bounceRate}% read one page and left`}
          accent="var(--h-cyan)"
          href={`/analytics/visitors?days=${days}`}
        />
        <KpiCard
          label="Attention per visit"
          value={duration(totals.averageEngaged)}
          caption="Counted only while the tab was in front and something was being touched"
          accent="var(--h-amber)"
        />
        <KpiCard
          label="Clicked sign up"
          value={signUpClicks}
          caption={share(signUpClicks)}
          accent="var(--h-lime)"
          href={`/analytics/behaviour?days=${days}`}
        />
        <KpiCard
          label="Asked to be contacted"
          value={conversion.converted}
          caption={`${conversion.rate}% of ${number(conversion.visitors)} people`}
          accent="var(--h-emerald)"
          href="/analytics/requests"
        />
        <KpiCard
          label="Watched the video"
          value={video.sessions}
          caption={share(video.sessions)}
          accent="var(--h-rose)"
          href={`/analytics/behaviour?days=${days}`}
        />
        <KpiCard
          label="Signed in later"
          value={signedInLater}
          caption={`${share(signedInLater)}, linked by their own tracking id`}
          accent="var(--h-magenta)"
          href={`/analytics/members?days=${days}`}
        />
        <KpiCard
          label="Named outright"
          value={namedPeople}
          caption="From a form they filled in, never inferred from an address"
          accent="var(--h-violet)"
          href={`/analytics/visitors?days=${days}`}
        />
        <KpiCard
          label="Companies named"
          value={namedCompanies}
          caption="Told to us directly. Resolved companies are on the Companies screen."
          accent="var(--h-indigo)"
          href={`/analytics/companies?days=${days}`}
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
      eyebrow="Visitor Intelligence"
      title="What is happening"
      description="Measured by our own tracker, on our own origin, into our own database. No Google Analytics and no third-party pixel is involved at any point, and anybody sending Do Not Track is never recorded."
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
    group: 'Before we know who they are',
    items: [
      { href: '/analytics/visitors', label: 'Visitors', icon: Radar, note: 'Every anonymous session, with an intent score and whatever we could resolve about it.' },
      { href: '/analytics/companies', label: 'Companies', icon: Building2, note: 'Addresses resolved to real organisations, and never for an ISP, mobile or hosting range.' },
      { href: '/analytics/behaviour', label: 'Behaviour', icon: MousePointerClick, note: 'Scrolling, clicking, searching, rage clicks and the lead form funnel.' },
    ],
  },
  {
    group: 'Once they have an account',
    items: [
      { href: '/analytics/members', label: 'Members', icon: Users, note: 'Everybody who signed up, and what they read before they did.' },
      { href: '/analytics/external', label: 'Customer usage', icon: Sparkles, note: 'The full roster, with enrichment, a written read and a ranking by who looks worth a conversation.' },
      { href: '/analytics/orgs', label: 'Organisations', icon: Building2, note: 'Per tenant, split into their people and ours, so adoption is not inflated by us.' },
      { href: '/analytics/internal', label: 'Staff usage', icon: Compass, note: 'What the team itself is doing. Allowlist only.' },
      { href: '/analytics/agents', label: 'Tool usage', icon: Gauge, note: 'Opens per person per tool, against the allowance.' },
      { href: '/analytics/requests', label: 'Access requests', icon: Inbox, note: 'Who has asked to be let in, and which tools people are asking for.' },
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
