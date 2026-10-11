import { cn } from '@/lib/utils';

/**
 * A line of type set one letter per box, so each letter can move on its own.
 *
 * The letters are presentation only. A screen reader gets the sentence once,
 * whole, from the visually hidden copy beside them, and never meets a heading
 * spelled out as twenty separate characters. That is also why this renders on
 * the server rather than splitting a heading's text in the browser after the
 * fact: the markup a crawler reads, the markup a reader without scripting sees
 * and the markup that animates are the same markup, and React owns every node
 * of it instead of finding them rewritten under it.
 *
 * Each word is its own unbreakable box, so a line can still wrap between words
 * but never in the middle of one. `--i` numbers the letters across the whole
 * line, which is what the staggered entrances count on.
 *
 * Kerning between letters is lost by putting each in its own box. At display
 * sizes in Gloock that is a hair's difference, and it is the price of letters
 * that can rise, lean and answer the pointer one at a time.
 */
export function Letters({
  text,
  className,
  start = 0,
}: {
  text: string;
  className?: string;
  /** Where to start numbering, when one heading is set in several pieces. */
  start?: number;
}) {
  let i = start;
  const parts = text.split(/(\s+)/);

  return (
    <span className={cn('m-letters', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {parts.map((part, k) =>
          /^\s+$/.test(part) ? (
            ' '
          ) : part ? (
            <span key={k} className="m-wd">
              {Array.from(part).map((ch) => {
                const n = i++;
                return (
                  <span key={n} className="m-ch" style={{ '--i': n } as React.CSSProperties}>
                    {ch}
                  </span>
                );
              })}
            </span>
          ) : null,
        )}
      </span>
    </span>
  );
}
