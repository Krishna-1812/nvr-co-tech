import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CalendarDays, HardDrive, Lock, ShieldCheck } from 'lucide-react';
import { fiscalYear, istParts, istToday } from '@/lib/fiscal';
import { SOLUTIONS, type Solution } from '@/lib/solutions';
import { LOCKED_TOOLS, OPEN_TOOLS } from '@/lib/access';
import { cn } from '@/lib/utils';
import { Figure } from '@/components/app/Figure';
import { Glow } from '@/components/app/Glow';
import { buttonClass } from '@/components/ui/primitives';
import { ArchScene, SealFigure } from '@/components/ui/Scene';
import { HeroChip, HeroStat, ToolHero } from '@/components/ui/ToolHero';
import { IntroCurtain } from '@/components/marketing/play/IntroCurtain';
import { LandedPanel } from '@/components/landed/LandedPanel';
import { WealthPanel } from '@/components/wealth/WealthPanel';
import { LiveSolutionCard } from './LiveSolutionCard';
import { RequestCard } from './RequestCard';
import { RosterMeter } from './RosterMeter';
import { SolutionCard } from './SolutionCard';
import { remaining } from './AskCard';
import { SignInButton } from '../access/SignInButton';

/**
 * The workspace for everybody who is not a platform admin: a visitor with no
 * account, and anybody signed in without admin standing (lib/access).
 *
 * Every live tool is on it. The two open ones are cards that open, with their
 * figures counted in this browser; the four locked ones are shown in full and
 * lead to their own page, which describes the tool and takes a request for
 * access. Nothing here reads a table: a visitor has no session to read with,
 * and the locked tools' figures would be counts of nothing this person can do.
 *
 * Signing in is offered as what it is — a way to keep your work in an account —
 * and never as a way to open more tools, because it does not.
 */
export function OpenHub({
  user,
  asked,
  grants = [],
}: {
  user: { id: string; email: string; full_name: string | null } | null;
  /** Roadmap tools this person has already asked for (signed in only). */
  asked: Set<string>;
  /** Locked tools an admin has opened for this person (Admin settings). */
  grants?: string[];
}) {
  const fiscal = fiscalYear(istToday());
  const { partOfDay, weekday } = istParts();
  const firstName = user ? (user.full_name ?? user.email).split(/[\s@.]+/)[0] : '';
  const greeting = firstName ? `Good ${partOfDay}, ${firstName}.` : `Good ${partOfDay}.`;

  const open = SOLUTIONS.filter((s) => OPEN_TOOLS.includes(s.slug));
  const locked = SOLUTIONS.filter((s) => LOCKED_TOOLS.includes(s.slug) && !grants.includes(s.slug));
  const given = SOLUTIONS.filter((s) => LOCKED_TOOLS.includes(s.slug) && grants.includes(s.slug));
  const rest = SOLUTIONS.filter((s) => s.stage !== 'live');
  const wealth = open.find((s) => s.slug === 'wealth-tracker');
  const landed = open.find((s) => s.slug === 'true-property-cost');

  return (
    <div className="space-y-8">
      <IntroCurtain text={greeting} tag={`${weekday} · FY ${fiscal.label}`} storageKey="tfi-welcome" />

      <ToolHero
        id="hub-greeting"
        label={`${weekday} ${partOfDay} · FY ${fiscal.label} · India`}
        pill={{ text: `${open.length} open to everybody`, tone: 'var(--status-approved)', live: true }}
        title={greeting}
        mark={firstName || undefined}
        glow="var(--color-brand-500)"
        sub={
          user
            ? 'Every tool the firm runs is here. Two are yours to use, and what you do in them is saved to your account. The others are shown in full; ask, and we will open one for you.'
            : 'Every tool the firm runs is here, and two are open to use now, with no account. Sign in only if you want your work saved to an account. The others are shown in full; ask, and we will open one for you.'
        }
        scene={
          <ArchScene
            motif="doorways"
            className="h-full min-h-[19rem]"
            seal={<SealFigure value={open.length} note="tools open to you" />}
          />
        }
      >
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          {wealth?.open && (
            <Link href={wealth.open} className={buttonClass({ variant: 'primary', className: 'group' })}>
              Open Wealth Tracker
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}
          {landed?.open && (
            <Link href={landed.open} className={buttonClass({ className: 'group' })}>
              Open True Property Cost
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}
        </div>

        <div className="surface-sunken a-inner mt-8 rounded-2xl border p-4 sm:p-5">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <HeroStat
              strong
              label="Open to you"
              value={<Figure value={open.length + given.length} delay={120} />}
              note={given.length ? `${given.length} opened for you` : 'No account needed'}
            />
            <HeroStat
              label="On request"
              tone="var(--status-warn)"
              value={<Figure value={locked.length} delay={200} />}
              note="Live, opened for you when you ask"
            />
            <HeroStat
              label="On the way"
              tone="var(--status-draft)"
              value={<Figure value={rest.length} delay={280} />}
              note="Written down, in build order"
            />
          </div>
          <p className="a-label mt-5">The roster</p>
          <RosterMeter className="mt-2.5" />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <HeroChip icon={user ? ShieldCheck : HardDrive} className="max-w-full">
            <span className="min-w-0 text-pretty">
              {user ? (
                <>
                  <span className="font-semibold text-[var(--text-c)]">Signed in</span>
                  <span className="px-1.5 opacity-50">·</span>
                  Your work in the open tools is saved to your account
                </>
              ) : (
                <>
                  <span className="font-semibold text-[var(--text-c)]">Not signed in</span>
                  <span className="px-1.5 opacity-50">·</span>
                  Your work stays in this browser until you sign in
                </>
              )}
            </span>
          </HeroChip>
          <HeroChip icon={CalendarDays}>
            <span>
              <span className="numeric font-semibold text-[var(--text-c)]">{fiscal.daysLeft}</span>{' '}
              {fiscal.daysLeft === 1 ? 'day' : 'days'} left in FY {fiscal.label}
            </span>
          </HeroChip>
          {!user && <SignInButton />}
        </div>
      </ToolHero>

      <section aria-labelledby="hub-open">
        <SectionHead id="hub-open" count={open.length} title="Open to you" note="Use them now. The figures are counted in this browser." />
        <div className="mt-5 grid items-stretch gap-6 md:grid-cols-2">
          {landed && (
            <div className="h-full animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_60ms_backwards]">
              <LiveSolutionCard solution={landed} readings={[]} note="" panel={<LandedPanel userId={user?.id ?? null} />} />
            </div>
          )}
          {wealth && (
            <div className="h-full animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_120ms_backwards]">
              <LiveSolutionCard solution={wealth} readings={[]} note="" panel={<WealthPanel userId={user?.id ?? 'guest'} />} />
            </div>
          )}
          {given.map((s) => (
            <div key={s.slug} className="h-full animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_180ms_backwards]">
              <LiveSolutionCard
                solution={s}
                readings={[]}
                note=""
                panel={
                  <p className="tinted mt-3.5 flex min-h-[3.5rem] items-center rounded-xl border px-3 py-2 text-[12px] leading-relaxed font-medium [--tone:var(--status-approved)]">
                    Opened for you by an admin.
                  </p>
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="hub-locked">
        {locked.length > 0 && (
        <>
        <SectionHead
          id="hub-locked"
          count={locked.length}
          title="On request"
          note="Live and in use by our team. Open one to see everything it does, and ask for access there."
        />
        <ul className="stagger mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {locked.map((s) => (
            <li key={s.slug} className="h-full">
              <LockedCard solution={s} />
            </li>
          ))}
        </ul>
        </>
        )}
      </section>

      <section aria-labelledby="hub-roadmap">
        <SectionHead
          id="hub-roadmap"
          count={rest.length}
          title="On the way"
          note={user ? 'Not switched on yet. Each one says where it has got to, and asking for one counts.' : 'Not switched on yet. Each one says where it has got to.'}
        />
        <ul className="stagger mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((solution) => (
            <li key={solution.slug} className="h-full">
              <SolutionCard solution={solution} asked={asked.has(solution.slug)} canAsk={!!user} />
            </li>
          ))}
          <li className={cn('h-full', SM_SPAN[remaining(rest.length, 2) as 1 | 2], LG_SPAN[remaining(rest.length, 3) as 1 | 2 | 3])}>
            <RequestCard />
          </li>
        </ul>
      </section>
    </div>
  );
}

/**
 * A live tool this person may not use yet. The whole card opens the tool's own
 * page, which shows everything it does and takes the request.
 */
function LockedCard({ solution }: { solution: Solution }) {
  const { icon: Icon, tone } = solution;
  const href = solution.open ?? solution.plan;
  return (
    <Glow
      color={tone}
      radius={360}
      strength={0.06}
      style={{ '--tone': tone } as CSSProperties}
      className="surface-lit a-ring a-lift group relative flex h-full flex-col overflow-hidden rounded-3xl"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px opacity-50 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${tone}, transparent)` }}
      />
      <Link
        href={href}
        className="absolute inset-0 z-20 rounded-3xl focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:outline-none"
      >
        <span className="sr-only">See {solution.name} and request access</span>
      </Link>
      <div className="relative flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <span aria-hidden className="tinted a-inner grid size-11 shrink-0 place-items-center rounded-2xl border">
            <Icon className="size-5" />
          </span>
          <span
            style={{ '--tone': 'var(--status-warn)' } as CSSProperties}
            className="tinted inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold tracking-[0.08em] uppercase"
          >
            <Lock className="size-2.5" aria-hidden />
            On request
          </span>
        </div>
        <h3 className="m-display mt-4 text-[1.15rem] leading-tight">{solution.name}</h3>
        <p className="a-label mt-1.5" style={{ color: tone }}>
          {solution.category}
        </p>
        <p className="text-muted mt-3 text-[13px] leading-relaxed text-pretty">{solution.summary}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs font-semibold">
          <span className="inline-flex items-center gap-1">
            See it and ask
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </span>
          <Link
            href={solution.plan}
            className="text-subtle relative z-[25] inline-flex items-center gap-1 transition hover:text-[var(--text-c)]"
          >
            Tour
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </Glow>
  );
}

function SectionHead({ id, count, title, note }: { id: string; count: number; title: string; note: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="surface-sunken a-inner grid h-9 min-w-9 place-items-center rounded-xl border px-2 text-[15px] font-semibold tracking-tight tabular-nums">
          {count}
        </span>
        <h2 id={id} className="m-display text-[1.45rem] leading-tight">
          {title}
        </h2>
      </div>
      <p className="text-subtle text-[12px] text-pretty">{note}</p>
    </div>
  );
}

const SM_SPAN = { 1: 'sm:col-span-1', 2: 'sm:col-span-2' } as const;
const LG_SPAN = { 1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3' } as const;
