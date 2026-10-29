'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { ToolBrief } from '@/lib/marketing/brand';
import { subscribeSpeed } from '../scroll';

/**
 * A band of the live tools running under the hero, like the board at a
 * station.
 *
 * Only what is live, and only what the roster says about it: each tool's name
 * and the category of work it belongs to, both read from AGENTS. A tool that
 * goes live joins the band in the same commit that changes its stage, and a
 * roadmap tool never runs across the home page looking available.
 *
 * It runs on a CSS animation, so it moves before hydration and costs the main
 * thread nothing. Scrolling makes it run faster and lean into the direction of
 * travel, and both ease back once the page is still: the playback rate of that
 * same animation is turned up, rather than a second motion being laid over it,
 * so speeding up never makes it jump.
 *
 * Hovering stops it, so a name can be read and clicked. Under reduced motion it
 * does not run at all and the names simply sit in a row that wraps.
 *
 * The row is written out twice and the track slides by exactly one copy, which
 * is what makes the loop seamless. The second copy is hidden from assistive
 * technology and from the keyboard, so the list is read once.
 */
export function Ticker({ tools }: { tools: readonly ToolBrief[] }) {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    return subscribeSpeed((v) => {
      const run = el.getAnimations()[0];
      if (run) run.playbackRate = 1 + Math.min(6, Math.abs(v) / 5);
      el.style.setProperty('--lean', `${Math.max(-12, Math.min(12, -v / 3)).toFixed(2)}deg`);
    });
  }, []);

  return (
    <section
      aria-label="Live tools"
      className="m-ticker relative overflow-hidden border-y border-[var(--m-line)] bg-[var(--m-bg)] py-5 sm:py-6"
    >
      <div ref={track} className="m-ticker-track flex w-max">
        <Row tools={tools} />
        <Row tools={tools} copy />
      </div>
    </section>
  );
}

function Row({ tools, copy = false }: { tools: readonly ToolBrief[]; copy?: boolean }) {
  return (
    <ul
      className="flex shrink-0 items-center"
      {...(copy ? { 'aria-hidden': true, inert: true } : {})}
    >
      {/* Twice inside each copy as well, so even on a wide screen one copy is
          wider than the viewport and the loop never shows its seam. */}
      {[...tools, ...tools].map((a, k) => {
        const echo = copy || k >= tools.length;
        // The loop's repeats are drawn from data-n (.m-n), so the roster is in
        // the page's text once rather than four times over.
        const word = (text: string) => (echo ? { 'data-n': text, children: null } : { children: text });
        return (
          <li key={`${a.slug}-${k}`} className="flex items-center" aria-hidden={k >= tools.length || undefined}>
            <Link
              href={`/tools/${a.slug}`}
              tabIndex={k >= tools.length ? -1 : undefined}
              className="group flex items-baseline gap-3 px-6 whitespace-nowrap sm:px-9"
            >
              <span
                className={`${echo ? 'm-n ' : ''}m-display t-7 transition-colors group-hover:text-[var(--m-gold)] sm:t-8`}
                {...word(a.name)}
              />{' '}
              <span className={`${echo ? 'm-n ' : ''}m-eyebrow m-dim-2`} {...word(a.category)} />
            </Link>
            <Shape n={k} />
          </li>
        );
      })}
    </ul>
  );
}

/** The separators: a sun, an arch and a dune, in turn. */
function Shape({ n }: { n: number }) {
  const kind = n % 3;
  return (
    <span
      aria-hidden
      className={
        kind === 0
          ? 'm-tick-shape size-4 rounded-full bg-[var(--m-sun)]'
          : kind === 1
            ? 'm-tick-shape h-5 w-3.5 rounded-t-full bg-[var(--m-gold)]'
            : 'm-tick-shape h-2.5 w-6 rounded-t-full bg-[var(--m-bg-3)]'
      }
    />
  );
}
