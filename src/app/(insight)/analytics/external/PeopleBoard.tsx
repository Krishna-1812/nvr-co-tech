'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock3, Search, Sparkles } from 'lucide-react';
import type { Counted } from '@/lib/analytics/aggregate';
import type { Person } from '@/lib/analytics/people';
import { haystack } from '@/lib/analytics/people';
import type { EnrichedPerson } from '@/app/actions/insight';
import { enrichPeople, sortPeopleByAi } from '@/app/actions/insight';
import { Card, CardTitle, EmptyState, Input, Select } from '@/components/ui/primitives';
import { BarList } from '@/components/analytics/Charts';
import { duration, number, NUM } from '@/components/analytics/Figures';
import { KpiCard, KpiRow } from '@/components/analytics/Kpi';
import {
  ChipWithBar,
  CompanyCell,
  DeviceCell,
  NumChip,
  PersonCell,
  Roster,
  RosterHead,
  RosterRow,
  RosterTd,
  RosterTh,
  SourcePill,
  WhenCell,
} from '@/components/analytics/People';
import { Profile } from './Profile';
import { cn } from '@/lib/utils';

/**
 * Customer usage: the flagship.
 *
 * ── The sort hazard, and why it is not a hazard here ────────────────────────
 *
 * The design this follows reorders live DOM rows on sort, because each row had
 * its index baked into an inline click handler at render time — so re-rendering
 * the table would have left row three opening person three of the *old* order.
 * That is a real bug and it is worth knowing about.
 *
 * It cannot happen in this implementation, and not by luck: rows are rendered
 * from a derived array and each row's handler closes over the person object
 * itself, not over a position in a list. Sorting produces a new array, React
 * reconciles by the email key, and every handler still points at the person it
 * was created for. The requirement the original was protecting is met by never
 * having an index to get wrong.
 *
 * Search and both filters narrow the same derived array rather than toggling
 * visibility on hidden rows, for the same reason.
 */

type SortKey =
  | 'last-active'
  | 'last-run'
  | 'first-seen'
  | 'views'
  | 'time'
  | 'runs'
  | 'visits'
  | 'name'
  | 'company'
  | 'ai';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'last-active', label: 'Last active' },
  { key: 'last-run', label: 'Last tool opened' },
  { key: 'first-seen', label: 'First seen (newest)' },
  { key: 'views', label: 'Most page views' },
  { key: 'time', label: 'Most time on screen' },
  { key: 'runs', label: 'Most tool opens' },
  { key: 'visits', label: 'Most visits' },
  { key: 'name', label: 'Name (A to Z)' },
  { key: 'company', label: 'Company (A to Z)' },
];

const ms = (iso: string): number => new Date(iso).getTime();

export function PeopleBoard({
  people,
  totals,
  devices,
  operating,
  companies,
  days,
  now,
}: {
  people: Person[];
  totals: {
    people: number;
    visits: number;
    pageViews: number;
    seconds: number;
    runs: number;
    ranSomething: number;
    linked: number;
    avgPagesBefore: number;
  };
  devices: Counted[];
  operating: Counted[];
  companies: Counted[];
  days: number;
  now: number;
}) {
  const [query, setQuery] = useState('');
  const [activity, setActivity] = useState<'all' | 'ran' | 'never-ran' | 'linked'>('all');
  const [enrichFilter, setEnrichFilter] = useState<'all' | 'matched' | 'company' | 'none'>('all');
  const [sort, setSort] = useState<SortKey>('last-active');
  const [aiOrder, setAiOrder] = useState<string[] | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'thinking' | 'failed' | 'off'>('idle');
  const [open, setOpen] = useState<Person | null>(null);
  const [enriched, setEnriched] = useState<Record<string, EnrichedPerson>>({});

  // Prefetched for everybody on screen the moment the table exists, so opening a
  // profile is instant rather than starting a network request on click. One
  // batched call, and the modules underneath cache at three levels.
  useEffect(() => {
    if (people.length === 0) return;

    let live = true;
    void enrichPeople(people.map((p) => p.email)).then((result) => {
      if (live) setEnriched(result);
    });

    return () => {
      live = false;
    };
  }, [people]);

  const searchable = useMemo(
    () => new Map(people.map((p) => [p.email, haystack(p)])),
    [people],
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();

    let list = people.filter((p) => {
      if (needle && !(searchable.get(p.email) ?? '').includes(needle)) return false;

      if (activity === 'ran' && p.runs === 0) return false;
      if (activity === 'never-ran' && p.runs > 0) return false;
      if (activity === 'linked' && p.preSignupPages === 0) return false;

      if (enrichFilter !== 'all') {
        const status = enriched[p.email]?.status;
        if (enrichFilter === 'matched' && status !== 'matched') return false;
        if (enrichFilter === 'company' && status !== 'company-only') return false;
        if (enrichFilter === 'none' && status !== 'no-match' && status !== 'personal-email') {
          return false;
        }
      }

      return true;
    });

    if (sort === 'ai' && aiOrder) {
      const rank = new Map(aiOrder.map((email, i) => [email, i]));
      list = [...list].sort(
        (a, b) => (rank.get(a.email) ?? 1e9) - (rank.get(b.email) ?? 1e9),
      );
    } else {
      const compare: Record<Exclude<SortKey, 'ai'>, (a: Person, b: Person) => number> = {
        'last-active': (a, b) => ms(b.lastSeen) - ms(a.lastSeen),
        'last-run': (a, b) => lastRun(b) - lastRun(a),
        'first-seen': (a, b) => ms(b.firstSeen) - ms(a.firstSeen),
        views: (a, b) => b.pageViews - a.pageViews,
        time: (a, b) => b.seconds - a.seconds,
        runs: (a, b) => b.runs - a.runs,
        visits: (a, b) => b.visits - a.visits,
        name: (a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email),
        company: (a, b) => (a.company ?? '~').localeCompare(b.company ?? '~'),
      };
      list = [...list].sort(compare[sort === 'ai' ? 'last-active' : sort]);
    }

    return list;
  }, [people, searchable, query, activity, enrichFilter, enriched, sort, aiOrder]);

  const peakViews = Math.max(1, ...people.map((p) => p.pageViews));

  const askAi = async () => {
    setSort('ai');
    setAiState('thinking');

    const result = await sortPeopleByAi(
      shown.map((p) => ({
        email: p.email,
        company: p.company,
        visits: p.visits,
        pageViews: p.pageViews,
        seconds: p.seconds,
        features: p.features,
        runs: p.runs,
        preSignupPages: p.preSignupPages,
        firstSeen: p.firstSeen,
        lastSeen: p.lastSeen,
      })),
    );

    if (result.ok) {
      setAiOrder(result.order);
      setAiState('idle');
    } else {
      setAiState(result.reason === 'not-configured' ? 'off' : 'failed');
      setSort('last-active');
    }
  };

  return (
    <>
      <KpiRow>
        <KpiCard
          label="Visits"
          value={totals.visits}
          caption={`${number(totals.pageViews)} page views tracked`}
          accent="var(--h-indigo)"
        />
        <KpiCard
          label="People"
          value={totals.people}
          caption={`${number(companies.length)} companies represented`}
          accent="var(--h-violet)"
        />
        <KpiCard
          label="Tool opens"
          value={totals.runs}
          caption={`${number(totals.ranSomething)} opened at least one`}
          accent="var(--h-emerald)"
        />
        <KpiCard
          label="Linked to pre-signup"
          value={totals.linked}
          caption={
            totals.linked
              ? `${totals.avgPagesBefore} pages read on average before joining`
              : 'Nobody here has browsing linked from before they joined'
          }
          accent="var(--h-cyan)"
        />
        <KpiCard
          label="Time on screen"
          value={duration(totals.seconds)}
          caption="Measured, not inferred from session length"
          accent="var(--h-amber)"
        />
      </KpiRow>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden">
          <CardTitle title="Companies" description="By people, from the email domain." />
          <BarList items={companies} tone="var(--h-violet)" />
        </Card>
        <Card className="overflow-hidden">
          <CardTitle title="Devices" description="Share of page views." />
          <BarList items={devices} tone="var(--h-indigo)" />
        </Card>
        <Card className="overflow-hidden">
          <CardTitle title="Operating systems" description="Share of page views." />
          <BarList items={operating} tone="var(--h-cyan)" />
        </Card>
      </section>

      <Card className="overflow-hidden">
        <CardTitle
          title="Everyone"
          description={`${number(people.length)} people. Click any row for the full profile.`}
        />

        <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
          <span className="relative min-w-[13rem] flex-1">
            <Search
              className="text-subtle pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, address, company, tool, browser"
              aria-label="Search people"
              className="!rounded-full !pl-8"
            />
          </span>

          <Select
            value={activity}
            onChange={(e) => setActivity(e.target.value as typeof activity)}
            aria-label="Filter by activity"
            className="!w-auto"
          >
            <option value="all">All activity</option>
            <option value="ran">Opened a tool</option>
            <option value="never-ran">Never opened one</option>
            <option value="linked">Linked to pre-signup</option>
          </Select>

          <Select
            value={enrichFilter}
            onChange={(e) => setEnrichFilter(e.target.value as typeof enrichFilter)}
            aria-label="Filter by enrichment"
            className="!w-auto"
          >
            <option value="all">All enrichment</option>
            <option value="matched">Person matched</option>
            <option value="company">Company only</option>
            <option value="none">No match</option>
          </Select>

          <Select
            value={sort}
            onChange={(e) => {
              const next = e.target.value as SortKey;
              if (next === 'ai') void askAi();
              else setSort(next);
            }}
            aria-label="Sort"
            className="!w-auto"
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
            <option value="ai">Sort by what looks promising</option>
          </Select>

          <span className={cn(NUM, 'text-subtle ml-auto text-[11px]')}>
            {number(shown.length)} of {number(people.length)} shown
          </span>

          {aiState !== 'idle' && (
            <span
              style={{ ['--tone' as string]: aiState === 'thinking' ? 'var(--h-violet)' : 'var(--h-rose)' }}
              className="tinted inline-flex items-center gap-1.5 rounded-full border px-2 py-px text-[10.5px] font-semibold"
            >
              <Sparkles className="size-3" aria-hidden />
              {aiState === 'thinking'
                ? 'Thinking'
                : aiState === 'off'
                  ? 'No model key set'
                  : 'Could not rank'}
            </span>
          )}
        </div>

        {people.length === 0 ? (
          <EmptyState
            icon={<Clock3 className="size-6" />}
            title="Nobody outside the team has used it in this window"
            description="Anyone signed in who is not on the analytics allowlist appears here, with everything we know about them. Widen the window above, or check that the tracker is running."
          />
        ) : shown.length === 0 ? (
          <p className="text-subtle px-5 py-10 text-center text-sm">
            No one matches those filters. Clearing the search box is usually the fix.
          </p>
        ) : (
          <div className="px-5 py-3">
            <Roster>
              <RosterHead>
                <RosterTh>Person</RosterTh>
                <RosterTh>Company</RosterTh>
                <RosterTh align="right">Visits</RosterTh>
                <RosterTh align="right">Tools</RosterTh>
                <RosterTh align="right">Views</RosterTh>
                <RosterTh align="right">On screen</RosterTh>
                <RosterTh>First seen</RosterTh>
                <RosterTh>Last active</RosterTh>
                <RosterTh>Device</RosterTh>
                <RosterTh>Source</RosterTh>
              </RosterHead>
              <tbody>
                {shown.map((person, i) => (
                  <RosterRow
                    key={person.email}
                    email={person.email}
                    index={i}
                    onClick={() => setOpen(person)}
                  >
                    <RosterTd>
                      <PersonCell
                        email={person.email}
                        name={person.name}
                        photo={person.photo}
                        lastSeen={person.lastSeen}
                        now={now}
                        linked={person.preSignupPages}
                      />
                    </RosterTd>
                    <RosterTd>
                      <CompanyCell company={person.company} />
                    </RosterTd>
                    <RosterTd align="right">
                      <NumChip value={person.visits} tone="var(--h-indigo)" />
                    </RosterTd>
                    <RosterTd align="right">
                      <span className="inline-flex flex-col items-end gap-0.5">
                        <NumChip value={person.runs} tone="var(--h-emerald)" />
                        {person.features.length > 0 && (
                          <span className="text-subtle max-w-[9rem] truncate text-[10px]">
                            {person.features.slice(0, 2).join(' · ')}
                            {person.features.length > 2 && ` +${person.features.length - 2}`}
                          </span>
                        )}
                      </span>
                    </RosterTd>
                    <RosterTd align="right">
                      {/* The one column with both a figure and a bar: here the
                          question is always "compared with whom". */}
                      <ChipWithBar value={person.pageViews} max={peakViews} tone="var(--h-cyan)" />
                    </RosterTd>
                    <RosterTd align="right">
                      <span className={cn(NUM, 'text-[12px] text-[var(--h-indigo)]')}>
                        {duration(person.seconds)}
                      </span>
                    </RosterTd>
                    <RosterTd>
                      <WhenCell iso={person.firstSeen} now={now} />
                    </RosterTd>
                    <RosterTd>
                      <WhenCell iso={person.lastSeen} now={now} />
                    </RosterTd>
                    <RosterTd>
                      <DeviceCell browser={person.browser} os={person.os} device={person.device} />
                    </RosterTd>
                    <RosterTd>
                      <SourcePill source={person.source} />
                    </RosterTd>
                  </RosterRow>
                ))}
              </tbody>
            </Roster>
          </div>
        )}
      </Card>

      <Profile
        person={open}
        enriched={open ? enriched[open.email] : undefined}
        days={days}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

/** When they last opened a tool, or zero. Drives the "last tool opened" sort. */
function lastRun(person: Person): number {
  const run = person.journey.find((event) => event.kind === 'run');
  return run ? ms(run.at) : 0;
}
