import { cn } from '@/lib/utils';
import { LineRise } from '../bits';
import { Letters } from '../play/Letters';
import { Springy } from '../play/Springy';

export type TitlePart = { text: string; mark?: boolean; tint?: boolean };

/**
 * A page's heading, set the way the home page sets its own: each line rises out
 * of its own clip, every letter is its own box so the line can lean up towards
 * the pointer (Springy), and a phrase can be marked with the sun drawn behind
 * it (`mark`) or set in the terracotta (`tint`).
 *
 * Lines are passed as data so the server renders every letter, and a crawler
 * and a screen reader both get each line once, whole (see Letters).
 */
export function MotionTitle({
  lines,
  className,
  delay = 60,
}: {
  lines: TitlePart[][];
  className?: string;
  /** When the first line starts to rise, in milliseconds. */
  delay?: number;
}) {
  // Where each part's letters start, numbered across the whole heading so the
  // staggered entrance runs on from one line to the next.
  const starts: number[][] = [];
  lines.reduce((n, parts, li) => {
    starts[li] = [];
    return parts.reduce((m, p, pi) => {
      starts[li][pi] = m;
      return m + p.text.length + 1;
    }, n);
  }, 0);

  return (
    <Springy as="h1" className={cn('m-display', className)} delay={delay + 1100}>
      {lines.map((parts, li) => (
        <LineRise key={li} delay={delay + li * 100}>
          {parts.map((p, pi) => {
            const letters = <Letters text={p.text} start={starts[li][pi]} />;
            const spaced = pi > 0 ? ' ' : null;
            if (p.mark) {
              return (
                <span key={pi}>
                  {spaced}
                  <span className="m-mark" style={{ '--mark-delay': `${delay + 800}ms` } as React.CSSProperties}>
                    {letters}
                  </span>
                </span>
              );
            }
            if (p.tint) {
              return (
                <span key={pi}>
                  {spaced}
                  <span className="m-serif m-grad-text pr-1">{letters}</span>
                </span>
              );
            }
            return (
              <span key={pi}>
                {spaced}
                {letters}
              </span>
            );
          })}
        </LineRise>
      ))}
    </Springy>
  );
}
