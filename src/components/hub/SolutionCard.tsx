import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { STAGE_LABEL } from '@/lib/marketing/content';
import { STAGE_NOTE, STAGE_TONE, type Solution } from '@/lib/solutions';
import { cn } from '@/lib/utils';
import { WantThis } from './WantThis';

/**
 * A tool that is not built yet.
 *
 * Written to be honest rather than tempting. Five confident tiles that all lead
 * nowhere is the fastest way to make a workspace feel like a mockup, so an unbuilt
 * tool gets the same card material as the live one and none of its signals: no
 * coloured light, no lift under the pointer, and no button. What it does get is its
 * colour on the top edge and in the category line, which is what keeps the grid
 * looking like a roster instead of a queue of greyed-out rows.
 *
 * The one link is to the tool's page on the public site, where what it will do is
 * written down in specifics. That is a better answer to "when do I get this" than a
 * disabled button.
 *
 * There is now one control beside it, and it is not a disabled button either: an
 * "I want this" that records the ask against this person and shows up on an
 * internal screen. It earns its place because it does something — what gets built
 * next is decided partly by this — where a greyed-out Open never would.
 */
export function SolutionCard({ solution, asked = false }: { solution: Solution; asked?: boolean }) {
  const { icon: Icon, tone, stage } = solution;

  // In build gets its colour on the mark; on the roadmap does not. The same
  // distinction the roster meter above the grid draws, so the two agree.
  const marked = stage === 'building';

  return (
    <div
      style={{ '--tone': tone } as CSSProperties}
      className="surface-lit a-ring group relative flex h-full flex-col overflow-hidden rounded-3xl transition-colors duration-300 hover:border-[var(--border-strong)]"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px opacity-50 transition-opacity duration-300 group-hover:opacity-90"
        style={{ background: `linear-gradient(90deg, transparent, ${tone}, transparent)` }}
      />

      <div className="relative flex-1 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span
            aria-hidden
            className={cn(
              'a-inner grid size-11 shrink-0 place-items-center rounded-2xl border',
              marked ? 'tinted' : 'surface-sunken text-subtle',
            )}
          >
            <Icon className="size-5" />
          </span>

          <span
            style={{ '--tone': STAGE_TONE[stage] } as CSSProperties}
            className="tinted inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
          >
            {STAGE_LABEL[stage]}
          </span>
        </div>

        <h3 className="m-display mt-4 text-[1.15rem] leading-tight">{solution.name}</h3>
        <p className="a-label mt-1.5" style={{ color: tone }}>
          {solution.category}
        </p>

        <p className="text-muted mt-3 text-[13px] leading-relaxed text-pretty">
          {solution.summary}
        </p>

        {/*
          What goes in, and what comes out.
          Stacked rather than set on one line with an arrow between them. Side by
          side in a 340px card both halves truncated to about three words, and
          "BANK STATEMENTS… → MATCHED LINES, …" tells you nothing that the card
          did not already say. Two lines cost nothing and can be read.
        */}
        <dl className="surface-sunken mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-2xl border px-3.5 py-3 text-[12px] leading-snug">
          {/* The same Takes / Gives specification the live cards carry, set
              in a sunken well here because this card has no instrument
              panel to give it a lower half. */}
          <dt className="a-label pt-px">Takes</dt>
          <dd className="text-muted min-w-0 text-pretty">{solution.inputs}</dd>
          <dt className="a-label pt-px" style={{ color: tone }}>
            Gives
          </dt>
          <dd className="flex min-w-0 items-start gap-1.5 text-pretty">
            <ArrowRight className="mt-[2px] size-3 shrink-0" style={{ color: tone }} aria-hidden />
            {solution.outputs}
          </dd>
        </dl>
      </div>

      <div className="surface-sunken relative flex items-center justify-between gap-3 border-t px-5 py-3 sm:px-6">
        <span className="a-label truncate">{STAGE_NOTE[stage]}</span>
        <span className="flex shrink-0 items-center gap-4">
          <WantThis slug={solution.slug} asked={asked} />
          <Link
            href={solution.plan}
            className="group/l inline-flex shrink-0 items-center gap-1 text-xs font-semibold transition hover:text-brand-600 dark:hover:text-brand-300"
          >
            The plan
            <ArrowUpRight
              className="size-3.5 transition-transform duration-300 group-hover/l:translate-x-0.5 group-hover/l:-translate-y-0.5"
              aria-hidden
            />
          </Link>
        </span>
      </div>
    </div>
  );
}
