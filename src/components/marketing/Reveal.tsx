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
  /** Milliseconds to stagger this element behind its siblings. */
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
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
