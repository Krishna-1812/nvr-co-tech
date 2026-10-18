'use client';

import type { CSSProperties } from 'react';
import { Cloud, Eye, EyeOff, HardDrive, LockKeyhole } from 'lucide-react';
import { ArchScene } from '@/components/ui/Scene';
import { HeroStat } from '@/components/ui/ToolHero';
import { HeroStage } from '@/components/marketing/play/HeroStage';
import { GROUPS } from '@/lib/wealth/heads';
import type { Summary } from '@/lib/wealth/calc';
import { memberName, type Profile } from '@/lib/wealth/model';
import { compact, rupees } from '@/lib/wealth/money';
import { cn } from '@/lib/utils';
import { Amount, HIDDEN, useSignedIn } from './shared';

/**
 * Net worth, set the way every tool here opens: the answer as the largest
 * thing on the screen, the sum that produced it underneath, and the arch
 * beside it.
 *
 * The figure is what you own less what you owe, at your share of anything
 * held jointly. The line under it says so, and says it is the record as
 * entered rather than a valuation, because a CA reading it will ask.
 */
export function Hero({
  summary,
  profile,
  holder,
  onHolder,
  hide,
  onHide,
  locked,
}: {
  summary: Summary;
  profile: Profile;
  holder: string;
  onHolder: (id: string) => void;
  hide: boolean;
  onHide: () => void;
  locked: boolean;
}) {
  const signedIn = useSignedIn();
  const family = profile.members.length > 1;
  const owner = holder ? memberName(profile, holder) : family ? 'Your household' : memberName(profile, 'self');

  return (
    <section aria-labelledby="wt-hero" className="surface-lit a-ring relative isolate overflow-hidden rounded-[2rem]">
      <span
        aria-hidden
        className="a-orb -top-40 -left-24 size-[34rem] opacity-[0.16]"
        style={{ background: 'radial-gradient(circle, var(--h-amber), transparent 66%)' }}
      />
      <span
        aria-hidden
        className="a-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(60%_70%_at_15%_0%,#000,transparent)]"
      />

      <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="a-label">Net worth · {owner}</span>
            <span
              style={{ '--tone': 'var(--status-draft)' } as CSSProperties}
              className="tinted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold"
            >
              {locked ? <LockKeyhole className="size-3" aria-hidden /> : signedIn ? <Cloud className="size-3" aria-hidden /> : <HardDrive className="size-3" aria-hidden />}
              {locked ? 'Locked with a passcode' : signedIn ? 'Saved to your account' : 'In this browser only'}
            </span>
            <button
              type="button"
              onClick={onHide}
              aria-pressed={hide}
              className="text-muted ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
            >
              {hide ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
              {hide ? 'Show amounts' : 'Hide amounts'}
            </button>
          </div>

          <h1
            id="wt-hero"
            className={cn(
              'mt-4 animate-[settle_0.9s_cubic-bezier(0.22,1,0.36,1)_backwards] text-[clamp(2.6rem,7vw,4.6rem)] leading-[0.95] font-semibold tracking-[-0.035em] text-balance tabular-nums',
              summary.net < 0 && !hide && 'text-[var(--status-rejected)]',
            )}
          >
            {hide ? HIDDEN : rupees(Math.round(summary.net))}
          </h1>
          <p className="text-muted mt-3 max-w-2xl text-[15px] leading-relaxed text-pretty">
            What you own, less what you owe, counting only your share of anything held jointly. The
            figures as you entered them, not a valuation.
          </p>

          {family && (
            <div role="radiogroup" aria-label="Whose figures" className="mt-5 flex flex-wrap gap-1.5">
              {[{ id: '', name: 'Everyone' }, ...profile.members.map((m) => ({ id: m.id, name: memberName(profile, m.id) }))].map((m) => (
                <button
                  key={m.id || 'all'}
                  type="button"
                  role="radio"
                  aria-checked={holder === m.id}
                  onClick={() => onHolder(m.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[12.5px] font-medium transition',
                    holder === m.id
                      ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]'
                      : 'text-muted hover:bg-[var(--surface-sunken)]',
                  )}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <HeroStat label="You own" value={<Amount value={summary.assets} hide={hide} short />} tone="var(--h-emerald)" />
            <HeroStat label="You owe" value={<Amount value={summary.liabilities} hide={hide} short />} tone="var(--h-rose)" />
            <HeroStat label="Net worth" value={<Amount value={summary.net} hide={hide} short />} strong />
            <HeroStat
              label="Liquid"
              value={<Amount value={summary.liquid} hide={hide} short />}
              note="Cash within days"
              tone="var(--h-cyan)"
            />
          </div>

          <Allocation summary={summary} hide={hide} />
        </div>

        <HeroStage className="hidden lg:flex lg:flex-col lg:justify-center [&>*]:max-h-[26rem]">
          <ArchScene motif="nest" className="h-full min-h-[17rem]" />
        </HeroStage>
      </div>
    </section>
  );
}

/** Where the assets are, as one bar, with what is owed set against it. */
function Allocation({ summary, hide }: { summary: Summary; hide: boolean }) {
  const assets = summary.groups.filter((g) => GROUPS[g.id].side === 'asset');
  const owed = summary.groups.filter((g) => GROUPS[g.id].side === 'liability');
  if (summary.assets <= 0 && summary.liabilities <= 0) return null;
  const share = (n: number, of: number) => (of > 0 ? (n / of) * 100 : 0);

  return (
    <div className="mt-7 space-y-3">
      {summary.assets > 0 && (
        <div>
          <div aria-hidden className="flex h-2.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            {assets.map((g) => (
              <span key={g.id} className="h-full" style={{ width: `${share(g.total, summary.assets)}%`, background: GROUPS[g.id].tone }} />
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {assets.map((g) => (
              <li key={g.id} className="text-muted flex items-center gap-1.5 text-[12px]">
                <span aria-hidden className="size-2 rounded-full" style={{ background: GROUPS[g.id].tone }} />
                {GROUPS[g.id].name}
                <span className="text-[var(--text-c)] tabular-nums">
                  {hide ? `${Math.round(share(g.total, summary.assets))}%` : `${compact(g.total)} · ${Math.round(share(g.total, summary.assets))}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {owed.length > 0 && (
        <p className="text-muted text-[12px]">
          You owe{' '}
          {owed.map((g, i) => (
            <span key={g.id}>
              {i > 0 && ' and '}
              <span className="text-[var(--text-c)]">{hide ? HIDDEN : compact(g.total)}</span> in {GROUPS[g.id].name.toLowerCase()}
            </span>
          ))}
          {summary.debtToAssets !== null && <>, {summary.debtToAssets.toLocaleString('en-IN', { maximumFractionDigits: 1 })}% of what you own</>}.
        </p>
      )}
    </div>
  );
}
