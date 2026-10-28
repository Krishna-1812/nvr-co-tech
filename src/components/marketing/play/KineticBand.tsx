'use client';

import { useEffect, useRef } from 'react';
import { LIVE_AGENTS } from '@/lib/marketing/content';
import { clamp, reducedMotion, subscribe, subscribeSpeed } from '../scroll';

/**
 * Two rows of display type that slide past each other as the page scrolls.
 *
 * The top row is the live tools by name, the bottom row the kinds of work they
 * cover, both read from the roster so neither can name something that is not
 * there. Each row is wider than the screen; the band's trip through the
 * viewport is mapped onto that extra width, one row each way, so scrolling down
 * the page pulls the names left and the work right, and scrolling back pulls
 * them home. The suns and arches between the words turn with the same scroll,
 * and the whole band leans a little into a fast scroll and straightens when it
 * stops.
 *
 * It is scrubbed rather than timed — position, not playback — so it is never
 * mid-animation when the reader arrives and never finishes before they do.
 *
 * All decoration. Everything it says is said in words elsewhere on the page,
 * so the band is hidden from assistive technology rather than read out as a
 * second, scrambled list.
 */
export function KineticBand() {
  const band = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = band.current;
    if (!el || reducedMotion()) return;
    const rows = Array.from(el.querySelectorAll<HTMLElement>('.m-kin-row'));

    const read = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.bottom < -200 || r.top > vh + 200) return;
      const p = clamp((vh - r.top) / (vh + r.height));
      for (const row of rows) {
        const dir = Number(row.dataset.dir);
        const extra = Math.max(0, row.scrollWidth - el.clientWidth);
        const x = dir < 0 ? -p * extra * 0.7 : -(1 - p) * extra * 0.7 - extra * 0.15;
        row.style.setProperty('--kx', `${x.toFixed(1)}px`);
        row.style.setProperty('--kr', `${(p * 360 * dir).toFixed(1)}deg`);
      }
    };

    const stopRead = subscribe(read);
    const stopSpeed = subscribeSpeed((v) =>
      el.style.setProperty('--lean', `${Math.max(-10, Math.min(10, -v / 3)).toFixed(2)}deg`),
    );
    read();
    return () => {
      stopRead();
      stopSpeed();
    };
  }, []);

  const names = LIVE_AGENTS.map((a) => a.name);
  const kinds = LIVE_AGENTS.map((a) => a.category);

  return (
    <div ref={band} aria-hidden className="m-kin relative overflow-hidden py-14 sm:py-20">
      <KinRow words={[...names, ...names]} dir={-1} />
      <KinRow words={[...kinds, ...kinds]} dir={1} outline />
    </div>
  );
}

function KinRow({ words, dir, outline = false }: { words: string[]; dir: number; outline?: boolean }) {
  return (
    <div
      data-dir={dir}
      className={`m-kin-row flex w-max items-center gap-[0.4em] whitespace-nowrap ${outline ? 'm-kin-outline' : ''}`}
    >
      {words.map((w, k) => (
        <span key={k} className="flex items-center gap-[0.4em]">
          {/* Drawn from data-n (.m-n): the band is decoration, and the roster
              twice over would otherwise be read as the page's text. */}
          <span className="m-n m-display" data-n={w} />
          <KinShape n={k + (outline ? 1 : 0)} />
        </span>
      ))}
    </div>
  );
}

function KinShape({ n }: { n: number }) {
  const look = [
    'size-[0.5em] rounded-full bg-[var(--m-sun)]',
    'h-[0.62em] w-[0.42em] rounded-t-full bg-[var(--m-gold)]',
    'size-[0.46em] rounded-[0.12em] bg-[var(--m-emerald)]',
    'h-[0.5em] w-[0.5em] rounded-[50%_0] bg-[var(--m-violet)]',
  ][n % 4];
  return <span className={`m-kin-shape inline-block shrink-0 ${look}`} />;
}
