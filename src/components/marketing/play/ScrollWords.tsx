'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { clamp, reducedMotion, subscribe } from '../scroll';

/**
 * A paragraph that is read into ink as it scrolls past.
 *
 * The words start pale and darken in reading order, from the moment the
 * paragraph comes up into the lower part of the screen to the moment it has
 * risen past the middle — so the page appears to read along with the reader
 * rather than having been printed before they arrived. Scrubbed by position,
 * so scrolling back fades the tail again.
 *
 * Pale, not hidden. Every word is legible from the start (the starting colour
 * is the page's own secondary text, which passes AA on this ground), the full
 * text is in the markup, and with reduced motion or no scripting the whole
 * paragraph is simply in ink.
 *
 * Takes a plain string, so the words are split on the server and React owns
 * every span rather than having them rewritten underneath it.
 */
export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const host = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || reducedMotion()) return;
    const words = Array.from(el.querySelectorAll<HTMLElement>('.m-sw'));
    el.classList.add('is-reading');
    let lit = -1;

    const read = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = clamp((vh * 0.9 - r.top) / (r.height + vh * 0.4));
      const n = Math.round(p * words.length);
      if (n === lit) return;
      lit = n;
      words.forEach((w, k) => w.classList.toggle('is-lit', k < n));
    };

    const stop = subscribe(read);
    read();
    return () => {
      stop();
      el.classList.remove('is-reading');
    };
  }, []);

  return (
    <p ref={host} className={cn('m-scroll-words', className)}>
      {text.split(/(\s+)/).map((part, k) =>
        /^\s+$/.test(part) ? (
          ' '
        ) : (
          <span key={k} className="m-sw">
            {part}
          </span>
        ),
      )}
    </p>
  );
}
