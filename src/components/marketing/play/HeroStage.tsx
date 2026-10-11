'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { hasFinePointer, reducedMotion } from '../scroll';

/**
 * The hero's arch window, made to answer the pointer.
 *
 *   - Depth. As the pointer crosses the hero, the sun drifts one way and the
 *     card the other (`--dx` / `--dy`, read by `.m-drift-*` in CSS), so the
 *     window reads as a scene with a near and a far rather than a picture.
 *   - The card can be picked up. Press on it and drag and it follows the
 *     pointer, tilting with the pull; let go and it springs home, overshooting
 *     and wobbling before it settles. The spring is integrated here rather than
 *     handed to a library: it is a dozen lines and the only one on the site.
 *
 * Mouse and pen only. On a phone a drag on the card has to scroll the page,
 * and the hero is the last place to take that away from someone.
 */
export function HeroStage({ children, className }: { children: React.ReactNode; className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || reducedMotion() || !hasFinePointer()) return;
    const card = el.querySelector<HTMLElement>('[data-grab]');
    const scene = el.closest('section') ?? el;

    /* ── Depth ── */
    let pend = 0;
    let fx = 0;
    let fy = 0;
    const drift = (e: PointerEvent) => {
      const r = scene.getBoundingClientRect();
      fx = (e.clientX - r.left) / r.width - 0.5;
      fy = (e.clientY - r.top) / r.height - 0.5;
      if (!pend)
        pend = requestAnimationFrame(() => {
          pend = 0;
          el.style.setProperty('--dx', fx.toFixed(3));
          el.style.setProperty('--dy', fy.toFixed(3));
        });
    };
    const settle = () => {
      el.style.setProperty('--dx', '0');
      el.style.setProperty('--dy', '0');
    };
    scene.addEventListener('pointermove', drift as EventListener);
    scene.addEventListener('pointerleave', settle);

    /* ── Pick up and spring home ── */
    let grab: { x0: number; y0: number; x: number; y: number } | null = null;
    let spring = 0;
    const place = (x: number, y: number) => {
      if (!card) return;
      card.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(x / 14).toFixed(2)}deg)`;
    };
    const down = (e: PointerEvent) => {
      if (!card || e.button > 0) return;
      cancelAnimationFrame(spring);
      e.preventDefault();
      grab = { x0: e.clientX, y0: e.clientY, x: 0, y: 0 };
      card.setPointerCapture(e.pointerId);
      card.classList.add('is-grabbed');
    };
    const move = (e: PointerEvent) => {
      if (!grab) return;
      grab.x = e.clientX - grab.x0;
      grab.y = e.clientY - grab.y0;
      place(grab.x, grab.y);
    };
    const up = () => {
      if (!grab || !card) return;
      let x = grab.x;
      let y = grab.y;
      let vx = 0;
      let vy = 0;
      grab = null;
      card.classList.remove('is-grabbed');
      // A damped spring: stiff enough to come straight back, loose enough to
      // overshoot twice on the way. Fixed 60Hz steps, so it settles the same
      // on any screen.
      const k = 0.09;
      const damp = 0.8;
      const step = () => {
        vx = (vx - x * k) * damp;
        vy = (vy - y * k) * damp;
        x += vx;
        y += vy;
        if (Math.abs(x) + Math.abs(y) + Math.abs(vx) + Math.abs(vy) < 0.2) {
          card.style.transform = '';
          return;
        }
        place(x, y);
        spring = requestAnimationFrame(step);
      };
      spring = requestAnimationFrame(step);
    };
    card?.addEventListener('pointerdown', down);
    card?.addEventListener('pointermove', move);
    card?.addEventListener('pointerup', up);
    card?.addEventListener('pointercancel', up);

    return () => {
      cancelAnimationFrame(pend);
      cancelAnimationFrame(spring);
      scene.removeEventListener('pointermove', drift as EventListener);
      scene.removeEventListener('pointerleave', settle);
      card?.removeEventListener('pointerdown', down);
      card?.removeEventListener('pointermove', move);
      card?.removeEventListener('pointerup', up);
      card?.removeEventListener('pointercancel', up);
    };
  }, []);

  return (
    <div ref={host} className={cn('m-stage', className)}>
      {children}
    </div>
  );
}
