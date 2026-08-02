'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Releases its children when they scroll into view.
 *
 * The displaced state lives in CSS (`.reveal`) rather than in React state, so
 * the first paint already has it — no flash of finished layout followed by a
 * jump back.
 *
 * Deliberately NOT built on IntersectionObserver. The failure mode here is
 * unusually harsh: this wraps most of the page, so anything that stops the
 * reveal firing leaves a blank site rather than a missing animation. An
 * observer only delivers callbacks while the page is actually being composited,
 * which is not guaranteed in every embedded, throttled or headless context —
 * and when it silently never fires there is nothing to recover from. A shared
 * scroll listener has no such dependency, and one rect measurement per element
 * per frame is cheap at this page's size.
 */

/** One listener for the whole page, not one per element. */
const watchers = new Set<() => void>();
let frame = 0;

function flush() {
  frame = 0;
  for (const check of watchers) check();
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(flush);
}

function subscribe(check: () => void): () => void {
  if (watchers.size === 0) {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
  }
  watchers.add(check);

  return () => {
    watchers.delete(check);
    if (watchers.size === 0) {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    }
  };
}

export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  /** Milliseconds to stagger this element behind its siblings. */
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article' | 'header';
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let unsubscribe: (() => void) | undefined;

    const check = () => {
      const rect = el.getBoundingClientRect();
      // Trip a little before the top edge arrives, so the motion is finishing
      // as the element reaches comfortable reading position rather than starting.
      const inView = rect.top < window.innerHeight * 0.88 && rect.bottom > 0;
      if (!inView) return;

      setShown(true);
      // Reveals once. Content that re-animates every time it passes the
      // viewport reads as a broken page, not a lively one.
      unsubscribe?.();
      unsubscribe = undefined;
    };

    unsubscribe = subscribe(check);
    // Run immediately: everything above the fold is already in view at mount
    // and should not wait for the first scroll event that may never come.
    check();

    return () => unsubscribe?.();
  }, []);

  return (
    <Tag
      // A single ref type cannot satisfy every tag `as` accepts, and narrowing
      // it per-tag would mean generics for no behavioural gain.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={cn('reveal', shown && 'is-in', className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
