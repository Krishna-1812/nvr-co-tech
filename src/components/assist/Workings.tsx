'use client';

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
    <div className="mt-3.5 space-y-2">
      {traces.map((trace, i) => {
        const args = Object.entries(trace.args).filter(
          // A zero the model sent because a field exists is noise; a zero the
          // reader actually gave is not, and the two are indistinguishable here.
          // Dropping both is the lesser error, because the figures that matter
          // are all in the summary line.
          ([, v]) => v !== null && v !== undefined && v !== '' && v !== 0,
        );

        return (
          <div
            key={`${trace.name}-${i}`}
            className="surface-sunken a-ring overflow-hidden rounded-xl border"
          >
            <div className="flex items-start gap-2.5 px-3 py-2">
              <span
                aria-hidden
                className="mt-0.5 shrink-0"
                style={{ color: trace.ok ? 'var(--status-approved)' : 'var(--status-warn)' }}
              >
                {trace.ok ? <Sigma className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="a-label">{trace.label}</p>
                <p className="numeric mt-1 text-[12.5px] leading-relaxed text-[var(--text-c)]">
                  {trace.summary}
                </p>

                {args.length > 0 && (
                  <p className="text-subtle numeric mt-1.5 text-[11px] leading-relaxed">
                    {args.map(([key, v], j) => (
                      <span key={key}>
                        {j > 0 && <span className="opacity-40"> · </span>}
                        {label(key)} {value(v)}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
