import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Figure } from '@/components/app/Figure';
import { Glow } from '@/components/app/Glow';
import { cn } from '@/lib/utils';

/**
 * One headline number.
 *
 * The figure is the largest thing in the card and the label is the smallest. On a
 * dashboard of four cards that ordering is the whole design: you read four
 * figures, then go back for the words.
 *
 * Two things carry meaning rather than decoration:
 *
 *   `tone` is a --status-* token, the same one the badges and the pipeline use, so
 *   the red card and the Sent back chip on the row below it are the identical red.
 *   Four cards in four unrelated colours would be prettier and would teach the
 *   reader nothing.
 *
 *   `urgent` marks the cards that represent work sitting on this person. It buys
 *   a lit top edge and a bloom behind the figure — the eye lands there first,
 *   which is the point of the screen.
 *
 * A server component on purpose: the icon is a component reference and cannot
 * cross into a client boundary, so the interactive parts (Glow, Figure) are
 * children rather than wrappers.
 */
export function StatCard({
  label,
  value,
  kind = 'count',
  hint,
  href,
  icon: Icon,
  tone,
  share,
  urgent = false,
  delay = 0,
}: {
  label: string;
  value: number;
  kind?: 'count' | 'rupees';
  hint?: string;
  href: string;
  icon: LucideIcon;
  /** A --status-* token. Drives the icon tile, the bloom and the meter. */
  tone: string;
  /** 0 to 1. How much of this person's register this card accounts for. */
  share?: number;
  urgent?: boolean;
  delay?: number;
}) {
  return (
    <Glow
      color={tone}
      className={cn(
        'a-lift surface-lit h-full overflow-hidden rounded-2xl',
        urgent && 'border-[color-mix(in_oklab,var(--tone)_36%,var(--border-c))]',
      )}
      // The tone is read by the class strings below as well as by Glow, so it is
      // set once here as a variable rather than threaded into six places.
      style={{ '--tone': tone } as CSSProperties}
    >
      <Link href={href} className="group relative z-1 flex h-full flex-col p-4 sm:p-5">
        {urgent && (
          <>
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,transparent,var(--tone),transparent)]"
            />
            {/* A bloom behind the figure, so the number that matters sits in its
                own light rather than being announced by a coloured border. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -top-8 -left-6 size-40 rounded-full bg-[var(--tone)] opacity-[0.13] blur-3xl"
            />
          </>
        )}

        <div className="relative flex items-start justify-between gap-2">
          <span className="a-label pt-1.5 leading-relaxed">{label}</span>
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-xl border transition',
              urgent
                ? 'border-transparent text-white'
                : 'surface-sunken text-subtle group-hover:text-[var(--text-c)]',
            )}
            style={
              urgent
                ? { background: 'var(--tone)', boxShadow: '0 6px 16px color-mix(in oklab, var(--tone) 40%, transparent)' }
                : undefined
            }
          >
            <Icon className="size-4" aria-hidden />
          </span>
        </div>

        {/*
          A rupee total is far longer than a count, so the money card steps back
          down a size once the grid reaches four columns and cannot wrap
          mid-number.
        */}
        <Figure
          value={value}
          kind={kind}
          delay={delay}
          className={cn(
            'relative mt-4 block',
            kind === 'rupees' ? 'text-[1.6rem] sm:text-3xl lg:text-[1.7rem]' : 'text-4xl sm:text-[2.6rem]',
          )}
        />

        {/* How much of the register this card accounts for. Present only where the
            share means something — an empty card has nothing to plot. */}
        {share !== undefined && share > 0 && (
          <div className="a-track relative mt-4 h-1 overflow-hidden rounded-full">
            <span
              className="a-fill absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${Math.min(100, Math.max(3, share * 100))}%`,
                background: 'var(--tone)',
                animationDelay: `${delay + 120}ms`,
              }}
            />
          </div>
        )}

        <div className="relative mt-auto flex items-center gap-1 pt-3">
          <span className="text-subtle text-xs">{hint}</span>
          <ArrowUpRight
            className="text-subtle size-3 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
            aria-hidden
          />
        </div>
      </Link>
    </Glow>
  );
}
