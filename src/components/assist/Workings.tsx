'use client';

import type { CSSProperties } from 'react';
import { AlertTriangle, Sigma } from 'lucide-react';
import type { ToolTrace } from '@/lib/assist/types';

/**
 * The arithmetic, shown separately from the answer.
 *
 * Every figure the assistant quotes came from one of these, computed by the same
 * functions the voucher form and the reconciliation engine use, rather than by
 * the model. That is the strongest claim this feature makes, and a claim nobody
 * can see is not worth making. So the working is printed under the answer, in
 * the mono face, with the arguments it was given.
 *
 * It reads as instrumentation rather than as prose on purpose. A reader
 * comparing a total against their own spreadsheet wants to see the inputs, and
 * this is the line they check.
 */

/** `basic_value` reads as a field name. "Basic value" reads as a label. */
function label(key: string): string {
  const words = key.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function value(input: unknown): string {
  if (typeof input === 'number') return input.toLocaleString('en-IN');
  if (typeof input === 'boolean') return input ? 'yes' : 'no';
  return String(input);
}

export function Workings({ traces }: { traces: ToolTrace[] }) {
  if (traces.length === 0) return null;

  return (
    <div className="mt-3.5 space-y-2.5">
      {traces.map((trace, i) => {
        const args = Object.entries(trace.args).filter(
          // A zero the model sent because a field exists is noise; a zero the
          // reader actually gave is not, and the two are indistinguishable here.
          // Dropping both is the lesser error, because the figures that matter
          // are all in the summary line.
          ([, v]) => v !== null && v !== undefined && v !== '' && v !== 0,
        );
        const tone = trace.ok ? 'var(--status-approved)' : 'var(--status-warn)';

        /*
         * Set like the working under a True Property Cost answer: a tile for
         * the kind of thing it is, the label in mono, the result as a figure,
         * and the inputs as a row of chips underneath that can be checked one
         * by one against a spreadsheet. Whether it worked is said in words as
         * well as in the colour of the tile.
         */
        return (
          <div
            key={`${trace.name}-${i}`}
            className="surface-sunken a-inner overflow-hidden rounded-2xl border"
          >
            <div className="flex items-start gap-3 px-3.5 py-3">
              <span
                aria-hidden
                style={{ '--tone': tone } as CSSProperties}
                className="tinted mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border"
              >
                {trace.ok ? <Sigma className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="a-label">{trace.label}</span>
                  <span className="text-subtle text-[10.5px]">
                    {trace.ok ? 'Worked out by the app' : 'Could not be worked out'}
                  </span>
                </p>
                <p className="numeric mt-1 text-[13px] leading-relaxed font-semibold tracking-tight text-[var(--text-c)] tabular-nums">
                  {trace.summary}
                </p>

                {args.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {args.map(([key, v]) => (
                      <li
                        key={key}
                        className="surface-lit numeric inline-flex max-w-full items-baseline gap-1.5 rounded-md px-2 py-0.5 text-[11px]"
                      >
                        <span className="text-subtle">{label(key)}</span>
                        <span className="min-w-0 truncate font-medium tabular-nums">
                          {value(v)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
