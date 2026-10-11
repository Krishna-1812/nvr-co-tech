'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { hasFinePointer, reducedMotion, subscribe } from '../scroll';

/**
 * The public site's delegated motion: one component, mounted once in the
 * frame, for the effects that belong to every page rather than to any one
 * component on it.
 *
 *   - Buttons flood with colour from the point the pointer came in at, and
 *     drain back out the way it left (`.m-flood`; CSS draws the circle).
 *   - The calls to action throw a handful of desert-coloured shapes — suns,
 *     arches and stones — when pressed (anything carrying `data-demo` or
 *     `data-signup`, the same attributes the analytics taxonomy already uses).
 *   - Section labels decode: the small uppercase label over a section types
 *     itself out of scrambled glyphs, left to right, the first time it comes
 *     into view.
 *
 * Every one of them is delegated or discovered from the page, so a button or a
 * label gets the behaviour by carrying a class, and a server component does not
 * have to become a client one to join in.
 *
 * Every one of them is also switched off, not turned down, for anyone who has
 * asked for less motion.
 */
export function Play() {
  const path = usePathname();

  /* ── Floods and confetti: delegated once, for the life of the frame ── */
  useEffect(() => {
    if (reducedMotion()) return;
    const fine = hasFinePointer();

    const origin = (e: PointerEvent) => {
      if (!fine) return;
      const b = (e.target as Element).closest?.<HTMLElement>('.m-flood');
      if (!b || !hydrated(b)) return;
      // pointerover/out bubble and fire for children too; only the crossing of
      // the button's own edge is an entrance or an exit.
      const related = e.relatedTarget as Node | null;
      if (related && b.contains(related)) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty('--fx', `${e.clientX - r.left}px`);
      b.style.setProperty('--fy', `${e.clientY - r.top}px`);
    };

    const throwOnPress = (e: MouseEvent) => {
      const b = (e.target as Element).closest?.<HTMLElement>('[data-demo], [data-signup]');
      if (!b) return;
      const r = b.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2, 44);
    };

    document.addEventListener('pointerover', origin);
    document.addEventListener('pointerout', origin);
    document.addEventListener('click', throwOnPress);
    return () => {
      document.removeEventListener('pointerover', origin);
      document.removeEventListener('pointerout', origin);
      document.removeEventListener('click', throwOnPress);
    };
  }, []);

  /* ── Labels decode: found afresh on every page ── */
  useEffect(() => {
    if (reducedMotion()) return;
    const waiting = new Set(
      Array.from(document.querySelectorAll<HTMLElement>('[data-skin="desert"] .m-eyebrow')).filter(
        // One text node and nothing else, so the text can be rewritten in
        // place without touching any node React owns the identity of.
        (el) =>
          el.childNodes.length === 1 &&
          el.firstChild?.nodeType === Node.TEXT_NODE &&
          // The ticker's labels are already moving; scrambling them as well
          // is noise rather than a reveal.
          !el.closest('.m-ticker'),
      ),
    );
    if (!waiting.size) return;

    const read = () => {
      const vh = window.innerHeight;
      for (const el of waiting) {
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0 && r.width > 0 && hydrated(el)) {
          waiting.delete(el);
          decode(el);
        }
      }
      if (!waiting.size) stop();
    };
    // On the first page of a visit the opening sequence covers the screen;
    // decoding labels nobody can see would waste the effect.
    const wait = document.documentElement.dataset.intro === 'on' ? 1300 : 120;
    let stop = () => {};
    const t = window.setTimeout(() => {
      stop = subscribe(read);
      read();
    }, wait);
    // Labels already on screen whose part of the page had not hydrated at
    // the first look get two more, without waiting for a scroll.
    const again = [700, 1800].map((ms) => window.setTimeout(read, wait + ms));
    return () => {
      window.clearTimeout(t);
      again.forEach((a) => window.clearTimeout(a));
      stop();
    };
  }, [path]);

  return null;
}

/**
 * Whether React has hydrated this element yet.
 *
 * Play is one component in the frame, and the page around it can hydrate in
 * pieces after it does. Writing a style or a text node into markup React has
 * not reached yet makes the server HTML disagree with what React expects, and
 * React reports a hydration error and throws the subtree away. React marks each
 * node it has hydrated with its own expando property, and that mark is the
 * one reliable signal there is, so anything here that writes into the page
 * waits for it.
 */
function hydrated(el: Element): boolean {
  return Object.keys(el).some((k) => k.startsWith('__reactProps'));
}

/* ── Decoding a label ──────────────────────────────────────────────────── */

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789₹%&+=/<>';

/**
 * Types a label out of random glyphs, left to right, in about half a second.
 * The box is held at its final width while it does, so nothing beside it moves,
 * and the real text is restored exactly at the end.
 */
function decode(el: HTMLElement) {
  const node = el.firstChild as Text;
  const text = node.nodeValue ?? '';
  const len = text.length;
  if (!len || len > 48) return;

  const w = el.getBoundingClientRect().width;
  el.style.minWidth = `${w}px`;
  el.style.whiteSpace = 'nowrap';
  const dur = 480 + len * 16;
  let t0 = 0;

  const frame = (now: number) => {
    if (!t0) t0 = now;
    const done = (now - t0) / dur;
    if (done >= 1 || !el.isConnected) {
      node.nodeValue = text;
      el.style.minWidth = '';
      el.style.whiteSpace = '';
      return;
    }
    let out = '';
    for (let k = 0; k < len; k++) {
      const c = text.charAt(k);
      out += c === ' ' || k / len < done * 1.15 - 0.1 ? c : GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
    }
    node.nodeValue = out;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* ── Confetti ──────────────────────────────────────────────────────────── */

/**
 * A handful of desert shapes thrown up from a point, pulled down by gravity,
 * and removed. Plain elements on a fixed layer, not a canvas, and the layer
 * ignores the pointer, so nothing it draws can be in the way of a click.
 *
 * The colours are read from the skin's own tokens at the moment of throwing,
 * so they are the page's colours by construction rather than a second copy of
 * them here.
 */
function confetti(x: number, y: number, n: number) {
  const skin = document.querySelector<HTMLElement>('[data-skin="desert"]');
  if (!skin) return;
  const css = getComputedStyle(skin);
  const colours = ['--m-gold', '--m-sun', '--m-emerald', '--m-ink', '--m-violet']
    .map((v) => css.getPropertyValue(v).trim())
    .filter(Boolean);
  const shapes = ['9999px', '9999px 9999px 0 0', '2px', '9999px 0'];

  const layer = document.createElement('div');
  layer.className = 'm-confetti';
  layer.setAttribute('aria-hidden', 'true');

  const bits = Array.from({ length: n }, (_, k) => {
    const b = document.createElement('i');
    const size = 6 + Math.random() * 7;
    b.style.width = `${size}px`;
    b.style.height = `${size * (k % 4 === 1 ? 1.3 : 1)}px`;
    b.style.background = colours[k % colours.length];
    b.style.borderRadius = shapes[k % shapes.length];
    layer.appendChild(b);
    const a = ((-90 + (Math.random() - 0.5) * 120) * Math.PI) / 180;
    const v = 6 + Math.random() * 9;
    return { el: b, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 360, vr: (Math.random() - 0.5) * 22 };
  });
  document.body.appendChild(layer);

  const t0 = performance.now();
  const step = (now: number) => {
    const life = (now - t0) / 1500;
    for (const p of bits) {
      p.vy += 0.4;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      p.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) rotate(${p.r.toFixed(0)}deg)`;
      p.el.style.opacity = life > 0.7 ? (1 - (life - 0.7) / 0.3).toFixed(2) : '1';
    }
    if (life < 1) requestAnimationFrame(step);
    else layer.remove();
  };
  requestAnimationFrame(step);
}
