'use client';

import { fmtRupees } from '@/lib/domain/voucher';
import { cn } from '@/lib/utils';
import { Odometer } from '@/components/marketing/play/Odometer';

/**
 * A headline figure that rolls into place.
 *
 * Why bother: a dashboard of four static numbers is read as a picture, and a
 * number that arrives is read as a number. The roll is what makes somebody
 * actually take in that the queue is three rather than glance past a card.
 *
 * It used to count up from zero; it now rolls digit by digit like a mechanical
 * counter (Odometer), the same as the public site's figures, and it rolls when
 * it comes into view rather than at load, so a figure below the fold has not
 * finished before anybody sees it.
 *
 * What it is careful about is unchanged: the final value is what renders on
 * the server and what remains with scripting off; no React state moves while it
 * rolls; and under prefers-reduced-motion nothing moves at all.
 *
 * Formatting is chosen by `kind` rather than by a passed-in function, because a
 * function cannot cross the boundary from the server components that use this.
 * `duration` is accepted for the callers that pass it; the roll sets its own
 * pace by the number of digits.
 */
export function Figure({
  value,
  kind = 'count',
  delay = 0,
  className,
}: {
  value: number;
  kind?: 'count' | 'rupees';
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const text = kind === 'rupees' ? fmtRupees(value) : Math.round(value).toLocaleString('en-IN');
  return <Odometer value={text} roll="view" delay={delay} className={cn('a-figure', className)} />;
}
