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

  return (
    <ol className="flex items-center gap-1.5 sm:gap-2" aria-label="Progress">
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
                done || on
                  ? 'gradient-brand elev-brand text-white'
                  : 'surface-sunken text-subtle border',
              )}
            >
              {done ? <Check className="size-3" strokeWidth={3.5} /> : i + 1}
            </span>
            <span
              className={cn(
                'truncate text-[12.5px] transition-colors',
                on ? 'font-semibold' : done ? 'text-muted' : 'text-subtle',
              )}
            >
              {/* The long label from `sm`, where there is room for four of them. */}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.short}</span>
            </span>
          </>
        );

        return (
          <li key={step.id} className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  'h-px w-3 shrink-0 rounded-full sm:w-6',
                  done || on ? 'bg-[var(--color-brand-500)]' : 'bg-[var(--border-strong)]',
                )}
              />
            )}
            {reachable ? (
              <button
                type="button"
                onClick={() => onGo?.(step.id)}
                aria-current={on ? 'step' : undefined}
                className="flex min-w-0 items-center gap-2 rounded-lg py-0.5 transition hover:opacity-80"
              >
                {body}
              </button>
            ) : (
              <span
                aria-current={on ? 'step' : undefined}
                className="flex min-w-0 items-center gap-2 py-0.5"
              >
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
