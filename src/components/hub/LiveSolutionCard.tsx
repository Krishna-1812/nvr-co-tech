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
 * A tool you can actually use.
 *
 * The one thing that separates this from a brochure tile is the instrument panel:
 * the figures read out of the tool's own tables at request time. A launcher that
 * only says "Voucher Desk — payments and approvals" is a menu, and you have to open
 * it to find out whether anything is waiting. With the figures on the front you can
 * often see that nothing needs you and not open it at all, which is the best outcome
 * a screen like this can produce.
 *
 * ── Why this is a column and not a wide slab ────────────────────────────────
 *
 * It used to be a full-width card split `1fr 20rem` — description on the left,
 * instrument panel on the right — stacked one per row. Four of those is four
 * screens of scrolling to answer "which of my tools needs me", which is the one
 * question this page exists for. Worse, the wide form gave the description a
 * 60rem measure: the summary ran to a single line of about 140 characters, and
 * nothing on the card had a shape.
 *
 * As a column at a third of the width every part of it gets a sensible measure,
 * the figures sit three abreast where they read as instrumentation rather than
 * as a list, and three tools fit above the fold. The trade is that the summary
 * now wraps to three or four lines, which is what a paragraph is supposed to do.
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
      radius={420}
      strength={0.08}
      style={{ '--tone': tone } as CSSProperties}
      className="surface-lit a-ring a-lift group relative flex h-full flex-col overflow-hidden rounded-3xl"
    >
      {/*
        Atmosphere in the tool's own colour, so a live card is lit and the
        unbuilt ones are not. Two thirds the size it was, because the card is a
        third of the width it was — an orb that filled a slab's top corner fills
        a column outright, and then the card has no corner left to catch light.
      */}
      <span
        aria-hidden
        className="a-orb -top-20 -right-12 size-56 opacity-30 transition-opacity duration-500 group-hover:opacity-55"
        style={{ background: `radial-gradient(circle, ${tone}, transparent 68%)` }}
      />
      <div
        aria-hidden
        className="a-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(78%_60%_at_16%_0%,#000,transparent)]"
      />
      {/* The lit top edge, brightening on hover. It is the only thing on the card
          that moves under the pointer besides the lift and the arrow. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px opacity-70 transition-opacity duration-500 group-hover:opacity-100"
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
          className="absolute inset-0 z-20 rounded-3xl focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:outline-none"
        >
          <span className="sr-only">Open {solution.name}</span>
        </Link>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col p-5 sm:p-6">
        {/* ── What it is ── */}
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="tinted grid size-10 shrink-0 place-items-center rounded-xl border"
          >
            <Icon className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2 className="m-display text-[1.2rem] leading-tight">{solution.name}</h2>
              <LiveBadge />
            </div>
            <p className="a-label mt-1.5" style={{ color: tone }}>
              {solution.category}
            </p>
          </div>
        </div>

        <p className="text-muted mt-4 text-[13.5px] leading-relaxed text-pretty">
          {solution.summary}
        </p>

        {/*
          What goes in and what comes out. The shortest honest description of any
          of these tools, and the one that survives on a card.
        */}
        <div className="mt-4 space-y-1">
          <p className="a-label leading-relaxed">{solution.inputs}</p>
          <p className="a-label flex items-start gap-1.5 leading-relaxed" style={{ color: tone }}>
            <ArrowRight className="mt-[3px] size-3 shrink-0" aria-hidden />
            {solution.outputs}
          </p>
        </div>

        {/*
          Everything below here is pushed to the foot of the card by `mt-auto`,
          so the instrument panels and the buttons line up across a row however
          long each tool's summary happens to run. Without it a three-line
          summary and a five-line one put their figures at different heights and
          the row stops reading as a set.
        */}
        {/* `pt-6` is the floor under the flexible margin: on the tallest card in
            a row `mt-auto` resolves to nothing, and without it the rule would
            sit hard against the line above. */}
        <div className="mt-auto pt-6">
          {/*
            The rule that makes the gap above it deliberate.

            `mt-auto` leaves a different amount of slack in every card, because
            the summaries are different lengths and the bottoms have to line up.
            Unspoken, that reads as three cards each with a slightly wrong
            amount of air in the middle. With a hairline at the foot of it, the
            same space reads as the margin above a rule — the card is divided
            into what the tool is and what it currently says, which is exactly
            what the two halves are.

            It fades out to the right rather than reaching the far edge, so it
            reads as a division inside the card and not as the card being cut in
            two.
          */}
          <span
            aria-hidden
            className="block h-px bg-[linear-gradient(90deg,var(--border-strong),transparent_78%)]"
          />

          {/* ── What it says right now ── */}
          <div className="surface-sunken a-inner mt-5 rounded-2xl border p-4">
            <p className="a-label">Your desk right now</p>

            {/*
              Abreast rather than stacked. Two or three figures side by side read
              as one instrument with several needles; the same figures in a
              column read as a list you have to go down. The column count is
              inline because it follows the data — Valuation Desk and Contact
              Finder have two readings, the other two have three — and Tailwind
              cannot generate a class from a runtime value.
            */}
            <dl
              className="mt-3.5 grid gap-3"
              style={{ gridTemplateColumns: `repeat(${readings.length}, minmax(0, 1fr))` }}
            >
              {readings.map((r, i) => (
                <div key={r.label} title={r.hint} className="min-w-0">
                  <dd style={r.value > 0 && r.tone ? { color: r.tone } : undefined}>
                    <Figure value={r.value} delay={i * 90} className="text-[1.6rem]" />
                  </dd>
                  {/* Not truncated. At this width "Yours in FY 26-27" needs two
                      lines, and two lines of 10px mono is better than an
                      ellipsis in the middle of the only thing naming the
                      figure above it. */}
                  <dt className="text-muted mt-1.5 text-[10.5px] leading-snug">{r.label}</dt>
                </div>
              ))}
            </dl>

            {/*
              The sentence that decides why you are here. It sits under the figures
              rather than above them because the figures are the evidence for it.

              Floored at two lines, and centred inside that.

              Measured across a row: every figure label is one line and every
              `dl` is exactly 48px, so the note was the *only* thing making one
              card's panel 20px shorter than its neighbours' — a one-line
              sentence against a two-line one. Since the cards are bottom
              anchored, that pushed one instrument panel 20px down the card and
              broke the alignment the row is for. A floor of two lines absorbs
              it, and a longer note still grows past it.
            */}
            <p
              style={{ '--tone': noteTone ?? 'var(--status-draft)' } as CSSProperties}
              className="tinted mt-4 flex min-h-[3.5rem] items-center rounded-xl border px-3 py-2 text-[12px] leading-relaxed font-medium text-pretty"
            >
              {note}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {/*
              "Open", not "Open Voucher Desk". The name is two centimetres above
              it and repeating it here cost a third of the card's width — with a
              shortcut beside it, "Open Ledger Reconciliation" wrapped the row.
              The stretched link above still carries the full name for a screen
              reader, so nothing is lost where it matters.

              Looks like the primary control and is not focusable, because that
              stretched link already is. Two tab stops for one destination would
              be a snag, not an affordance.
            */}
            <span
              aria-hidden
              className={buttonClass({
                variant: 'primary',
                className: 'group-hover:brightness-110',
              })}
            >
              Open
              <ArrowRight
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden
              />
            </span>

            {shortcut && (
              <Link
                href={shortcut.href}
                className={buttonClass({ variant: 'secondary', className: 'group/s relative z-30' })}
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
      </div>
    </Glow>
  );
}

/** The one badge on the card. Its own component only to keep the head readable. */
function LiveBadge() {
  return (
    <span
      style={{ '--tone': 'var(--status-approved)' } as CSSProperties}
      className="tinted inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9.5px] font-bold tracking-[0.08em] uppercase"
    >
      <span className="a-blip size-1.5 rounded-full bg-current" aria-hidden />
      Live
    </span>
  );
}
