'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { hasFinePointer, reducedMotion } from '../scroll';

/**
 * Letters that lean up towards the pointer and turn terracotta as it passes.
 *
 * Wraps any headline set with <Letters>. Every letter within `reach` pixels of
 * the pointer gets a `--lift` between 0 and 1, falling off with the square of
 * the distance, and CSS (`.m-ch` in globals.css) turns that into a rise and a
 * colour. So the pointer drags a little swell of type along the line behind it,
 * and the letters spring back to the baseline, slightly past it and home, once
 * it moves on.
 *
 * On the reference this was modelled on, the swell is in the type's weight.
 * Gloock is cut in one weight, so here it is in height and colour instead — the
 * same gesture in the axes this face has.
 *
 * Mouse and pen only. On a touch screen there is no pointer hovering over the
 * line, and a swell that fired on tap would read as the page glitching.
 *
 * ── The clip ──────────────────────────────────────────────────────────────
 *
 * A headline built from LineRise rises out of a clipping box, and that clip
 * would cut the tops off letters lifting above the line. So once the entrance
 * has had time to finish, this sets `data-risen`, which CSS uses to drop the
 * clip. State goes in data attributes rather than classes because React owns
 * `className` and would wipe a class added behind its back the next time the
 * caller's classes changed. `delay` is how long that is, and it waits on the opening sequence too
 * when one is playing (`data-intro` on <html>; see IntroCurtain).
 */
export function Springy({
  children,
  className,
  reach = 170,
  delay = 1400,
  armed = true,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  /** Pixels from the pointer at which a letter stops answering it. */
  reach?: number;
  /** Milliseconds until the entrance is over and the clip can go. */
  delay?: number;
  /**
   * Whether the entrance has started. The footer's wordmark rises only when it
   * is scrolled to, so it holds this false until then and the clock starts
   * from that moment rather than from page load.
   */
  armed?: boolean;
  as?: 'div' | 'span' | 'h1' | 'h2' | 'p';
}) {
  const host = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || !armed) return;

    const intro = document.documentElement.dataset.intro === 'on' ? 1450 : 0;
    const risen = window.setTimeout(() => (el.dataset.risen = ''), delay + intro);

    if (reducedMotion() || !hasFinePointer()) return () => window.clearTimeout(risen);

    const letters = Array.from(el.querySelectorAll<HTMLElement>('.m-ch'));
    let centres: [number, number][] | null = null;
    let px = 0;
    let py = 0;
    let pending = 0;

    // Measured once per visit of the pointer, not per move: forty rect reads a
    // frame is a layout thrash, and the letters do not move under the pointer
    // except by the transform this writes, which getBoundingClientRect would
    // only feed back into itself.
    const measure = () => {
      centres = letters.map((c) => {
        c.style.removeProperty('--lift');
        const r = c.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
      });
    };

    const paint = () => {
      pending = 0;
      if (!centres) return;
      for (let k = 0; k < letters.length; k++) {
        const dx = centres[k][0] - px;
        const dy = centres[k][1] - py;
        const t = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / reach);
        letters[k].style.setProperty('--lift', (t * t).toFixed(3));
      }
    };

    const enter = () => {
      measure();
      el.dataset.live = '';
    };
    const move = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!centres) enter();
      if (!pending) pending = requestAnimationFrame(paint);
    };
    const leave = () => {
      centres = null;
      delete el.dataset.live;
      letters.forEach((c) => c.style.removeProperty('--lift'));
    };
    const rescroll = () => {
      if (centres) measure();
    };

    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    window.addEventListener('scroll', rescroll, { passive: true });

    return () => {
      window.clearTimeout(risen);
      cancelAnimationFrame(pending);
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      window.removeEventListener('scroll', rescroll);
    };
  }, [reach, delay, armed]);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={host as any} className={cn('m-springy', className)}>
      {children}
    </Tag>
  );
}
