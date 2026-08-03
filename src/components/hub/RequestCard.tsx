import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';

/**
 * The empty slot at the end of the grid.
 *
 * Two reasons it is here and not a piece of padding. It completes the row, so five
 * unbuilt tools do not leave a hole where a sixth card obviously should be. And the
 * roster came from somewhere: every tool on it started as somebody in this firm
 * saying which job they were sick of. Drawn as an empty slot rather than as a card,
 * because that is what it is.
 */
export function RequestCard() {
  return (
    <div className="relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-dashed border-[var(--border-strong)] p-5">
      <div aria-hidden className="a-hatch absolute inset-0 opacity-40" />

      <div className="relative">
        <span
          aria-hidden
          className="surface-sunken text-subtle grid size-10 place-items-center rounded-xl border border-dashed"
        >
          <Sparkles className="size-[1.15rem]" />
        </span>
        <h3 className="m-display mt-4 text-[1.1rem]">Something else</h3>
        <p className="text-muted mt-3 text-[13px] leading-relaxed text-pretty">
          Every tool on this list started as somebody here saying which job they were sick of. If
          the work follows rules, it can be built.
        </p>
      </div>

      <Link
        href="/contact"
        className="group/l relative inline-flex items-center gap-1 text-xs font-semibold transition hover:text-brand-600 dark:hover:text-brand-300"
      >
        Tell us which job
        <ArrowUpRight
          className="size-3.5 transition-transform duration-300 group-hover/l:translate-x-0.5 group-hover/l:-translate-y-0.5"
          aria-hidden
        />
      </Link>
    </div>
  );
}
