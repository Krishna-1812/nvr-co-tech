'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { Building2, Coins, History, SlidersHorizontal, Users, Wand2 } from 'lucide-react';
import { buttonClass } from '@/components/ui/primitives';
import { HeroChip, ToolHero } from '@/components/ui/ToolHero';
import { ArchScene, SealFigure } from '@/components/ui/Scene';
import type { Entity } from './filters';

/**
 * The two answer-first moments on the search screen.
 *
 * Contact Finder is a working layout — a filter rail, the results, a chat — and
 * a giant hero standing over the results would push the one thing somebody came
 * for below the fold on every search. So the screen has two heads, one per state,
 * and never both:
 *
 * - Before anything has been searched, the full hero. The answer it can give at
 *   that point is the live count of the filters as they are set, which is free,
 *   and which is exactly the figure that decides whether to run the search.
 * - Once rows are on screen, a compact head over the results column with the
 *   number found set large, and the free actions on those rows beneath it.
 *
 * Nothing in either is invented. A count that has not arrived is said to be
 * coming, a count Apollo would not give is said to be missing, and the seal on
 * the arch is only drawn when there is a real count to put on it.
 */

type Count = { value: number | null; approx: boolean; reason?: string } | null;

const n = (v: number) => v.toLocaleString('en-IN');

export function FinderHero({
  entity,
  count,
  counting,
  filtersSet,
}: {
  entity: Entity;
  count: Count;
  counting: boolean;
  /** Filters that narrow the search, not the two settings about how to run it. */
  filtersSet: number;
}) {
  const people = entity === 'people';
  /*
   * The count is only ever for people — see the effect in Workspace — and only
   * once at least one filter is set, so a stale figure from before the tab
   * flipped or the panel was cleared must not be shown as this search's.
   */
  const live = people && filtersSet > 0 && !counting && count?.value != null ? count : null;

  return (
    <ToolHero
      label="Contact Finder"
      pill={{
        icon: people ? Users : Building2,
        text: people ? 'Searching people' : 'Searching companies',
        tone: people ? 'var(--h-indigo)' : 'var(--h-cyan)',
      }}
      title={people ? 'Find the person.' : 'Find the company.'}
      sub="Search live by role, seniority, industry or size, or ask a plain question and get an answer built only from what came back. Anything Apollo returns that does not really match is removed, and counted."
      glow={people ? 'var(--h-indigo)' : 'var(--h-cyan)'}
      scene={
        <ArchScene
          motif="seekers"
          className="h-full min-h-[17rem]"
          seal={
            live?.value != null ? (
              <SealFigure
                value={n(live.value)}
                note={live.approx ? 'or fewer match' : 'match these filters'}
              />
            ) : undefined
          }
        />
      }
    >
      {/*
        The instrument under the title: what the filters as set would find.
        Three honest states — coming, here, and not available — and a fourth for
        Companies, which has no free count at all.
      */}
      <div className="surface-sunken a-inner mt-7 max-w-xl rounded-2xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="a-label">{people ? 'Match these filters' : 'Before you search'}</p>
            <p
              className="mt-2 text-[1.6rem] leading-none font-semibold tracking-tight tabular-nums sm:text-[1.85rem]"
              aria-live="polite"
            >
              {!people ? (
                <span className="inline-flex items-center gap-2">
                  <Coins className="size-5 text-[var(--accent)]" aria-hidden />1 credit
                </span>
              ) : counting ? (
                <span className="text-subtle">Counting…</span>
              ) : live?.value != null ? (
                <>
                  {live.approx && <span className="text-muted text-[0.6em] font-medium">about </span>}
                  {n(live.value)}
                </>
              ) : (
                <span className="text-subtle">—</span>
              )}
            </p>
          </div>
          <p className="text-subtle max-w-[16rem] pb-0.5 text-[12px] leading-snug">
            {!people
              ? 'A company search is charged when it runs. There is no free count to check first.'
              : live?.value != null
                ? live.approx
                  ? 'Apollo’s own figure. Some filters are re-checked here, so the page will show this many or fewer.'
                  : 'Apollo’s own count, free to read. It changes as you set filters.'
                : filtersSet === 0
                  ? 'Set a role, an industry or a company and the count appears here. Counting is free.'
                  : count?.reason || 'Apollo gave no count for these filters.'}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <HeroChip icon={SlidersHorizontal}>
          {filtersSet === 0 ? 'No filters set yet' : `${filtersSet} ${filtersSet === 1 ? 'filter' : 'filters'} set`}
        </HeroChip>
        <HeroChip icon={Wand2}>Reading a sentence into filters costs nothing</HeroChip>
        <Link
          href="/contacts/activity"
          className={buttonClass({ variant: 'ghost', size: 'sm', className: 'group' })}
        >
          <History className="size-3.5" aria-hidden />
          Searches already run
        </Link>
      </div>
    </ToolHero>
  );
}

/**
 * The head of the results column, once there are results.
 *
 * The number found is the answer, so it is the largest thing in the column. The
 * split bar is drawn only when rows were removed, because it is the picture of
 * that removal — kept against taken out — and a bar that is all one colour says
 * nothing a number does not. Its figures are the same two the rejection banner
 * under it states, so the bar and the sentence can never disagree.
 */
export function ResultsHead({
  entity,
  shown,
  total,
  at,
  removed,
  described,
  selected,
  tools,
  actions,
}: {
  entity: Entity;
  shown: number;
  total: number | null;
  /** The company a name resolved to, when the search was about one. */
  at?: string;
  /** Rows Apollo returned that did not match and were taken out. */
  removed: number;
  described: { orgs: number; fetched: number } | null;
  selected: number;
  /** The view toggle, top right. */
  tools?: ReactNode;
  /** The row of free actions on these rows. */
  actions?: ReactNode;
}) {
  const people = entity !== 'companies';
  const tone = people ? 'var(--h-indigo)' : 'var(--h-cyan)';
  const parts = [
    { key: 'kept', label: 'Shown, checked against your filters', value: shown, tone },
    { key: 'removed', label: 'Removed for not matching', value: removed, tone: 'var(--status-pending)' },
  ];

  return (
    <section
      aria-label="Results"
      className="surface-lit a-ring relative isolate animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] overflow-hidden rounded-3xl"
    >
      <span
        aria-hidden
        className="a-orb -top-28 -left-16 size-80 opacity-[0.14]"
        style={{ background: `radial-gradient(circle, ${tone}, transparent 66%)` }}
      />

      <div className="relative p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="a-label">{people ? 'People found' : 'Companies found'}</span>
              {selected > 0 && (
                <span
                  style={{ '--tone': tone } as CSSProperties}
                  className="tinted rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                >
                  {n(selected)} selected
                </span>
              )}
            </p>
            <p className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="animate-[settle_0.8s_cubic-bezier(0.22,1,0.36,1)_backwards] text-[2.6rem] leading-none font-semibold tracking-[-0.035em] tabular-nums">
                {n(shown)}
              </span>
              <span className="text-muted min-w-0 text-[15px]">
                {people ? (shown === 1 ? 'person' : 'people') : shown === 1 ? 'company' : 'companies'}
                {total != null && total > shown && (
                  <span className="text-subtle"> of {n(total)} Apollo matched</span>
                )}
                {at && <span className="text-subtle"> at {at}</span>}
              </span>
            </p>
          </div>
          {tools && <div className="shrink-0">{tools}</div>}
        </div>

        {removed > 0 && (
          <div className="mt-5 max-w-xl">
            <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
              {parts.map((p, i) => (
                <span
                  key={p.key}
                  className="h-full origin-left animate-[grow_0.9s_cubic-bezier(0.22,1,0.36,1)_backwards] first:rounded-l-full last:rounded-r-full"
                  style={{
                    flexGrow: Math.max(p.value, (shown + removed) * 0.02),
                    flexBasis: 0,
                    background: p.tone,
                    animationDelay: `${120 + i * 120}ms`,
                  }}
                />
              ))}
            </div>
            <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
              {parts.map((p) => (
                <div key={p.key} className="flex items-center gap-1.5">
                  <dt className="text-muted inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-2 rounded-[3px]" style={{ background: p.tone }} />
                    {p.label}
                  </dt>
                  <dd className="font-semibold tabular-nums">{n(p.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {described && described.orgs > 0 && (
          <p className="text-subtle mt-3 text-[12px]">
            <span className="font-medium tabular-nums">{n(described.orgs)}</span> employers described
            {described.fetched === 0
              ? ', all from cache'
              : `, ${n(described.fetched)} newly fetched`}
          </p>
        )}

        {actions && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[color-mix(in_oklab,var(--border-c)_70%,transparent)] pt-4">
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}
