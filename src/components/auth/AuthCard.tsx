import { cn } from '@/lib/utils';

/**
 * The single object the sign-in screens are built around.
 *
 * The page used to be split down the middle — a lit brand panel beside a flat
 * form column. Two backgrounds meeting at a hairline read as two screens joined
 * rather than one page, however carefully the seam was drawn. So there is no
 * seam now: one canvas, one light source, and this card floating in it.
 *
 * The border is a gradient rather than a flat hairline — brightest at the top
 * left, fading away by the bottom right — because a single-tone 1px outline on
 * near-black is what makes a card look drawn rather than lit.
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
      className={cn('relative rounded-2xl p-px', className)}
      style={{
        background:
          'linear-gradient(155deg, oklch(0.90 0.03 85 / 0.40), oklch(0.80 0.03 85 / 0.12) 42%, oklch(0.80 0.03 85 / 0.05))',
        boxShadow: '0 48px 100px -28px oklch(0 0 0 / 0.85), 0 10px 26px -8px oklch(0 0 0 / 0.55)',
      }}
    >
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background:
            'linear-gradient(180deg, oklch(0.232 0.040 247 / 0.82), oklch(0.150 0.028 247 / 0.94))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Light catching the top edge. The one detail that reads as glass. */}
        <span
          aria-hidden
          className="absolute inset-x-8 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, oklch(0.96 0.03 85 / 0.8), transparent)',
          }}
        />

        <div className="px-6 py-8 sm:px-8">{children}</div>

        {footer && (
          <div className="border-t border-[var(--m-line)] bg-white/[0.022] px-6 py-4 text-center sm:px-8">
            {footer}
          </div>
        )}
      </div>
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
  title: React.ReactNode;
  lead?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-8 text-center', className)}>
      <h1 className="m-display text-[clamp(1.95rem,6vw,2.5rem)]">{title}</h1>
      {lead && <p className="m-dim mx-auto mt-3.5 max-w-[22rem] text-[14.5px] leading-relaxed">{lead}</p>}
    </div>
  );
}
