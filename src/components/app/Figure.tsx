'use client';

import { useEffect, useRef } from 'react';
import { fmtRupees } from '@/lib/domain/voucher';
import { cn } from '@/lib/utils';

/**
 * A headline figure that counts into place.
 *
 * Why bother: a dashboard of four static numbers is read as a picture, and a
 * number that arrives is read as a number. The count is what makes somebody
 * actually take in that the queue is three rather than glance past a card.
 *
 * Three things it is careful about:
 *
 *   The final value is what renders on the server, so the correct figure is in
 *   the HTML, is what a crawler or a printer sees, and is what remains if the
 *   bundle never lands.
 *
 *   The animation writes `textContent` rather than React state — sixty renders a
 *   second of a component tree to move one number would be absurd.
 *
 *   Under prefers-reduced-motion nothing happens at all. A figure that races is
 *   exactly the kind of motion that setting exists for.
 *
 * Formatting is chosen by `kind` rather than by a passed-in function, because a
 * function cannot cross the boundary from the server components that use this.
 */
export function Figure({
  value,
  kind = 'count',
  duration = 1000,
  delay = 0,
  className,
}: {
  value: number;
  kind?: 'count' | 'rupees';
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const format = kind === 'rupees' ? fmtRupees : (n: number) => Math.round(n).toLocaleString('en-IN');

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (value === 0) return;

    let frame = 0;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, Math.max(0, (now - start - delay) / duration));
      // easeOutExpo: most of the distance early, then the last digits settle.
      const eased = t <= 0 ? 0 : t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      el.textContent = format(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // `format` is derived from `kind`, which is in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, kind, duration, delay]);

  return (
    <span ref={host} className={cn('a-figure', className)}>
      {format(value)}
    </span>
  );
}
