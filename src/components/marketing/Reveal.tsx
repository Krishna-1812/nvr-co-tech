'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useInView } from './scroll';

/**
 * Releases its children when they scroll into view.
 *
 * The displaced state lives in CSS (`.reveal`) rather than in React state, so
 * the first paint already has it — no flash of finished layout followed by a
 * jump back. Without scripting the class is overridden outright in the marketing
 * layout, because this wraps most of the page and a reveal that never fires
 * would leave a blank site rather than a missing animation.
 *
 * The scroll plumbing lives in ./scroll — see the note there on why this is a
 * shared listener rather than an IntersectionObserver.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  /**
   * How far to stagger this element behind its siblings.
   *
   * Written in milliseconds because that is what it was, and because it is
   * still milliseconds on the fallback path. On the scroll path there is no
   * time to delay by, so it is converted to a distance instead — see below.
   */
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article' | 'header' | 'tr';
}) {
  const ref = useRef<HTMLElement>(null);
  const shown = useInView(ref);

  return (
    <Tag
      // A single ref type cannot satisfy every tag `as` accepts, and narrowing
      // it per-tag would mean generics for no behavioural gain.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={cn('reveal', shown && 'is-in', className)}
      /*
       * Both units, because two mechanisms read this.
       *
       * `transitionDelay` is for the browser without scroll timelines, which is
       * still running the observer and the transition.
       *
       * `--r-lag` is for the one with them, where a delay means nothing: the
       * animation's position is set by where the element is, so staggering it
       * has to push its *range* rather than its clock. Divided by 20 and capped,
       * so the site's usual 60–300ms spread becomes a 3–15% offset — enough that
       * three cards in a row deal out instead of arriving together, and small
       * enough that the last one is not still moving when it is read.
       *
       * Cards in different rows already stagger without this, because each has
       * its own timeline and reaches the fold at a different moment. This is
       * only doing the within-a-row case.
       */
      style={
        delay
          ? ({
              transitionDelay: `${delay}ms`,
              '--r-lag': `${Math.min(delay, 300) / 20}%`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </Tag>
  );
}
