'use client';

import { useEffect, useState } from 'react';

/**
 * The site's scroll machinery: one listener, one frame, many readers.
 *
 * Everything scroll-driven on the public site goes through here — reveals, the
 * pinned scroll stages, the progress bar, the counters. The alternative is a
 * listener per component, and this page has upwards of forty of them; forty
 * listeners each scheduling their own frame is how a marketing site ends up
 * janking on a mid-range phone.
 *
 * Deliberately NOT IntersectionObserver, for the same reason the reveals never
 * were: an observer only delivers callbacks while the page is genuinely being
 * composited, which is not guaranteed in embedded, throttled or headless
 * contexts. When it silently never fires, content that starts hidden stays
 * hidden and there is nothing to recover from. A scroll listener plus one rect
 * read per element per frame has no such dependency.
 */

type Reader = () => void;

const readers = new Set<Reader>();
let frame = 0;

function flush() {
  frame = 0;
  /*
   * Every reader measures first and writes second because they all run inside
   * this one callback — the browser can therefore batch the reads, and no
   * reader's write forces a layout that the next reader's read has to wait for.
   */
  for (const read of readers) read();
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(flush);
}

export function subscribe(read: Reader): () => void {
  if (readers.size === 0) {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
  }
  readers.add(read);

  return () => {
    readers.delete(read);
    if (readers.size === 0) {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    }
  };
}

/** Nudges every reader to re-measure. For use after a layout-changing event. */
export function refresh() {
  schedule();
}

/**
 * Whether the visitor has asked for less motion.
 *
 * Starts `false` on the server and on first paint, then corrects itself, so
 * anything that must be correct on the very first frame should use the CSS
 * media query instead. This is for behaviour JavaScript owns — how far a
 * counter counts, whether a parallax layer moves at all.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return reduced;
}

/**
 * True once the element has come into view. Latches by default — content that
 * re-animates every time it passes the viewport reads as a broken page rather
 * than a lively one.
 */
export function useInView<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  { margin = 0.88, once = true }: { margin?: number; once?: boolean } = {},
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let stop: (() => void) | undefined;

    const read = () => {
      const rect = el.getBoundingClientRect();
      const visible = rect.top < window.innerHeight * margin && rect.bottom > 0;

      if (visible) {
        setInView(true);
        if (once) {
          stop?.();
          stop = undefined;
        }
      } else if (!once) {
        setInView(false);
      }
    };

    stop = subscribe(read);
    // Anything above the fold is already in view at mount and must not wait for
    // a first scroll event that may never arrive.
    read();

    return () => stop?.();
  }, [ref, margin, once]);

  return inView;
}

/**
 * How far a tall element has travelled past the top of the viewport, 0 → 1.
 *
 * Written for the pinned stages: the element passed in is the tall track whose
 * child is `sticky top-0` and one viewport high, so this is exactly the fraction
 * of the pin that has been consumed. 0 the moment the track's top reaches the
 * top of the screen, 1 as its bottom does.
 *
 * A plain function rather than a hook, so a caller can compute it inside its own
 * subscription. Two hooks each subscribing separately would work only as long as
 * they happened to run in the right order, and nothing in React guarantees that.
 */
export function trackProgress(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const travel = rect.height - window.innerHeight;
  if (travel <= 0) return 0;
  return clamp(-rect.top / travel);
}

/** Clamp helper, used often enough by callers to be worth exporting. */
export function clamp(value: number, min = 0, max = 1): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Maps a value from one range to another, clamped at both ends. The workhorse
 * for turning a 0→1 scroll position into an opacity, an offset or a step.
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMax === inMin) return outMin;
  const t = clamp((value - inMin) / (inMax - inMin));
  return outMin + t * (outMax - outMin);
}
