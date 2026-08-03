'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { clamp, subscribe, trackProgress, useInView, usePrefersReducedMotion } from './scroll';

/**
 * The site's motion vocabulary.
 *
 * One rule runs through all of it: continuous values are written to the DOM,
 * never to React state. A scroll position changes sixty times a second and a
 * component tree cannot be rebuilt that often, so anything smooth here is a CSS
 * custom property being set on one element, and React only re-renders when
 * something genuinely discrete changes — which step of a story is showing.
 */

/* ── Pinned scroll stage ─────────────────────────────────────────────────── */

/**
 * A section that holds still while the page scrolls through it.
 *
 * A tall outer track provides the scroll distance; a `sticky` child one viewport
 * high stays put while that distance is consumed. The render prop is called with
 * the current step index, which changes a handful of times over the whole
 * section, so the subtree re-renders a handful of times and no more.
 *
 * For anything that has to move smoothly rather than snap, read the
 * `--stage-progress` custom property (0 → 1) in CSS: it is set on the sticky
 * element every frame and inherits to every child.
 *
 * Below `lg` the pin is dropped and the steps are stacked instead — see the note
 * on `StageFallback`. A pinned section on a phone fights the browser's own
 * address-bar collapse and takes over the one gesture the reader has.
 */
export function ScrollStage({
  steps,
  children,
  className,
  /** Extra viewport-heights of scroll per step. Higher feels slower and calmer. */
  pace = 0.85,
}: {
  steps: number;
  children: (step: number) => React.ReactNode;
  className?: string;
  pace?: number;
}) {
  const track = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const trackEl = track.current;
    const pinEl = pin.current;
    if (!trackEl || !pinEl) return;

    let shown = -1;

    const read = () => {
      const p = trackProgress(trackEl);
      pinEl.style.setProperty('--stage-progress', p.toFixed(4));

      /*
       * The last step gets the tail of the track to itself. Without this the
       * final step appears exactly as the section starts unpinning and is gone
       * before it has been read.
       */
      const next = Math.min(steps - 1, Math.floor(p * steps * 1.06));
      if (next !== shown) {
        shown = next;
        setStep(next);
      }
    };

    const stop = subscribe(read);
    read();
    return stop;
  }, [steps]);

  return (
    <div
      ref={track}
      className={cn('relative hidden lg:block', className)}
      style={{ height: `${100 + steps * pace * 100}vh` }}
    >
      <div ref={pin} className="sticky top-0 flex h-dvh items-center overflow-hidden">
        {children(step)}
      </div>
    </div>
  );
}

/**
 * What replaces a pinned stage on narrow screens: the same steps, stacked and
 * revealed normally. Rendered as a sibling of ScrollStage rather than inside it,
 * so neither has to know the other exists.
 */
export function StageFallback({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('lg:hidden', className)}>{children}</div>;
}

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

/* ── Type that arrives ───────────────────────────────────────────────────── */

/**
 * Reveals a line word by word.
 *
 * Split on spaces and each word given its own delay, which is a great deal
 * cheaper than it sounds — one transition per word, all released by a single
 * class change on the parent. Each word keeps a normal space after it so the
 * text still selects, copies and wraps as one sentence.
 */
export function WordReveal({
  text,
  className,
  delay = 0,
  step = 42,
  as: Tag = 'span',
}: {
  text: string;
  className?: string;
  /** Milliseconds before the first word moves. */
  delay?: number;
  /** Milliseconds between consecutive words. */
  step?: number;
  as?: 'span' | 'h1' | 'h2' | 'p';
}) {
  const host = useRef<HTMLElement>(null);
  const shown = useInView(host);

  return (
    <Tag
      // One ref type cannot satisfy every tag this accepts; narrowing per-tag
      // would mean generics for no behavioural gain.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={host as any}
      className={className}
    >
      {text.split(' ').map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom">
          <span
            className={cn(
              'inline-block transition-[transform,opacity] duration-[750ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              shown ? 'translate-y-0 opacity-100' : 'translate-y-[0.9em] opacity-0',
            )}
            style={{ transitionDelay: `${delay + i * step}ms` }}
          >
            {word}
          </span>
          {/* Outside the animated span so the gap does not slide with the word. */}
          {' '}
        </span>
      ))}
    </Tag>
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
      className={cn('absolute inset-x-0 bottom-0 h-px origin-left scale-x-0', className)}
      style={{ backgroundImage: 'var(--m-grad)' }}
      ref={bar}
    />
  );
}

/**
 * Moves its children against the scroll as they cross the viewport.
 *
 * `distance` is in pixels of total travel across the whole crossing, applied
 * through a CSS variable so the transform stays on the compositor. Disabled
 * outright under prefers-reduced-motion rather than shortened — a parallax layer
 * that moves quickly instead of slowly is worse than one that does not move.
 */
export function Parallax({
  children,
  distance = 60,
  className,
}: {
  children: React.ReactNode;
  distance?: number;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = host.current;
    if (!el || reduced) return;

    const read = () => {
      const rect = el.getBoundingClientRect();
      // -1 when the element is a viewport below, +1 when a viewport above.
      const centre = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      el.style.setProperty('--parallax', `${(clamp(centre, -1, 1) * distance).toFixed(2)}px`);
    };

    const stop = subscribe(read);
    read();
    return stop;
  }, [distance, reduced]);

  return (
    <div ref={host} className={className} style={{ translate: '0 var(--parallax, 0px)' }}>
      {children}
    </div>
  );
}
