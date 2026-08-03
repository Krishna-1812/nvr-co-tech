'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * A card that lights up under the pointer.
 *
 * The position is published as two custom properties on the host element and the
 * glow is a radial gradient reading them, so moving the mouse never re-renders
 * anything — React is not involved after mount. It is a client component purely
 * to have a pointer handler.
 *
 * Kept to a whisper (a tenth of the accent, fading over 70% of the radius). The
 * point is that the surface acknowledges the pointer, not that it glows: five of
 * these on a dashboard at full strength would look like a games launcher.
 *
 * Pointer-driven only. On a touch screen there is no hover to speak of and the
 * effect simply never appears, which is the correct outcome rather than a flash
 * on every tap.
 */
export function Glow({
  children,
  className,
  color = 'var(--color-brand-500)',
  radius = 320,
  strength = 0.1,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
  radius?: number;
  strength?: number;
  /** Passed through so a caller can set the --tone its own children read. */
  style?: React.CSSProperties;
}) {
  const host = useRef<HTMLDivElement>(null);

  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = host.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--gx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--gy', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={host}
      onPointerMove={track}
      style={style}
      className={cn('group/glow relative', className)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover/glow:opacity-100"
        style={{
          background: `radial-gradient(${radius}px circle at var(--gx, 50%) var(--gy, 50%), color-mix(in oklab, ${color} ${strength * 100}%, transparent), transparent 70%)`,
          borderRadius: 'inherit',
        }}
      />
      {children}
    </div>
  );
}
