import type React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * What stands in the hero's arch: three sheets of work fanned on a desk.
 *
 * At the back, a ledger whose two columns are being matched. In the middle, a
 * chart whose bars come up. In front, a document whose lines are ticked off
 * one by one, with one set aside in amber rather than dropped, a total drawn
 * in under them, and a seal pressed at the foot once it is all done.
 *
 * Purely a picture (18 Oct, at the owner's request for "something generic
 * visual"). The card before it was a checklist in words, and before that an
 * expense voucher with a number, a chapter and an approver. This has no words,
 * no figures and no tool: nothing on it is legible, so there is nothing a
 * reader could hold the product to and nothing invented to look busy. It is
 * hidden from assistive technology; the headline beside it says the same thing
 * in words.
 *
 * Everything moves once, on arrival, behind the opening curtain (--intro-wait)
 * like the rest of the hero, and then only breathes. Under reduced motion it is
 * drawn finished. The `.hv-*` animations live in globals.css.
 */

/** When each beat lands, after the arch has opened. */
const at = (ms: number) => ({ '--d': `calc(var(--intro-wait, 0ms) + ${ms}ms)` }) as React.CSSProperties;

const SHEET = 'm-card m-ring absolute rounded-2xl shadow-[var(--m-shadow)]';

export function HeroVisual() {
  return (
    <div aria-hidden className="relative mx-auto h-[19rem] w-full max-w-[30rem] sm:h-[22rem]">
      {/* ── The ledger, at the back ── */}
      <div className={cn(SHEET, 'hv-deal top-[8%] left-[2%] h-[76%] w-[50%] p-4')} style={{ ...at(350), '--r': '-9deg' } as React.CSSProperties}>
        <div className="hv-float h-full" style={{ '--f': '7s' } as React.CSSProperties}>
          <Bar w="40%" tone="var(--m-line-2)" />
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5">
            {[0.8, 0.6, 0.9, 0.7, 0.5, 0.85, 0.65, 0.75].map((w, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {/* The left column's rows are matched across, one after another. */}
                {i % 2 === 0 && (
                  <span
                    className="hv-pop size-1.5 shrink-0 rounded-full bg-[var(--m-emerald)]"
                    style={at(1500 + i * 110)}
                  />
                )}
                <Bar w={`${w * 100}%`} tone="var(--m-line)" />
              </span>
            ))}
          </div>
          <div className="mt-4 border-t border-dashed border-[var(--m-line-2)] pt-3">
            <Bar w="55%" tone="var(--m-line-2)" />
          </div>
        </div>
      </div>

      {/* ── The chart, in the middle ── */}
      <div className={cn(SHEET, 'hv-deal top-0 right-[1%] h-[64%] w-[48%] p-4')} style={{ ...at(500), '--r': '7deg' } as React.CSSProperties}>
        <div className="hv-float flex h-full flex-col" style={{ '--f': '8s' } as React.CSSProperties}>
          <Bar w="35%" tone="var(--m-line-2)" />
          <div className="mt-3 flex flex-1 items-end gap-[7%] border-b border-[var(--m-line-2)] px-1">
            {[0.38, 0.55, 0.47, 0.72, 0.64, 0.9].map((h, i) => (
              <span
                key={i}
                className="hv-grow flex-1 origin-bottom rounded-t-[3px]"
                style={{
                  ...at(1100 + i * 90),
                  height: `${h * 100}%`,
                  background: i === 5 ? 'var(--m-gold)' : 'var(--m-bg-3)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── The document, in front ── */}
      <div className={cn(SHEET, 'hv-deal top-[16%] left-[23%] h-[84%] w-[54%] p-5')} style={{ ...at(650), '--r': '-1.5deg' } as React.CSSProperties}>
        <div className="hv-float relative h-full" style={{ '--f': '6s' } as React.CSSProperties}>
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[var(--m-gold)]" />
            <Bar w="45%" tone="var(--m-line-2)" />
          </div>

          <ul className="mt-4 space-y-2.5">
            {[0.9, 0.72, 0.84, 0.62, 0.78].map((w, i) => {
              const aside = i === 3;
              return (
                <li key={i} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'hv-pop grid size-4 shrink-0 place-items-center rounded-full',
                      aside
                        ? 'bg-[var(--m-wait-wash)] ring-1 ring-[var(--m-wait-line)]'
                        : 'bg-[color-mix(in_oklab,var(--m-emerald)_18%,transparent)]',
                    )}
                    style={at(1400 + i * 160)}
                  >
                    {!aside && <Check className="size-2.5 text-[var(--m-emerald)]" strokeWidth={3} />}
                  </span>
                  <Bar w={`${w * 100}%`} tone={aside ? 'var(--m-wait-line)' : 'var(--m-line-2)'} />
                </li>
              );
            })}
          </ul>

          {/* The total, drawn in once the lines are done. */}
          <div className="mt-4 flex items-center justify-between border-t border-[var(--m-line)] pt-3">
            <Bar w="28%" tone="var(--m-line-2)" />
            <span className="hv-draw block h-2.5 w-[32%] origin-right rounded-full bg-[var(--m-ink)] sm:w-[42%]" style={at(2300)} />
          </div>

          {/* The seal, pressed last: the work is done and handed over. It hangs
              off the sheet's corner, so it never covers the total on a
              narrow sheet. */}
          <span
            className="hv-stamp absolute -right-4 -bottom-4 grid size-12 place-items-center rounded-full border-2 border-[var(--m-gold)] bg-[var(--m-card)] shadow-[var(--m-shadow)] sm:size-16"
            style={{ ...at(2650), '--r': '-14deg' } as React.CSSProperties}
          >
            <span className="m-arch h-6 w-4.5 bg-[var(--m-gold)] sm:h-7 sm:w-5" />
          </span>
        </div>
      </div>
    </div>
  );
}

function Bar({ w, tone }: { w: string; tone: string }) {
  return <span className="block h-1.5 rounded-full" style={{ width: w, background: tone }} />;
}
