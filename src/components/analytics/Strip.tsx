import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The summary strip a secondary analytics screen opens with, under its header.
 *
 * The overview has the hero; the screens behind it do not get a second arch
 * each, because one signature moment per section is what keeps the arch
 * meaning something. What they get instead is this: the screen's handful of
 * headline counts set as instruments in one lit panel, divided by hairlines,
 * each with a dot in the colour it carries elsewhere on the page and a note
 * saying what it rests on. One panel rather than a row of loose tiles, so the
 * figures read as one reading of one thing.
 *
 * `strong` marks the cell that answers the screen's question. It takes the
 * action fill, the same way the strong HeroStat does under a hero.
 */
export type StripCell = {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  /** A token colour. Always paired with the label, never standing alone. */
  tone?: string;
  strong?: boolean;
};

export function SummaryStrip({ cells, className }: { cells: StripCell[]; className?: string }) {
  return (
    <section
      className={cn(
        'surface-lit a-ring animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] overflow-hidden rounded-3xl p-2',
        className,
      )}
    >
      <dl
        className={cn(
          'grid gap-2',
          // Two across on a phone whatever the count; from sm up, the count
          // decides, so three cells are never stretched over a four-column grid.
          'grid-cols-2',
          cells.length === 3 && 'sm:grid-cols-3',
          cells.length === 4 && 'sm:grid-cols-4',
          cells.length >= 5 && 'sm:grid-cols-3 lg:grid-cols-5',
        )}
      >
        {cells.map((cell, index) => (
          <div
            key={cell.label}
            className={cn(
              'min-w-0 rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4',
              cell.strong
                ? 'bg-[var(--action)] text-[var(--on-action)] shadow-[var(--elev-brand)]'
                : 'surface-sunken border',
              // An odd count on a phone leaves one cell alone on the last row;
              // let it take the whole row rather than half of it.
              cells.length % 2 === 1 && index === cells.length - 1 && 'col-span-2 sm:col-span-1',
            )}
          >
            <dt
              className={
                cell.strong
                  ? 'truncate text-[10px] font-semibold tracking-[0.12em] uppercase opacity-75'
                  : 'a-label truncate'
              }
            >
              <span className="inline-flex items-center gap-1.5">
                {cell.tone && !cell.strong && (
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: cell.tone }} />
                )}
                {cell.label}
              </span>
            </dt>
            <dd className="mt-2 truncate text-[1.6rem] leading-none font-semibold tracking-[-0.03em] tabular-nums sm:text-[1.85rem]">
              {cell.value}
            </dd>
            {cell.note && (
              <dd
                className={cn(
                  'mt-1.5 text-[12px] leading-snug text-pretty',
                  cell.strong ? 'opacity-75' : 'text-subtle',
                )}
              >
                {cell.note}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
