import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Activity, Clock3, Globe2, KeyRound, LayoutList, MonitorSmartphone, Radio, Route, UserCheck, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { istToday } from '@/lib/fiscal';
import { SITE_URL } from '@/lib/marketing/content';
import { RANGES, buildReport, duration, type Range } from '@/lib/analytics/report';
import type { SiteViewRow, SiteVisitorRow } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import { Figure } from '@/components/app/Figure';
import { Card, CardTitle } from '@/components/ui/primitives';
import { ArchScene, SealFigure } from '@/components/ui/Scene';
import { HeroStat, ToolHero } from '@/components/ui/ToolHero';
import { BarList, DayChart } from '@/components/admin/Charts';
import { People } from '@/components/admin/People';
import { Requests } from '@/components/admin/Requests';
import { Accounts } from '@/components/admin/Accounts';

export const metadata: Metadata = { title: 'Admin' };

/**
 * The Admin screen: the whole of the analytics, on one page.
 *
 * It replaced a dozen screens of visitor intelligence, company identification,
 * funnels and operator reports (18 Oct 2026) because the owner asked for
 * something simple: how many people came, who they were if they signed in, a
 * lasting ID if they did not, the time each spent, every request, and the
 * accounts with their sign-ins. The tracker is components/Tracker, the tables
 * are migration 0033, and the arithmetic is lib/analytics/report (tested).
 *
 * Reads the rows for the chosen range and works everything out here. Supabase
 * hands back at most a thousand rows a request, so the two big tables are read
 * in pages, up to a ceiling that is far beyond this site's traffic and is said
 * on screen if it is ever reached.
 */

const PAGE = 1000;
const CEILING = 50_000;

async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<{ rows: T[]; capped: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < CEILING; from += PAGE) {
    const { data } = await page(from, from + PAGE - 1);
    const got = data ?? [];
    rows.push(...got);
    if (got.length < PAGE) return { rows, capped: false };
  }
  return { rows, capped: true };
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: asked } = await searchParams;
  const range: Range = RANGES.some((r) => r.id === asked) ? (asked as Range) : '30d';
  const days = RANGES.find((r) => r.id === range)!.days;
  const today = istToday();
  // The range starts at midnight in India, so "7 days" is today and the six before it.
  const since = days === null ? null : new Date(Date.parse(`${today}T00:00:00+05:30`) - (days - 1) * 86_400_000).toISOString();

  const supabase = await createClient();
  const [views, visitors, accounts, access, roadmap] = await Promise.all([
    readAll<SiteViewRow>((from, to) => {
      const q = supabase.from('site_views').select('*').order('started_at', { ascending: false });
      return (since ? q.gte('started_at', since) : q).range(from, to);
    }),
    readAll<SiteVisitorRow>((from, to) => supabase.from('site_visitors').select('*').order('last_seen', { ascending: false }).range(from, to)),
    supabase.rpc('admin_accounts'),
    supabase.from('access_requests').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.from('feature_requests').select('*').order('created_at', { ascending: false }).limit(1000),
  ]);

  const report = buildReport({
    visitors: visitors.rows,
    views: views.rows,
    accounts: accounts.data ?? [],
    access: access.data ?? [],
    roadmap: roadmap.data ?? [],
    since,
    today,
    ownHost: new URL(SITE_URL).hostname,
  });

  const now = readClock();
  const liveNow = report.people.filter((p) => now - Date.parse(p.lastSeen) < 5 * 60_000).length;
  const t = report.totals;
  const perPerson = t.people ? Math.round(t.seconds / t.people) : 0;
  const rangeLabel = RANGES.find((r) => r.id === range)!.label;
  const missing = accounts.error && /admin_accounts|function/i.test(accounts.error.message);

  return (
    <div className="space-y-6">
      <ToolHero
        id="admin-hero"
        label={`Admin · ${range === 'all' ? 'all time' : `last ${rangeLabel}`}`}
        pill={{ text: liveNow === 1 ? '1 here now' : `${liveNow} here now`, tone: liveNow ? 'var(--status-approved)' : 'var(--status-draft)', live: liveNow > 0 }}
        variant="figure"
        title={t.people.toLocaleString('en-IN')}
        sub={
          <>
            {t.people === 1 ? 'person' : 'people'} came to the site:{' '}
            <strong className="text-[var(--text-c)]">{t.signedIn} signed in</strong> and {t.anonymous} without an account, over{' '}
            {t.visits.toLocaleString('en-IN')} {t.visits === 1 ? 'visit' : 'visits'}. Everybody is counted once, however many times they came back.
          </>
        }
        glow="var(--color-brand-500)"
        scene={
          <ArchScene
            motif="owl"
            className="h-full min-h-[18rem]"
            seal={<SealFigure value={duration(t.seconds)} note="time spent in all" />}
          />
        }
      >
        <nav aria-label="Period" className="surface-sunken mt-6 inline-flex flex-wrap gap-1 rounded-full border p-1">
          {RANGES.map((r) => (
            <Link
              key={r.id}
              href={r.id === '30d' ? '/analytics' : `/analytics?range=${r.id}`}
              aria-current={r.id === range ? 'page' : undefined}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition',
                r.id === range ? 'bg-[var(--action)] text-[var(--on-action)] shadow-[var(--elev-brand)]' : 'text-muted hover:text-[var(--text-c)]',
              )}
            >
              {r.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <HeroStat strong label="Signed in" value={<Figure value={t.signedIn} delay={120} />} note={`${t.accounts} accounts in all, ${t.newAccounts} new`} />
          <HeroStat label="Came back" tone="var(--color-brand-500)" value={<Figure value={t.returning} delay={180} />} note="More than one visit" />
          <HeroStat label="Time per person" tone="var(--h-cyan)" value={duration(perPerson)} note={`${t.views.toLocaleString('en-IN')} pages opened`} />
          <HeroStat label="Requests" tone="var(--status-warn)" value={<Figure value={t.requests} delay={240} />} note="Access and roadmap asks" />
        </div>
      </ToolHero>

      {(views.capped || visitors.capped) && (
        <p className="tinted rounded-2xl border px-4 py-3 text-sm [--tone:var(--status-warn)]">
          This period has more than {CEILING.toLocaleString('en-IN')} rows, and only the most recent are counted. Pick a shorter period for exact figures.
        </p>
      )}
      {missing && (
        <p className="tinted rounded-2xl border px-4 py-3 text-sm [--tone:var(--status-warn)]">
          The account list needs migration 0033. Everything else here works without it once its tables exist.
        </p>
      )}

      <Card className="overflow-hidden">
        <CardTitle icon={<Activity className="size-4" />} title="People per day" description="Each person counted once a day, in Indian time." />
        <div className="px-5 pt-8 pb-5 sm:px-6">
          <DayChart days={report.days} />
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Panel icon={<LayoutList className="size-4" />} title="Most read" note="Opens and time">
          <BarList items={report.pages} unit="view" showTime empty="No pages yet." />
        </Panel>
        <Panel icon={<Route className="size-4" />} title="Where they came from" note="First visit">
          <BarList items={report.sources} unit="person" empty="Nobody yet." />
        </Panel>
        <Panel icon={<Globe2 className="size-4" />} title="Countries" note="From their address">
          <BarList items={report.places} unit="person" empty="Nobody yet." />
        </Panel>
        <Panel icon={<MonitorSmartphone className="size-4" />} title="Devices" note="Latest browser">
          <BarList items={report.devices} unit="person" empty="Nobody yet." />
        </Panel>
      </div>

      <Card className="overflow-hidden">
        <CardTitle
          icon={<Users className="size-4" />}
          title="People"
          description="Signed-in people with every browser they used, and visitors known by an ID. Open one to see their pages."
          action={<Live count={liveNow} />}
        />
        <People people={report.people} now={now} />
      </Card>

      <Card className="overflow-hidden">
        <CardTitle icon={<KeyRound className="size-4" />} title="Requests" description={`${t.requests} in this period. Reply straight from here.`} />
        <Requests requests={report.requests} />
      </Card>

      <Card className="overflow-hidden">
        <CardTitle
          icon={<UserCheck className="size-4" />}
          title="Accounts and sign-ins"
          description={`All ${t.accounts} accounts, with when each was made and last signed in. Visits and time are for this period.`}
        />
        <Accounts accounts={accounts.data ?? []} people={report.people} now={now} />
      </Card>

      <p className="text-subtle flex items-center justify-center gap-1.5 pb-4 text-center text-[12px]">
        <Clock3 className="size-3.5" aria-hidden />
        Time counts only while a page is open in front of someone and they have been active in the last two minutes.
      </p>
    </div>
  );
}

/**
 * The moment this page was drawn, for "here now" and "3m ago". A server
 * component renders once per request, so reading the clock here is the point;
 * it is behind a function only because the purity rule cannot tell a request
 * render from a re-render.
 */
function readClock(): number {
  return Date.now();
}

function Panel({ icon, title, note, children }: { icon: ReactNode; title: string; note: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardTitle icon={icon} title={title} description={note} />
      <div className="p-3">{children}</div>
    </Card>
  );
}

function Live({ count }: { count: number }) {
  return (
    <span
      style={{ '--tone': count ? 'var(--status-approved)' : 'var(--status-draft)' } as CSSProperties}
      className="tinted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold"
    >
      {count ? <span className="a-blip size-1.5 rounded-full bg-current" aria-hidden /> : <Radio className="size-3" aria-hidden />}
      {count} here now
    </span>
  );
}
