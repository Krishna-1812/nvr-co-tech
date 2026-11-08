'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { hasFinePointer, reducedMotion } from '../scroll';
import { confetti } from './confetti';

/**
 * The small things a hand notices, for both sides of the site. One component,
 * mounted beside Play in each frame, that renders nothing and works by
 * delegation, so no server component has to turn into a client one to join in.
 *
 *   - **The halo** (public site, mouse only): a soft ring that trails the
 *     pointer, swells and fills over anything that can be pressed, says "Drag"
 *     over the things that can be thrown about (`[data-grab]`) or whatever a
 *     `data-cursor` says, squeezes on a press and steps aside over a text
 *     field. The pointer itself is left alone; the ring is company, not a
 *     replacement. Not in the signed-in app, where it would be following
 *     somebody about a form for an hour.
 *   - **Magnetic buttons** (both, mouse only): a flooding button (`.m-flood`)
 *     leans a few pixels towards the pointer and springs back when it leaves.
 *   - **A ripple on a tap** (both, touch only): the same buttons answer a
 *     finger with a ring from the point it landed, since a finger never
 *     hovers and so never sees the flood.
 *   - **Cards arriving** (app only): after a move to another screen, the
 *     cards on it rise one after another behind the curtain instead of all
 *     at once.
 *   - **The owl** (both): type "hoot", or the old up-up-down-down code,
 *     anywhere outside a field and the owl flies across the screen.
 *
 * All of it writes only into elements React has finished hydrating, or into
 * elements of its own on <body>, and all of it is switched off for anybody who
 * has asked for less motion.
 */
export function Delight({ side }: { side: 'site' | 'app' }) {
  const path = usePathname();

  /* ── The halo ── */
  useEffect(() => {
    if (side !== 'site' || reducedMotion() || !hasFinePointer()) return;

    const halo = document.createElement('div');
    halo.className = 'd-halo';
    halo.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    halo.appendChild(label);
    // The halo lives on <body>, outside the skin, so it carries the skin's
    // colours with it rather than a second copy of them.
    const skin = document.querySelector<HTMLElement>('[data-skin="desert"]');
    if (skin) {
      const css = getComputedStyle(skin);
      for (const [to, from] of [['--d-ink', '--m-ink'], ['--d-sun', '--m-sun'], ['--d-on', '--m-on-grad']]) {
        const v = css.getPropertyValue(from).trim();
        if (v) halo.style.setProperty(to, v);
      }
    }
    document.body.appendChild(halo);

    let x = -100;
    let y = -100;
    let hx = -100;
    let hy = -100;
    let raf = 0;
    let shown = false;
    let state = '';
    let word = '';

    const tick = () => {
      hx += (x - hx) * 0.2;
      hy += (y - hy) * 0.2;
      halo.style.transform = `translate3d(${hx.toFixed(1)}px, ${hy.toFixed(1)}px, 0)`;
      raf = Math.abs(x - hx) + Math.abs(y - hy) > 0.3 ? requestAnimationFrame(tick) : 0;
    };

    const set = (next: string, text: string) => {
      if (next !== state) {
        state = next;
        halo.dataset.state = next;
      }
      if (text !== word) {
        word = text;
        label.textContent = text;
      }
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!shown) {
        shown = true;
        hx = x;
        hy = y;
        halo.dataset.on = '';
      }
      const t = e.target as Element | null;
      const said = t?.closest?.<HTMLElement>('[data-cursor]');
      if (t?.closest?.('input, textarea, select, [contenteditable="true"], iframe, .chat-panel')) set('away', '');
      else if (said) set('word', said.dataset.cursor ?? '');
      else if (t?.closest?.('[data-grab]')) set('word', 'Drag');
      else if (t?.closest?.('a[href], button:not(:disabled), [role="button"], summary, label[for], select')) set('press', '');
      else set('', '');
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const down = () => halo.setAttribute('data-down', '');
    const up = () => halo.removeAttribute('data-down');
    const leave = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        shown = false;
        delete halo.dataset.on;
      }
    };

    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    document.addEventListener('mouseout', leave);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('mouseout', leave);
      halo.remove();
    };
  }, [side]);

  /* ── Magnetic buttons and the tap ripple ── */
  useEffect(() => {
    if (reducedMotion()) return;
    const fine = hasFinePointer();
    let held: HTMLElement | null = null;

    const release = () => {
      if (!held) return;
      held.style.setProperty('--mg-x', '0px');
      held.style.setProperty('--mg-y', '0px');
      held = null;
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const b = (e.target as Element).closest?.<HTMLElement>('.m-flood, [data-magnet]') ?? null;
      if (b !== held) release();
      if (!b || !hydrated(b)) return;
      const r = b.getBoundingClientRect();
      // A wide bar of a button pulled about would read as a wobble, not a lean.
      if (r.width > 380) return;
      held = b;
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      b.style.setProperty('--mg-x', `${(dx * 6).toFixed(1)}px`);
      b.style.setProperty('--mg-y', `${(dy * 4).toFixed(1)}px`);
    };

    const tap = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const b = (e.target as Element).closest?.<HTMLElement>('.m-flood') ?? null;
      if (!b || !hydrated(b)) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty('--tx', `${e.clientX - r.left}px`);
      b.style.setProperty('--ty', `${e.clientY - r.top}px`);
      // Restarted on every tap: off, a frame for the browser to notice, on.
      b.removeAttribute('data-tap');
      requestAnimationFrame(() => b.setAttribute('data-tap', ''));
      window.setTimeout(() => b.removeAttribute('data-tap'), 700);
    };

    if (fine) {
      document.addEventListener('pointermove', move, { passive: true });
      document.addEventListener('pointerleave', release);
    }
    document.addEventListener('pointerdown', tap, { passive: true });
    return () => {
      release();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', release);
      document.removeEventListener('pointerdown', tap);
    };
  }, []);

  /* ── Cards arriving, after a move to another screen ── */
  useEffect(() => {
    if (side !== 'app' || reducedMotion()) return;
    // The first screen of a visit is painted as the server sent it; hiding
    // cards that are already on show, to bring them in again, would be a
    // flicker rather than an arrival. RouteStage has the same rule.
    if (!arrived) {
      arrived = true;
      return;
    }
    let n = 0;
    const seen = new WeakSet<Element>();
    const look = () => {
      const vh = window.innerHeight;
      const cards = document.querySelectorAll<HTMLElement>('main .surface-lit, main [data-rise-card]');
      for (const c of cards) {
        if (seen.has(c) || n >= 14) continue;
        seen.add(c);
        const r = c.getBoundingClientRect();
        if (r.top > vh || r.bottom < 0 || r.width === 0 || !hydrated(c)) continue;
        // Something that already has an entrance of its own keeps it.
        if (getComputedStyle(c).animationName !== 'none') continue;
        c.style.setProperty('--d-i', String(n++));
        c.setAttribute('data-d-rise', '');
        window.setTimeout(() => c.removeAttribute('data-d-rise'), 1600 + n * 70);
      }
    };
    // Twice: the screen's frame paints before all of it has streamed in, and
    // both looks fall behind the curtain, so nobody sees a card hidden.
    const ts = [30, 260].map((ms) => window.setTimeout(look, ms));
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, [path, side]);

  /* ── The owl ── */
  useEffect(() => {
    const CODE = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    let typed = '';
    let keys: string[] = [];
    let busy = false;

    const fly = () => {
      if (busy || reducedMotion()) return;
      busy = true;
      const owl = document.createElement('div');
      owl.className = 'd-owl';
      owl.setAttribute('aria-hidden', 'true');
      owl.innerHTML = '<img src="/brand/logo-mark.svg" alt="" width="96" height="96" /><b>Hoo!</b>';
      document.body.appendChild(owl);
      window.setTimeout(() => confetti(window.innerWidth / 2, window.innerHeight * 0.45, 60), 900);
      window.setTimeout(() => {
        owl.remove();
        busy = false;
      }, 2900);
    };

    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const k = e.key.toLowerCase();
      keys = [...keys, k].slice(-CODE.length);
      if (keys.join() === CODE.join()) {
        keys = [];
        fly();
      }
      if (k.length === 1) {
        typed = (typed + k).slice(-4);
        if (typed === 'hoot') {
          typed = '';
          fly();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);

  return null;
}

/** Module state, like RouteStage's: false until the first screen has mounted. */
let arrived = false;

/** Whether React has hydrated this element yet (see Play). */
function hydrated(el: Element): boolean {
  return Object.keys(el).some((k) => k.startsWith('__reactProps'));
}
