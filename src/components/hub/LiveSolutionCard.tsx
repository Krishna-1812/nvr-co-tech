import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, type LucideIcon } from 'lucide-react';
import type { Solution } from '@/lib/solutions';
import { Figure } from '@/components/app/Figure';
import { Glow } from '@/components/app/Glow';
import { buttonClass } from '@/components/ui/primitives';

/** One number on the tool's instrument panel. */
export type Reading = {
  label: string;
  value: number;
  /** Colour for the figure once it is not zero. Left off for a neutral count. */
  tone?: string;
  /** Longer form, for the title attribute. */
  hint?: string;
};

/**
 * A tool you can actually use, at full size.
 *
 * The one thing that separates this from a brochure tile is the instrument panel:
 * three figures read out of the tool's own tables at request time. A launcher that
 * only says "Voucher Desk — payments and approvals" is a menu, and you have to open
 * it to find out whether anything is waiting. With the figures on the front you can
 * often see that nothing needs you and not open it at all, which is the best outcome
 * a screen like this can produce.
 *
 * The whole surface is the link. The one control layered above it is the shortcut,
 * because "raise a payment" is the other reason anybody comes here and it should not
 * cost a second page load.
 */
export function LiveSolutionCard({
  solution,
  readings,
  note,
  noteTone,
  shortcut,
}: {
  solution: Solution;
  readings: Reading[];
  /** The routing sentence: what, if anything, is waiting for this person. */
  note: string;
  noteTone?: string;
  /**
   * The second reason somebody comes here. Its mark defaults to a plus, which
   * suits "raise one of these" and suits nothing else — a tool whose shortcut is
   * a destination rather than a creation passes its own.
   */
  shortcut?: { href: string; label: string; icon?: LucideIcon };
}) {
  const { icon: Icon, tone, open } = solution;
  const ShortcutIcon = shortcut?.icon ?? Plus;

  return (
    <Glow
      color={tone}
      radius={560}
      strength={0.09}
      style={{ '--tone': tone } as CSSProperties}
      className="surface-lit a-ring a-lift group relative overflow-hidden rounded-3xl"
    >
      {/* Atmosphere in the tool's own colour, so the live card is lit and the five
          unbuilt ones are not. */}
      <span
        aria-hidden
        className="a-orb -top-28 -right-16 size-80 opacity-60 transition-opacity duration-500 group-hover:opacity-90"
        style={{ background: `radial-gradient(circle, ${tone}, transparent 68%)` }}
      />
      <div
        aria-hidden
        className="a-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(72%_64%_at_12%_0%,#000,transparent)]"
      />
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${tone}, transparent)` }}
      />

      {/*
        Stretched over the whole card rather than wrapped around it, which is what
        lets the shortcut below be a second link instead of a button that cannot be
        nested inside the first. The focus ring is on this element and follows the
        card's radius, so a keyboard user sees the card itself take focus.
      */}
      {open && (
        <Link
          href={open}
          className="absolute inset-0 z-20 rounded-3xl focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:outline-none"
        >
          <span className="sr-only">Open {solution.name}</span>
        </Link>
      )}

      <div className="relative grid gap-7 p-5 sm:p-7 lg:grid-cols-[1fr_20rem] lg:items-stretch lg:gap-9 lg:p-8">
        {/* ── What it is ── */}
        <div className="min-w-0">
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden
              className="tinted grid size-11 shrink-0 place-items-center rounded-xl border"
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h2 className="m-display text-[clamp(1.35rem,2.6vw,1.75rem)]">{solution.name}</h2>
                <span
                  style={{ '--tone': 'var(--status-approved)' } as CSSProperties}
                  className="tinted inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
                >
                  <span className="a-blip size-1.5 rounded-full bg-current" aria-hidden />
                  Live
                </span>
              </div>
              <p className="a-label mt-1.5" style={{ color: tone }}>
                {solution.category}
              </p>
            </div>
          </div>

          <p className="text-muted mt-4 max-w-xl text-[14.5px] leading-relaxed text-pretty">
            {solution.summary}
          </p>

          {/*
            What goes in and what comes out. The shortest honest description of any
            of these tools, and the one that survives on a card.

            Stacked rather than set on one line, for the same reason as on the small
            cards: side by side, a phone cut "Invoice, event, chapter, payee,
            amounts" down to two words. Two lines of 10px mono cost nothing.
          */}
          <div className="mt-5 space-y-1">
            <p className="a-label">{solution.inputs}</p>
            <p className="a-label flex items-start gap-1.5" style={{ color: tone }}>
              <ArrowRight className="mt-px size-3 shrink-0" aria-hidden />
              {solution.outputs}
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            {/* Looks like the primary control and is not focusable, because the
                stretched link above already is. Two tab stops for one destination
                would be a snag, not an affordance. */}
            <span
              aria-hidden
              className={buttonClass({
                variant: 'primary',
                className: 'group-hover:brightness-110',
              })}
            >
              Open {solution.name}
              <ArrowRight
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden
              />
            </span>

            {shortcut && (
              <Link
                href={shortcut.href}
                className={buttonClass({ variant: 'secondary', className: 'relative z-30 group/s' })}
              >
                <ShortcutIcon
                  className={
                    shortcut.icon
                      ? 'size-4'
                      : 'size-4 transition-transform duration-300 group-hover/s:rotate-90'
                  }
                  aria-hidden
                />
                {shortcut.label}
              </Link>
            )}
          </div>
        </div>

        {/* ── What it says right now ── */}
        <div className="surface-sunken a-inner relative flex flex-col rounded-2xl border p-4">
          <p className="a-label">Your desk right now</p>

          <dl className="mt-4 grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-0">
            {readings.map((r, i) => (
              <div
                key={r.label}
                title={r.hint}
                className="min-w-0 lg:flex lg:items-baseline lg:justify-between lg:gap-3 lg:border-b lg:border-dashed lg:py-2.5 lg:first:pt-0 lg:last:border-0 lg:last:pb-0"
              >
                {/* Clipped only in the single-line rows from `lg`. Three abreast on
                    a phone there is no room for "Yours in FY 26-27" on one line, and
                    a wrapped label is better than "Yours in FY 26-…". */}
                <dt className="text-muted order-2 mt-1 text-[11px] lg:order-1 lg:mt-0 lg:truncate lg:text-xs">
                  {r.label}
                </dt>
                <dd
                  className="order-1 lg:order-2"
                  style={r.value > 0 && r.tone ? { color: r.tone } : undefined}
                >
                  <Figure
                    value={r.value}
                    delay={i * 90}
                    className="text-[1.6rem] lg:text-[1.45rem]"
                  />
                </dd>
              </div>
            ))}
          </dl>

          {/*
            The sentence that decides why you are here. It sits under the figures
            rather than above them because the figures are the evidence for it.
          */}
          <p
            style={{ '--tone': noteTone ?? 'var(--status-draft)' } as CSSProperties}
            className="tinted mt-4 rounded-xl border px-3 py-2 text-[12.5px] font-medium text-pretty lg:mt-auto"
          >
            {note}
          </p>
        </div>
      </div>
    </Glow>
  );
}
