import Link from 'next/link';
import { ArrowRight, BadgeCheck, Bot, Eye, Radar } from 'lucide-react';
import { buttonClass } from '@/components/ui/primitives';
import { HeroChip, HeroStat, ToolHero } from '@/components/ui/ToolHero';
import { ArchScene, SealFigure } from '@/components/ui/Scene';
import { number } from './Figures';
import { WindowTabs, type Window } from './Window';

/**
 * How the analytics section opens: what has already happened, read off a sundial.
 *
 * The answer is the top of the activation funnel — how many people have signed
 * up — because it is the one figure on this screen that exists from the first
 * day, traffic or none. Everything under it is the funnel read forwards: how
 * many of those went on to start a workspace, draft, submit, and how much has
 * stopped moving. The public site gets the panel at the foot of the hero rather
 * than the hero itself, because a quiet month of marketing traffic should not
 * make a working product look idle.
 *
 * Every figure is passed in from the page, which already computed it for the
 * cards that used to stand here. Nothing is derived in this file beyond a
 * plural and a share for the split bar.
 */

type Stage = { reached: number; fromPrevious: number | null };

export type HeroTraffic = {
  pageViews: number;
  visitors: number;
  newVisitors: number;
  returningVisitors: number;
  botViews: number;
  converted: number;
  rate: number;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function OverviewHero({
  days,
  funnel,
  waiting,
  traffic,
}: {
  days: Window;
  /** The five activation stages, in order: signed up, workspace, drafted, submitted, paid. */
  funnel: Stage[];
  /** Vouchers that have sat in one state for more than a fortnight. */
  waiting: number;
  /** The public site in this window, or null when nothing was recorded. */
  traffic: HeroTraffic | null;
}) {
  const [signed, started, drafted, submitted, paid] = Array.from(
    { length: 5 },
    (_, i): Stage => funnel[i] ?? { reached: 0, fromPrevious: null },
  );
  const startedShare = started.fromPrevious;

  return (
    <ToolHero
      id="analytics-hero"
      label="Overview · what has happened"
      pill={{ icon: BadgeCheck, text: 'Own tracker, no third-party pixel', tone: 'var(--status-approved)', live: true }}
      variant="figure"
      title={
        <>
          {number(signed.reached)}
          <span className="text-muted ml-[0.25em] text-[0.4em] font-medium tracking-[-0.01em]">
            {plural(signed.reached, 'person has', 'people have')} signed up
          </span>
        </>
      }
      sub={
        startedShare === null ? (
          <>Nobody has started a workspace yet. The funnel below fills in as the first organisation is created.</>
        ) : (
          <>
            {number(started.reached)} started a workspace — {startedShare}% of them — and{' '}
            {number(submitted.reached)} {plural(submitted.reached, 'organisation has', 'organisations have')} submitted a
            voucher.{' '}
            {waiting > 0
              ? `${number(waiting)} ${plural(waiting, 'voucher has', 'vouchers have')} sat in one state for more than a fortnight.`
              : 'Nothing has sat in one state for a fortnight.'}
          </>
        )
      }
      scene={
        <ArchScene
          motif="sundial"
          className="h-full min-h-[18rem]"
          seal={
            startedShare !== null ? (
              <SealFigure value={`${startedShare}%`} note="of signups started a workspace" />
            ) : undefined
          }
        />
      }
    >
      {/* The funnel, read forwards. Counts of organisations from here on, so the
          share is only stated on the one step that changes subject. */}
      <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <HeroStat
          label="Workspace"
          value={number(started.reached)}
          note={startedShare === null ? 'None yet' : `${startedShare}% of signups`}
        />
        <HeroStat
          label="Drafted"
          value={number(drafted.reached)}
          note={plural(drafted.reached, 'organisation', 'organisations')}
        />
        <HeroStat
          strong
          label="Submitted"
          value={number(submitted.reached)}
          note="Trying it, to using it"
        />
        <HeroStat
          label="Waiting"
          tone={waiting > 0 ? 'var(--status-rejected)' : 'var(--status-approved)'}
          value={number(waiting)}
          note={waiting > 0 ? 'Stuck over a fortnight' : 'Nothing stuck'}
        />
      </div>

      {/* The public site, as the working at the foot of the hero. */}
      <div className="surface-sunken a-inner mt-6 rounded-2xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="a-label">Public site · last {days} days</p>
            {traffic ? (
              <p className="mt-2 text-[1.6rem] leading-none font-semibold tracking-tight tabular-nums sm:text-[1.85rem]">
                {number(traffic.pageViews)}
                <span className="text-subtle ml-2 text-[13px] font-normal tracking-normal">
                  page {plural(traffic.pageViews, 'view', 'views')}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-[15px] font-semibold tracking-tight">Nothing recorded yet</p>
            )}
          </div>
          <p className="text-subtle pb-0.5 text-xs">
            {traffic ? (
              <>
                <span className="font-medium tabular-nums">{number(traffic.visitors)}</span>{' '}
                {plural(traffic.visitors, 'person', 'people')} ·{' '}
                <span className="font-medium tabular-nums">{number(traffic.converted)}</span> asked to be
                contacted ({traffic.rate}%)
              </>
            ) : (
              'The first rows arrive a minute or two after the first real visit.'
            )}
          </p>
        </div>

        {traffic && traffic.visitors > 0 && (
          <>
            {/* New against returning: the two add up to everybody, so one bar. */}
            <div className="mt-3.5 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
              {traffic.newVisitors > 0 && (
                <span
                  className="a-fill h-full first:rounded-l-full last:rounded-r-full"
                  style={{ flexGrow: traffic.newVisitors, flexBasis: 0, background: 'var(--lc-borrow)' }}
                />
              )}
              {traffic.returningVisitors > 0 && (
                <span
                  className="a-fill h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    flexGrow: traffic.returningVisitors,
                    flexBasis: 0,
                    background: 'var(--lc-own)',
                    animationDelay: '150ms',
                  }}
                />
              )}
            </div>
            <div className="text-muted mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-[3px] bg-[var(--lc-borrow)]" />
                New <span className="font-medium tabular-nums">{number(traffic.newVisitors)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-[3px] bg-[var(--lc-own)]" />
                Came back <span className="font-medium tabular-nums">{number(traffic.returningVisitors)}</span>
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <HeroChip icon={BadgeCheck}>
          {number(paid.reached)} {plural(paid.reached, 'organisation', 'organisations')} got a voucher to paid
        </HeroChip>
        {traffic && traffic.botViews > 0 && (
          <HeroChip icon={Bot}>
            {number(traffic.botViews)} bot {plural(traffic.botViews, 'visit', 'visits')} left out of every figure
          </HeroChip>
        )}
        <HeroChip icon={Eye}>Do Not Track and Global Privacy Control are never recorded</HeroChip>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-2.5">
        <Link href="/analytics/activation" className={buttonClass({ variant: 'primary', className: 'group' })}>
          Open activation
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
        <Link href={`/analytics/visitors${days === 30 ? '' : `?days=${days}`}`} className={buttonClass()}>
          <Radar className="size-4" aria-hidden />
          Public site
        </Link>
        <div className="sm:ml-auto">
          <WindowTabs current={days} base="/analytics" />
        </div>
      </div>
    </ToolHero>
  );
}
