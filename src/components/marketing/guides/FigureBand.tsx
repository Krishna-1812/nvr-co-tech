'use client';

import { useEffect, useRef } from 'react';
import { clamp, subscribe, usePrefersReducedMotion } from '../scroll';
import type { GuideCard } from './summary';

/**
 * Two rows that slide past each other as the band crosses the screen: the
 * guides' figures one way, their questions the other. Scrubbed by position, so
 * scrolling back pulls them home. Decoration only; every figure and title is
 * in the cards below it, as text and as links.
 */
export function FigureBand({ cards }: { cards: GuideCard[] }) {
  const host = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const read = () => {
      const el = host.current;
      if (!el || !top.current || !bottom.current) return;
      const r = el.getBoundingClientRect();
      // 0 as the band comes up from the bottom of the screen, 1 as it leaves the top.
      const t = clamp((window.innerHeight - r.top) / (window.innerHeight + r.height));
      const spareTop = top.current.scrollWidth - el.clientWidth;
      const spareBottom = bottom.current.scrollWidth - el.clientWidth;
      top.current.style.transform = `translateX(${(-t * spareTop).toFixed(1)}px)`;
      bottom.current.style.transform = `translateX(${(-(1 - t) * spareBottom).toFixed(1)}px)`;
    };
    const stop = subscribe(read);
    read();
    return stop;
  }, [reduced]);

  const twice = [...cards, ...cards];
  return (
    <div ref={host} aria-hidden className="relative overflow-hidden border-y border-[var(--m-line)] bg-[var(--m-ink)] py-8 text-[var(--m-on-grad)] sm:py-10">
      <div ref={top} className="g-band-row items-baseline">
        {twice.map((c, i) => (
          <span key={i} className="flex items-baseline gap-4 whitespace-nowrap">
            <span className="m-display t-h2 tabular-nums" style={{ color: i % 2 ? 'var(--m-sun)' : 'var(--m-on-grad)' }}>
              {c.figure.value}
            </span>
            <span className="m-mono t-2 t-caps uppercase opacity-70">{c.figure.label}</span>
            <span className="m-arch inline-block h-7 w-6 bg-[var(--m-gold)]" />
          </span>
        ))}
      </div>
      <div ref={bottom} className="g-band-row mt-6 items-center">
        {twice.map((c, i) => (
          <span key={i} className="flex items-center gap-4 whitespace-nowrap t-4 opacity-80">
            <span className="size-2 rounded-full bg-[var(--m-sun)]" />
            {c.title}
          </span>
        ))}
      </div>
    </div>
  );
}
