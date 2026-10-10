import Link from 'next/link';
import { ArrowRight, MessageCircleQuestion } from 'lucide-react';
import { LogoMark } from '@/components/marketing/Logo';
import { buttonClass } from '@/components/ui/primitives';
import { suggestionsFor } from '@/lib/assist/suggestions';
import { cn } from '@/lib/utils';

/*
 * How many columns the card takes at each breakpoint, so the row it closes is
 * full. Written out as whole class names because Tailwind only generates the
 * classes it can find in the source, and `xl:col-span-${n}` is not one.
 */
const MD_SPAN = { 1: 'md:col-span-1', 2: 'md:col-span-2' } as const;
const XL_SPAN = { 1: 'xl:col-span-1', 2: 'xl:col-span-2', 3: 'xl:col-span-3' } as const;

/**
 * What is left of the last row, or a whole row when the last one is full.
 * Exported for the roadmap grid, whose closing card has the same job.
 */
export function remaining(count: number, columns: number) {
  const left = columns - (count % columns);
  return left === columns ? columns : left;
}

/**
 * The door for somebody who does not know which door they want.
 *
 * The live grid used to end on a hole: five tools in rows of three left the
 * last row a card short, and a gap at the end of the one grid that matters
 * reads as something that failed to load. Filling it with decoration would be
 * the mockup this workspace keeps refusing to be. Filling it with the
 * assistant is not, because "which of these should I be using" is the one
 * question a person standing on this screen genuinely has, and the assistant
 * knows every tool on it.
 *
 * It takes whatever is left of the row — one column, two, or a whole row of its
 * own — and lays itself out for the room it gets, with a container query
 * rather than a breakpoint, because its width depends on the count of tools
 * above it and not on the window.
 *
 * The questions on it are the assistant's own opening suggestions, from the
 * same list its empty screen shows, so the card promises nothing the screen
 * behind it does not offer.
 */
export function AskCard({ liveCount }: { liveCount: number }) {
  const md = remaining(liveCount, 2) as 1 | 2;
  const xl = remaining(liveCount, 3) as 1 | 2 | 3;
  const questions = suggestionsFor(null).slice(0, 3);

  return (
    <div
      className={cn(
        '@container h-full animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_300ms_backwards]',
        MD_SPAN[md],
        XL_SPAN[xl],
      )}
    >
      <div className="surface-lit a-ring a-lift group relative flex h-full flex-col overflow-hidden rounded-3xl">
        <span
          aria-hidden
          className="a-orb -right-16 -bottom-24 size-72 opacity-25 transition-opacity duration-500 group-hover:opacity-45"
          style={{
            background: 'radial-gradient(circle, var(--color-brand-500), transparent 68%)',
          }}
        />
        <span
          aria-hidden
          className="a-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(70%_70%_at_85%_100%,#000,transparent)]"
        />

        <Link
          href="/ask"
          className="absolute inset-0 z-20 rounded-3xl focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:outline-none"
        >
          <span className="sr-only">Ask the assistant</span>
        </Link>

        <div className="relative grid flex-1 gap-6 p-5 sm:p-6 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] @xl:items-center @xl:gap-10">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="surface-sunken a-inner grid size-11 shrink-0 place-items-center rounded-2xl border"
              >
                <LogoMark id="hub-ask-mark" className="size-7" />
              </span>
              <div className="min-w-0">
                <h2 className="m-display text-[1.2rem] leading-tight">Not sure which one?</h2>
                <p className="a-label mt-1.5">Ask, the assistant</p>
              </div>
            </div>

            <p className="text-muted mt-4 text-[13.5px] leading-relaxed text-pretty">
              It knows every tool here and the accounting behind them, does its sums with the same
              code the tools use, and says where each answer came from.
            </p>

            <div className="mt-5">
              <span
                aria-hidden
                className={buttonClass({
                  variant: 'secondary',
                  className: 'group-hover:border-[var(--border-strong)]',
                })}
              >
                Ask a question
                <ArrowRight
                  className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden
                />
              </span>
            </div>
          </div>

          {/* What people ask first. Not buttons: the whole card is the link,
              and the questions are there to show the range, not to be picked. */}
          <div className="surface-sunken a-inner min-w-0 rounded-2xl border p-4">
            <p className="a-label">Start with</p>
            <ul className="mt-3 space-y-2">
              {questions.map((q) => (
                <li
                  key={q.label}
                  className="surface-lit flex items-start gap-2.5 rounded-xl px-3 py-2.5"
                >
                  <MessageCircleQuestion
                    className="mt-0.5 size-3.5 shrink-0 text-[var(--color-brand-500)]"
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold tracking-tight">
                      {q.label}
                    </span>
                    <span className="text-subtle mt-0.5 block text-[11.5px] leading-snug text-pretty">
                      {q.question}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
