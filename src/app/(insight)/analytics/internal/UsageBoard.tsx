'use client';

import { useState } from 'react';
import { Clock3, Link2, Users } from 'lucide-react';
import type { Counted } from '@/lib/analytics/aggregate';
import type { Person, RunEvent } from '@/lib/analytics/people';
import { Card, CardTitle, EmptyState } from '@/components/ui/primitives';
import { BarList } from '@/components/analytics/Charts';
import { duration, number, NUM } from '@/components/analytics/Figures';
import { KpiCard, KpiRow } from '@/components/analytics/Kpi';
import { Chip, ChipRow, Journey } from '@/components/analytics/Journey';
import { Avatar, DeviceTag, PersonCell } from '@/components/analytics/People';
import { Drawer } from '@/components/ui/Drawer';
import { cn } from '@/lib/utils';

/**
 * Staff usage: the simplest of the seven screens, deliberately.
 *
 * No search, no sort, no filters. This page answers one question — is the team
 * actually using the thing they are building — and every control added to it
 * would be a control somebody has to skip past to read the answer. The flagship
 * customer page next door is where the machinery lives, because there the
 * question is "which of these hundred people should I talk to", and that genuinely
 * needs filtering.
 */

type ViewRow = {
  occurred_at: string;
  email: string | null;
  page_title: string | null;
  page_url: string;
  seconds: number;
  device: string | null;
};

export function UsageBoard({
  people,
  totals,
  devices,
  operating,
  facts,
  recentViews,
  recentRuns,
  now,
}: {
  people: Person[];
  totals: {
    people: number;
    visits: number;
    pageViews: number;
    seconds: number;
    linked: number;
    avgPagesBefore: number;
  };
  devices: Counted[];
  operating: Counted[];
  facts: { label: string; value: string }[];
  recentViews: ViewRow[];
  recentRuns: RunEvent[];
  /** The instant the server rendered, so relative times agree across hydration. */
  now: number;
}) {
  const [open, setOpen] = useState<Person | null>(null);
  const [log, setLog] = useState<'views' | 'runs'>('views');

  const busiest = Math.max(1, ...people.map((p) => p.visits));

  return (
    <>
      <KpiRow>
        <KpiCard
          label="Visits"
          value={totals.visits}
          caption={`${number(totals.pageViews)} page views across ${number(totals.people)} people`}
          accent="var(--h-indigo)"
        />
        <KpiCard
          label="People"
          value={totals.people}
          caption="Anyone on the analytics allowlist who opened a page"
          accent="var(--h-violet)"
        />
        <KpiCard
          label="Linked to pre-login"
          value={totals.linked}
          caption={
            totals.linked
              ? `${totals.avgPagesBefore} pages read on average before their first sign-in`
              : 'Nobody here browsed the public site before signing in'
          }
          accent="var(--h-cyan)"
        />
        <KpiCard
          // A string, so it is set rather than counted up — and not clickable,
          // because a total duration has no breakdown worth opening.
          label="Time on screen"
          value={duration(totals.seconds)}
          caption="Summed from what the tracker measured, not from session length"
          accent="var(--h-amber)"
        />
      </KpiRow>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden">
          <CardTitle title="Devices" description="Share of page views." />
          <BarList items={devices} tone="var(--h-indigo)" />
        </Card>
        <Card className="overflow-hidden">
          <CardTitle title="Operating systems" description="Share of page views." />
          <BarList items={operating} tone="var(--h-violet)" />
        </Card>
        <Card className="overflow-hidden">
          <CardTitle title="Quick facts" description="The things worth knowing without scrolling." />
          <dl className="divide-y">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                <dt className="text-subtle text-[12px]">{fact.label}</dt>
                <dd className={cn(NUM, 'text-[12.5px] font-semibold')}>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <CardTitle
          icon={<Users className="size-4" />}
          title="Who"
          description="Most visits first. Click anyone to read their journey."
        />
        {people.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title="No staff activity in this window"
            description="Pages opened by anyone on the analytics allowlist appear here. If this is empty and you have been using the app, check that your address is on that list."
          />
        ) : (
          <ul className="divide-y">
            {people.map((person) => (
              <li key={person.email}>
                <button
                  type="button"
                  onClick={() => setOpen(person)}
                  className="a-ring flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-[var(--surface-sunken)]"
                >
                  <PersonCell
                    email={person.email}
                    name={person.name}
                    photo={person.photo}
                    lastSeen={person.lastSeen}
                    now={now}
                    linked={person.preSignupPages}
                  />
                  <span className="ml-auto flex items-center gap-5">
                    {/* A bar rather than a second number: the question here is
                        who is using it most, which is a comparison. */}
                    <span className="hidden w-24 sm:block">
                      <span className="a-track block h-1 overflow-hidden rounded-full">
                        <span
                          className="a-fill block h-full rounded-full bg-[var(--h-indigo)]"
                          style={{ width: `${(person.visits / busiest) * 100}%` }}
                        />
                      </span>
                    </span>
                    <span className={cn(NUM, 'w-16 text-right text-[12.5px] font-semibold')}>
                      {number(person.visits)}
                      <span className="text-subtle ml-1 text-[10px] font-normal">visits</span>
                    </span>
                    <span className={cn(NUM, 'text-subtle w-16 text-right text-[12px]')}>
                      {duration(person.seconds)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardTitle
          title="The raw log"
          description="Newest first, exactly as recorded."
          action={
            <span className="inline-flex rounded-lg border p-0.5">
              {(['views', 'runs'] as const).map((which) => (
                <button
                  key={which}
                  type="button"
                  onClick={() => setLog(which)}
                  className={cn(
                    'a-ring rounded-[6px] px-2.5 py-1 text-[11.5px] font-medium transition',
                    log === which
                      ? 'bg-[var(--surface-sunken)] text-[var(--text-c)]'
                      : 'text-muted hover:text-[var(--text-c)]',
                  )}
                >
                  {which === 'views' ? 'Page views' : 'Tool runs'}
                </button>
              ))}
            </span>
          }
        />

        {log === 'views' ? (
          recentViews.length === 0 ? (
            <p className="text-subtle px-5 py-8 text-center text-sm">Nothing recorded yet.</p>
          ) : (
            <div className="scroll-x-hint overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-[12px]">
                <thead>
                  <tr className="[&>th]:a-label [&>th]:border-b [&>th]:px-5 [&>th]:pb-2">
                    <th>When</th>
                    <th>Who</th>
                    <th>Page</th>
                    <th className="text-right">Seconds</th>
                    <th>Device</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentViews.map((row, i) => (
                    <tr key={`${row.occurred_at}-${i}`}>
                      <td className={cn(NUM, 'text-subtle px-5 py-2 whitespace-nowrap')}>
                        {stamp(row.occurred_at)}
                      </td>
                      <td className={cn(NUM, 'px-5 py-2')}>{row.email ?? '—'}</td>
                      <td className="max-w-[18rem] truncate px-5 py-2" title={row.page_url}>
                        {row.page_title || row.page_url}
                      </td>
                      <td className={cn(NUM, 'px-5 py-2 text-right')}>{Math.round(row.seconds)}</td>
                      <td className="px-5 py-2">
                        <DeviceTag device={row.device} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : recentRuns.length === 0 ? (
          <p className="text-subtle px-5 py-8 text-center text-sm">
            No tool has been opened by anyone on the allowlist in this window.
          </p>
        ) : (
          <div className="scroll-x-hint overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-[12px]">
              <thead>
                <tr className="[&>th]:a-label [&>th]:border-b [&>th]:px-5 [&>th]:pb-2">
                  <th>When</th>
                  <th>Who</th>
                  <th>Tool</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentRuns.map((row, i) => (
                  <tr key={`${row.created_at}-${i}`}>
                    <td className={cn(NUM, 'text-subtle px-5 py-2 whitespace-nowrap')}>
                      {stamp(row.created_at)}
                    </td>
                    <td className={cn(NUM, 'px-5 py-2')}>{row.email}</td>
                    <td className="px-5 py-2">{row.feature_slug}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open ? (open.name ?? open.email) : ''}
        header={
          open && (
            <>
              <div className="mt-3 flex items-center gap-3">
                <Avatar
                  email={open.email}
                  name={open.name}
                  photo={open.photo}
                  lastSeen={open.lastSeen}
                  now={now}
                  size={44}
                />
                <span className={cn(NUM, 'text-subtle text-[11.5px]')}>{open.email}</span>
              </div>
              <ChipRow>
                <Chip tone="var(--h-indigo)">
                  {number(open.visits)} {open.visits === 1 ? 'visit' : 'visits'}
                </Chip>
                <Chip tone="var(--h-cyan)">{number(open.pageViews)} pages</Chip>
                <Chip tone="var(--h-amber)">
                  <Clock3 className="size-3" aria-hidden />
                  {duration(open.seconds)}
                </Chip>
                {open.preSignupPages > 0 && (
                  <Chip tone="var(--h-lime)">
                    <Link2 className="size-3" aria-hidden />
                    {number(open.preSignupPages)} before signing in
                  </Chip>
                )}
                {open.source && <Chip tone="var(--h-violet)">&#8599; {open.source}</Chip>}
              </ChipRow>
            </>
          )
        }
      >
        {open && (
          <Journey
            events={open.journey}
            empty="Nothing recorded for this person in the window being shown."
          />
        )}
      </Drawer>
    </>
  );
}

const stamp = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
