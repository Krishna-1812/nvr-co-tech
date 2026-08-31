'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { clamp, subscribe, useInView, usePrefersReducedMotion } from './scroll';

/**
 * The site's motion vocabulary.
 *
 * One rule runs through all of it: continuous values are written to the DOM,
 * never to React state. A scroll position changes sixty times a second and a
 * component tree cannot be rebuilt that often, so anything smooth here is
 * either a CSS custom property being set on one element or a transform written
 * straight to style, and React is not involved in either.
 */

/* ── Counting figures ────────────────────────────────────────────────────── */

/**
 * A number that counts up the first time it is seen.
 *
 * Eased out hard, so most of the distance is covered early and the last few
 * digits settle — a linear count reads as a loading spinner. Under
 * prefers-reduced-motion the final value is simply printed.
 */
export function Counter({
  to,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: {
  to: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const inView = useInView(host);
  const reduced = usePrefersReducedMotion();

  const format = (n: number) =>
    `${prefix}${n.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;

  useEffect(() => {
    const el = host.current;
    if (!el || !inView) return;

    if (reduced) {
      el.textContent = format(to);
      return;
    }

    let frame = 0;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const t = clamp((now - start) / duration);
      // easeOutExpo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      el.textContent = format(to * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // `format` is derived from the primitives already listed and is stable
    // enough that including it would only re-run the animation for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduced, to, duration, decimals, prefix, suffix]);

  return (
    <span ref={host} className={className}>
      {/* The pre-animation value is the final one, so the figure is correct in
          the static HTML and for anyone without scripting. */}
      {format(to)}
    </span>
  );
}

/* ── Pointer-reactive surfaces ───────────────────────────────────────────── */

/**
 * Tracks the pointer across itself and publishes `--mx` / `--my` in pixels.
 *
 * The glow is a child element rather than a background on this one, because it
 * has to sit above the card's own background and below its content, and because
 * it fades in on hover as its own layer.
 *
 * Pointer-driven only: on touch there is no hover state to speak of, and the
 * effect simply never appears rather than firing on tap.
 */
export function Spotlight({
  children,
  className,
  color = 'var(--m-indigo)',
  size = 340,
  strength = 0.16,
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
  size?: number;
  strength?: number;
}) {
  const host = useRef<HTMLDivElement>(null);

  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = host.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  return (
    <div ref={host} onPointerMove={track} className={cn('group/spot relative', className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background: `radial-gradient(${size}px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklab, ${color} ${strength * 100}%, transparent), transparent 70%)`,
          borderRadius: 'inherit',
        }}
      />
      {children}
    </div>
  );
}

/**
 * Tilts towards the pointer. Small numbers on purpose — past about six degrees
 * it stops reading as depth and starts reading as a novelty.
 */
export function Tilt({
  children,
  className,
  max = 5,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = host.current;
    if (!el || reduced) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1200px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
  };

  const release = () => {
    const el = host.current;
    if (el) el.style.transform = '';
  };

  return (
    <div
      ref={host}
      onPointerMove={track}
      onPointerLeave={release}
      className={cn('transition-transform duration-300 ease-out will-change-transform', className)}
    >
      {children}
    </div>
  );
}

/* ── Page-level scroll indicators ────────────────────────────────────────── */

/** The hairline across the top of the header that fills as the page is read. */
export function ScrollProgressBar({ className }: { className?: string }) {
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;

    const read = () => {
      const doc = document.documentElement;
      const travel = doc.scrollHeight - window.innerHeight;
      el.style.transform = `scaleX(${travel > 0 ? clamp(window.scrollY / travel).toFixed(4) : 0})`;
    };

    const stop = subscribe(read);
    read();
    return stop;
  }, []);

  return (
    <span
      aria-hidden
      // Gold, and drawn on the header's own bottom edge. It is the one thing on
      // screen that reports a continuous quantity, which is exactly what the
      // accent is for — and a bone line here would be indistinguishable from
      // the hairline it sits on.
      className={cn(
        'absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-[var(--m-gold)]',
        className,
      )}
      ref={bar}
    />
  );
}
