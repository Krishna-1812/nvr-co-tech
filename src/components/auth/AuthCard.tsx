import { cn } from '@/lib/utils';
import { MotionTitle, type TitlePart } from '@/components/marketing/rich/MotionTitle';

/**
 * The single object the sign-in screens are built around.
 *
 * The page used to be split down the middle — a lit brand panel beside a flat
 * form column. Two backgrounds meeting at a hairline read as two screens joined
 * rather than one page, however carefully the seam was drawn. So there is no
 * seam now: one ground, one arch behind it, and this card standing in the
 * doorway.
 *
 * On sand the card is plaster rather than glass: the lighter card colour, no
 * border, and a long warm shadow that puts it a little in front of the arch.
 * The gradient rim and the lit top edge it had on the night skin were what
 * made a card read as lit on near-black; here they read as a smudge.
 */
export function AuthCard({
  children,
  footer,
  className,
}: {
  children: React.ReactNode;
  /** Sits in a tinted strip along the bottom edge, outside the card's padding. */
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('a-unfold relative overflow-hidden rounded-[1.75rem] bg-[var(--m-card)]', className)}
      style={{ boxShadow: '0 40px 70px -40px rgb(80 40 20 / 0.5), 0 2px 6px rgb(80 40 20 / 0.06)' }}
    >
      <div className="a-deal px-6 py-8 sm:px-8">{children}</div>

      {footer && (
        <div className="border-t border-[var(--m-line)] bg-[var(--m-bg)] px-6 py-4 text-center sm:px-8">
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Title and standfirst, on the canvas above the card rather than inside it.
 *
 * Outside, the type belongs to the page and the card holds only the controls,
 * which is what keeps the card from looking like a dialog dropped on a
 * background.
 */
export function AuthHeading({
  title,
  lead,
  className,
}: {
  /** Lines of parts, set letter by letter (MotionTitle). A tinted part is the terracotta phrase. */
  title: TitlePart[][];
  lead?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-8 text-center', className)}>
      <MotionTitle className="text-[clamp(1.95rem,6vw,2.5rem)]" lines={title} delay={120} />
      {lead && <p className="m-dim mx-auto mt-3.5 max-w-[22rem] text-[14.5px] leading-relaxed">{lead}</p>}
    </div>
  );
}
