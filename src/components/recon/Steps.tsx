'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Where you are in a reconciliation.
 *
 * Four steps, and the reason this is on screen rather than implied is that step
 * two exists. Nobody arrives expecting to be asked about columns, and a person
 * who thinks they are one click from an answer reads that step as an obstacle.
 * Shown as a numbered rail from the start, it reads as the second of four
 * instead.
 *
 * Completed steps are clickable and later ones are not. Going back has to be
 * free — the whole step two is somebody correcting a guess — but jumping forward
 * to a screen whose input does not exist yet is not a navigation, it is a bug
 * waiting to be filed.
 */

export type StepId = 'upload' | 'columns' | 'configure' | 'result';

export const STEPS: { id: StepId; label: string; short: string }[] = [
  { id: 'upload', label: 'Upload ledgers', short: 'Upload' },
  { id: 'columns', label: 'Match columns', short: 'Columns' },
  { id: 'configure', label: 'Set the date', short: 'Date' },
  { id: 'result', label: 'Statement', short: 'Result' },
];

export function Steps({
  current,
  onGo,
}: {
  current: StepId;
  /** Only called for a step already completed. */
  onGo?: (step: StepId) => void;
}) {
  const index = STEPS.findIndex((s) => s.id === current);

  /*
   * A segmented track rather than four numbers on a hairline. It sits inside the
   * hero now, under the headline, and at that size a row of 24px dots read as a
   * footnote; four cells on one track read as a journey with a length. The cell
   * for the current step is raised off the track, the way a selected segment is
   * everywhere else in the app.
   */
  return (
    <ol
      className="surface-sunken a-inner grid grid-cols-4 gap-1 rounded-2xl border p-1"
      aria-label="Progress"
    >
      {STEPS.map((step, i) => {
        const done = i < index;
        const on = i === index;
        const reachable = done && Boolean(onGo);

        const body = (
          <>
            <span
              aria-hidden
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold transition',
                done || on ? 'gradient-brand elev-brand' : 'surface text-subtle border',
              )}
            >
              {done ? <Check className="size-3" strokeWidth={3.5} /> : i + 1}
            </span>
            <span className="block min-w-0">
              <span className="text-subtle hidden text-[10px] font-semibold tracking-[0.1em] uppercase md:block">
                Step {i + 1}
              </span>
              <span
                className={cn(
                  'block truncate text-[12px] transition-colors sm:text-[13px]',
                  on ? 'font-semibold' : done ? 'text-muted' : 'text-subtle',
                )}
              >
                {/* The long label from `sm`, where there is room for four of them. */}
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.short}</span>
              </span>
            </span>
          </>
        );

        // Stacked on a phone, where a quarter of 320px will not take a tile and
        // a word side by side; in a row from `sm`.
        const cell = cn(
          'flex h-full w-full min-w-0 flex-col items-start gap-1.5 rounded-xl px-2 py-2 text-left sm:flex-row sm:items-center sm:gap-2.5 sm:px-3 sm:py-2.5',
          on && 'surface-lit elev-1',
        );

        return (
          <li key={step.id} className="min-w-0">
            {reachable ? (
              <button
                type="button"
                onClick={() => onGo?.(step.id)}
                title={`Back to ${step.label.toLowerCase()}`}
                className={cn(cell, 'transition hover:bg-[var(--surface-raised)]')}
              >
                {body}
              </button>
            ) : (
              <span aria-current={on ? 'step' : undefined} className={cell}>
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
