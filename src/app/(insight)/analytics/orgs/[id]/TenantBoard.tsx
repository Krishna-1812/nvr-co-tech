'use client';

import { useState } from 'react';
import { Clock3, Eye, KeyRound, LogIn, Users, Wrench, Activity } from 'lucide-react';
import type { Person } from '@/lib/analytics/people';
import type { Segment, TenantDetail } from '@/lib/analytics/tenants';
import { Card, CardTitle } from '@/components/ui/primitives';
import { Drawer } from '@/components/ui/Drawer';
import { duration, number, NUM } from '@/components/analytics/Figures';
import { KpiCard, KpiRow } from '@/components/analytics/Kpi';
import { Chip, ChipRow, Journey } from '@/components/analytics/Journey';
import { Avatar, PersonCell } from '@/components/analytics/People';
import { cn } from '@/lib/utils';

/**
 * One tenant, and whether the activity in it is theirs or ours.
 *
 * The seven cards are laid out with flex-wrap rather than a grid, and that is not
 * a stylistic preference: seven items in a four-column grid leaves three stranded
 * on a last row beside a hole. Flex-wrap lets a short final row stretch to fill
 * the width, so the block reads as finished at every viewport instead of only at
 * the ones that happen to divide evenly.
 */

const METRICS = [
  { key: 'visits', label: 'Visits' },
  { key: 'pageViews', label: 'Page views' },
  { key: 'runs', label: 'Tool opens' },
] as const;

type MetricKey = (typeof METRICS)[number]['key'];

const SEGMENT_LABEL: Record<Segment, string> = {
  them: 'Their own people',
  us: 'Us, inside their account',
};

const SEGMENT_NOTE: Record<Segment, string> = {
  them: 'Everybody in this organisation who is not on our analytics allowlist.',
  us: 'Our own staff, working inside this account. Counted apart so it cannot read as their adoption.',
};

export function TenantBoard({
  detail,
  perDay,
  days,
  now,
}: {
  detail: TenantDetail;
  perDay: { day: string; them: number; us: number }[];
  days: number;
  now: number;
}) {
  const [open, setOpen] = useState<Person | null>(null);
  const [list, setList] = useState<{ title: string; people: Person[] } | null>(null);

  const everyone = [...detail.segments.them, ...detail.segments.us];
  const accent = detail.accent;

  return (
    <>
      <KpiRow flow="flex">
        <KpiCard
          label="Page views"
          value={detail.pageViews}
          caption={`Over the last ${days} days`}
          accent="var(--h-indigo)"
          variant="rich"
          icon={<Eye className="size-4" />}
          onClick={() => setList({ title: 'Everybody in this organisation', people: everyone })}
        />
        <KpiCard
          label="People"
          value={detail.people}
          caption={`${number(detail.segments.us.length)} of them are us`}
          accent="var(--h-violet)"
          variant="rich"
          icon={<Users className="size-4" />}
          onClick={() => setList({ title: 'Everybody in this organisation', people: everyone })}
        />
        <KpiCard
          label="Visits"
          value={detail.visits}
          caption="Activity separated by a gap of half an hour"
          accent="var(--h-amber)"
          variant="rich"
          icon={<KeyRound className="size-4" />}
        />
        <KpiCard
          label="Tool opens"
          value={detail.runs}
          caption="Reconciliations saved and questions answered"
          accent="var(--h-emerald)"
          variant="rich"
          icon={<Wrench className="size-4" />}
        />
        <KpiCard
          label="Time on screen"
          value={duration(detail.seconds)}
          caption="Measured by the tracker"
          accent="var(--h-cyan)"
          variant="rich"
          icon={<Clock3 className="size-4" />}
        />
        <KpiCard
          label="First activity"
          value={detail.firstSeen ? day(detail.firstSeen) : 'Never'}
          caption="The earliest thing anybody here did"
          accent="var(--h-lime)"
          variant="rich"
          icon={<LogIn className="size-4" />}
        />
        <KpiCard
          label="Last activity"
          value={detail.lastSeen ? day(detail.lastSeen) : 'Never'}
          caption="The most recent"
          accent="var(--h-rose)"
          variant="rich"
          icon={<Activity className="size-4" />}
        />
      </KpiRow>

      <section className="grid gap-4 lg:grid-cols-2">
        {(['them', 'us'] as const).map((segment) => (
          <SegmentPanel
            key={segment}
            segment={segment}
            people={detail.segments[segment]}
            accent={segment === 'them' ? accent : 'var(--h-indigo)'}
            now={now}
            onPick={setOpen}
          />
        ))}
      </section>

      <Card className="overflow-hidden">
        <CardTitle
          title="Activity per day"
          description="Their people below, ours above, so genuine use is the part nearest the axis."
        />
        <div className="px-5 py-5">
          <StackedDays rows={perDay} accent={accent} />
        </div>
      </Card>

      {/* One drawer, two modes: a list of people, or one person. */}
      <Drawer
        open={Boolean(open) || Boolean(list)}
        onClose={() => {
          setOpen(null);
          setList(null);
        }}
        title={open ? (open.name ?? open.email) : (list?.title ?? '')}
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
                <Chip tone="var(--h-indigo)">{number(open.visits)} visits</Chip>
                <Chip tone="var(--h-cyan)">{number(open.pageViews)} pages</Chip>
                <Chip tone="var(--h-emerald)">{number(open.runs)} tool opens</Chip>
                <Chip tone="var(--h-amber)">{duration(open.seconds)}</Chip>
              </ChipRow>
            </>
          )
        }
      >
        {open ? (
          <>
            {list && (
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="a-ring text-muted -ml-1 mb-3 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-[11.5px] font-medium transition hover:text-[var(--text-c)]"
              >
                <span aria-hidden>&larr;</span>
                Back to {list.title.toLowerCase()}
              </button>
            )}
            <Journey events={open.journey} />
          </>
        ) : (
          <ul className="space-y-1.5">
            {(list?.people ?? []).map((person) => (
              <li key={person.email}>
                <button
                  type="button"
                  onClick={() => setOpen(person)}
                  className="a-ring flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition hover:bg-[var(--surface-sunken)]"
                >
                  <PersonCell
                    email={person.email}
                    name={person.name}
                    photo={person.photo}
                    lastSeen={person.lastSeen}
                    now={now}
                  />
                  <span className={cn(NUM, 'text-subtle ml-auto shrink-0 text-[11.5px]')}>
                    {number(person.pageViews)} pages
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </>
  );
}

/**
 * One segment, with its own metric switcher.
 *
 * The tabs carry the totals rather than sitting above them, which is the detail
 * worth keeping: the label and the figure are the same object, so there is no
 * way to show a number under a heading that does not describe it. Choosing a tab
 * also re-sorts the list, because "who does the most of this" is the only
 * question a metric is being chosen to answer.
 */
function SegmentPanel({
  segment,
  people,
  accent,
  now,
  onPick,
}: {
  segment: Segment;
  people: Person[];
  accent: string;
  now: number;
  onPick: (person: Person) => void;
}) {
  const [metric, setMetric] = useState<MetricKey>('pageViews');

  const totals = {
    visits: people.reduce((n, p) => n + p.visits, 0),
    pageViews: people.reduce((n, p) => n + p.pageViews, 0),
    runs: people.reduce((n, p) => n + p.runs, 0),
  };

  const sorted = [...people].sort((a, b) => b[metric] - a[metric]);
  const peak = Math.max(1, ...people.map((p) => p[metric]));

  return (
    <Card className="flex flex-col overflow-hidden" style={{ ['--tone' as string]: accent }}>
      <div className="border-b px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: accent }} />
              <span className="truncate text-[13.5px] font-semibold">{SEGMENT_LABEL[segment]}</span>
            </span>
            <span className="text-subtle mt-1.5 block text-[11.5px] leading-snug text-pretty">
              {SEGMENT_NOTE[segment]}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className={cn(NUM, 'block text-[15px] font-semibold')}>{number(people.length)}</span>
            <span className="a-label text-[9px]">people</span>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {METRICS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setMetric(option.key)}
              aria-pressed={metric === option.key}
              className={cn(
                'a-ring rounded-lg border px-2 py-1.5 text-left transition',
                metric === option.key
                  ? 'border-[color-mix(in_oklab,var(--tone)_40%,var(--border-c))] bg-[color-mix(in_oklab,var(--tone)_8%,transparent)]'
                  : 'text-muted hover:bg-[var(--surface-sunken)]',
              )}
            >
              <span className={cn(NUM, 'block text-[14px] font-semibold')}>
                {number(totals[option.key])}
              </span>
              <span className="a-label text-[9px]">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-subtle px-5 py-8 text-center text-[12.5px]">
          {segment === 'them'
            ? 'Nobody from this organisation has done anything in this window.'
            : 'None of our own people have been in this account.'}
        </p>
      ) : (
        <ul className="max-h-80 flex-1 divide-y overflow-y-auto">
          {sorted.map((person) => (
            <li key={person.email}>
              <button
                type="button"
                onClick={() => onPick(person)}
                className="a-ring flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-[var(--surface-sunken)]"
              >
                <PersonCell
                  email={person.email}
                  name={person.name}
                  photo={person.photo}
                  lastSeen={person.lastSeen}
                  now={now}
                />
                <span className="ml-auto flex shrink-0 items-center gap-3">
                  <span className="a-track hidden h-1 w-16 overflow-hidden rounded-full sm:block">
                    <span
                      className="a-fill block h-full rounded-full"
                      style={{ width: `${(person[metric] / peak) * 100}%`, background: accent }}
                    />
                  </span>
                  <span className={cn(NUM, 'w-10 text-right text-[12px] font-semibold')}>
                    {number(person[metric])}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Days as stacked columns. Their share sits at the bottom, ours on top. */
function StackedDays({
  rows,
  accent,
}: {
  rows: { day: string; them: number; us: number }[];
  accent: string;
}) {
  const peak = Math.max(1, ...rows.map((r) => r.them + r.us));

  return (
    <>
      <div className="flex h-32 items-end gap-[3px]">
        {rows.map((row) => {
          const total = row.them + row.us;

          return (
            <span
              key={row.day}
              title={`${row.day} · ${row.them} theirs, ${row.us} ours`}
              className="group relative flex flex-1 flex-col justify-end"
              style={{ height: '100%' }}
            >
              <span
                className="a-fill-y block w-full rounded-t-[2px]"
                style={{ height: `${(row.us / peak) * 100}%`, background: 'var(--h-indigo)' }}
              />
              <span
                className="a-fill-y block w-full"
                style={{
                  height: `${(row.them / peak) * 100}%`,
                  background: accent,
                  borderRadius: row.us === 0 ? '2px 2px 0 0' : 0,
                }}
              />
              {total === 0 && (
                <span className="a-track block h-[2px] w-full rounded-full" aria-hidden />
              )}
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4">
        <Legend tone={accent} label="Their people" />
        <Legend tone="var(--h-indigo)" label="Us" />
      </div>
    </>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="text-subtle inline-flex items-center gap-1.5 text-[10.5px]">
      <span aria-hidden className="size-2 rounded-sm" style={{ background: tone }} />
      {label}
    </span>
  );
}

const day = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
