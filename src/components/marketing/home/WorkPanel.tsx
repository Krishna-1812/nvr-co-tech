import type React from 'react';
import { Check, ClipboardCheck } from 'lucide-react';

/**
 * The hero's product panel: a month's work, done, waiting on one person.
 *
 * It says the headline in the product's own shape — "We handle the repetitive
 * work. You make the calls." — rather than showing one tool. It used to be a
 * single expense voucher mid-approval (a voucher number, a chapter, IGST, TDS
 * 194C, a named approver), which made the first screen of the whole site read
 * as a page about vouchers. The owner asked for something that belongs to every
 * tool, so the card is the thing all of them do: read the documents, work the
 * figures out, check every line, set aside what does not fit with the reason,
 * and hand the decision to a person.
 *
 * No figures and no names. There is nothing here a reader could hold the
 * product to that it does not do, and nothing invented to look busy.
 *
 * The ticks land one after another as the card arrives, behind the opening
 * curtain like the rest of the hero (--intro-wait), and the last node — you —
 * is the one still waiting. Reduced motion shows the card finished.
 */

const DONE = [
  'Documents read',
  'Figures worked out',
  'Every line checked',
  'Exceptions set aside, with the reason',
] as const;

/*
 * In classes rather than an inline style, so reduced motion can switch it off:
 * the global rule there shortens an animation but keeps its delay, which would
 * leave the rows invisible for a second and a half and then snap them in.
 */
const TICK = 'animate-rise [animation-delay:var(--d)] motion-reduce:animate-none';

/** When each tick lands, after the card has risen into place. */
const at = (i: number) => `calc(var(--intro-wait, 0ms) + ${650 + i * 170}ms)`;

export function WorkPanel() {
  return (
    <div className="relative">
      <div className="m-card relative overflow-hidden rounded-2xl shadow-[var(--m-shadow)]">
        {/*
          The lit edge. Brightest at the middle and gone by both corners, so it
          reads as light landing on the card rather than as a stripe drawn on it.
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-10 top-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--m-gold), transparent)',
            opacity: 0.55,
          }}
        />

        {/* ── Card head: stacked below xl, where the arch walls narrow the column ── */}
        <div className="flex flex-col gap-3 border-b border-[var(--m-line)] px-5 py-4 xl:flex-row xl:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-lg"
              style={{ background: 'color-mix(in oklab, var(--m-indigo) 22%, transparent)' }}
            >
              <ClipboardCheck className="size-4 text-[var(--m-indigo)]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="m-mono truncate t-2 t-caps">This month&rsquo;s work</p>
              <p className="m-dim-2 mt-0.5 t-2">Prepared and checked</p>
            </div>
          </div>
          <span className="m-mono self-start shrink-0 rounded-full border border-[var(--m-wait-line)] bg-[var(--m-wait-wash)] px-2.5 py-1 t-1 font-semibold t-caps uppercase text-[var(--m-wait)] xl:ml-auto xl:self-auto">
            Ready for you
          </span>
        </div>

        {/* ── What was done ── */}
        <ul className="space-y-3 px-5 py-5">
          {DONE.map((label, i) => (
            <li
              key={label}
              className={`flex items-center justify-between gap-4 ${TICK}`}
              style={{ '--d': at(i) } as React.CSSProperties}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-[color-mix(in_oklab,var(--m-emerald)_45%,transparent)] bg-[color-mix(in_oklab,var(--m-emerald)_16%,transparent)]">
                  <Check className="size-3.5 text-[var(--m-emerald)]" aria-hidden />
                </span>
                <span className="m-dim t-3">{label}</span>
              </span>
              <span className="m-mono m-dim-2 shrink-0 t-1 t-caps uppercase">Done</span>
            </li>
          ))}

          {/* What is left: the one thing the tools do not do. */}
          <li
            className={`mt-3 flex items-end justify-between gap-4 border-t border-[var(--m-line)] pt-4 ${TICK}`}
            style={{ '--d': at(DONE.length) } as React.CSSProperties}
          >
            <span className="m-eyebrow whitespace-nowrap">Left to you</span>
            {/* Inline, because .m-display's own wrap rule is unlayered and outranks a utility. */}
            <span className="m-display t-6 sm:t-7" style={{ whiteSpace: 'nowrap' }}>
              The decision
            </span>
          </li>
        </ul>

        {/* ── The hand-off: the work's two stages, then you ── */}
        <div className="border-t border-[var(--m-line)] bg-[var(--m-bg)] px-5 py-5">
          <div className="flex items-center gap-2">
            <Node name="Prepared" caption="Done" state="done" />
            <Connector filled />
            <Node name="Checked" caption="Done" state="done" />
            <Connector />
            <Node name="You" caption="Your call" state="waiting" />
          </div>

          <p className="m-dim-2 mt-4 t-2">The work is done. The decision stays with you.</p>
        </div>
      </div>
    </div>
  );
}

function Node({ name, caption, state }: { name: string; caption: string; state: 'done' | 'waiting' }) {
  const done = state === 'done';
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <span
        className={
          done
            ? 'grid size-8 place-items-center rounded-full border border-[color-mix(in_oklab,var(--m-emerald)_45%,transparent)] bg-[color-mix(in_oklab,var(--m-emerald)_16%,transparent)]'
            : 'relative grid size-8 place-items-center rounded-full border border-dashed border-[var(--m-line-2)]'
        }
      >
        {done ? (
          <Check className="size-4 text-[var(--m-emerald)]" aria-hidden />
        ) : (
          <span className="size-1.5 animate-[breathe_4.5s_ease-in-out_infinite] rounded-full bg-[var(--m-amber)]" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate t-2 font-medium">{name}</span>
        <span className="m-dim-2 mt-0.5 block t-1" style={{ whiteSpace: 'nowrap' }}>
          {caption}
        </span>
      </span>
    </div>
  );
}

/** The segment between two nodes. The unfilled one carries a travelling highlight. */
function Connector({ filled }: { filled?: boolean }) {
  return (
    <span
      aria-hidden
      className="relative -mt-6 h-px flex-1 overflow-hidden"
      style={{
        background: filled ? 'color-mix(in oklab, var(--m-emerald) 45%, transparent)' : 'var(--m-line-2)',
      }}
    >
      {!filled && (
        <span
          className="absolute inset-y-0 w-1/3 animate-[sweep_3.2s_ease-in-out_infinite]"
          style={{ background: 'linear-gradient(90deg, transparent, var(--m-amber), transparent)' }}
        />
      )}
    </span>
  );
}
