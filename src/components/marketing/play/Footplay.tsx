'use client';

import { useEffect, useRef } from 'react';
import { BRAND } from '@/lib/marketing/content';
import { Letters } from './Letters';
import { Springy } from './Springy';
import { reducedMotion, subscribe, useInView } from '../scroll';

/**
 * The brand's name, set across the whole foot of every public page.
 *
 * Its letters rise out of the baseline one after another the first time it
 * comes into view, and once they have all landed they answer the pointer like
 * keys being pressed from underneath (Springy). It is the last thing on every
 * page and the largest type on the site, which is why it is allowed to be the
 * most playful.
 *
 * Sized in container units, so the name fills the footer's width exactly at
 * every screen size without a breakpoint per phone.
 */
export function FootWord() {
  const host = useRef<HTMLDivElement>(null);
  const shown = useInView(host, { margin: 0.95 });

  return (
    <div ref={host} className="m-footword-box @container">
      <Springy
        reach={240}
        delay={900 + BRAND.name.length * 38}
        armed={shown}
        className={`m-footword m-display ${shown ? 'is-up' : ''}`}
      >
        <Letters text={BRAND.name} />
      </Springy>
    </div>
  );
}

/*
 * ── The shape tiles ────────────────────────────────────────────────────────
 *
 * Six small tiles in the desert's colours that will not keep still: every
 * second or so one of them changes shape — sun, arch, dune, stone, leaf,
 * doorway — and turns a quarter. Hovering one turns it half over; clicking one
 * changes its colour. Nothing depends on them; they are the footer's toys.
 *
 * The shapes are border-radius values, not paths, which is why no animation
 * library is needed to morph between them: a browser interpolates one set of
 * corner radii into another on its own, and the result is a shape that melts
 * from a circle into an arch rather than being swapped for one.
 */

const SHAPES = [
  '9999px',
  '9999px 9999px 0 0',
  '9999px 9999px 0.35rem 0.35rem / 70% 70% 0.35rem 0.35rem',
  '0.45rem',
  '9999px 0',
  '0 9999px 9999px 9999px',
] as const;

const TONES = [
  'var(--m-gold)',
  'var(--m-sun)',
  'var(--m-emerald)',
  'var(--m-ink)',
  'var(--m-bg-3)',
  'var(--m-violet)',
] as const;

export function FootToys() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || reducedMotion()) return;
    const tiles = Array.from(el.querySelectorAll<HTMLElement>('.m-toy'));
    const turns = tiles.map(() => 0);
    let near = false;

    const turn = (k: number, deg: number) => {
      turns[k] += deg;
      tiles[k].style.setProperty('--tr', `${turns[k]}deg`);
    };
    const reshape = (k: number) => {
      const now = Number(tiles[k].dataset.shape);
      const next = (now + 1 + Math.floor(Math.random() * (SHAPES.length - 1))) % SHAPES.length;
      tiles[k].dataset.shape = String(next);
      tiles[k].style.borderRadius = SHAPES[next];
    };
    const recolour = (k: number) => {
      const next = (Number(tiles[k].dataset.tone) + 1) % TONES.length;
      tiles[k].dataset.tone = String(next);
      tiles[k].style.background = TONES[next];
    };

    const offs = tiles.map((t, k) => {
      const over = () => turn(k, 180);
      const click = () => {
        recolour(k);
        turn(k, 90);
      };
      t.addEventListener('pointerenter', over);
      t.addEventListener('click', click);
      return () => {
        t.removeEventListener('pointerenter', over);
        t.removeEventListener('click', click);
      };
    });

    // Only fidget while the footer is on screen and the tab is visible.
    const stopRead = subscribe(() => {
      const r = el.getBoundingClientRect();
      near = r.top < window.innerHeight && r.bottom > 0;
    });
    const near0 = el.getBoundingClientRect();
    near = near0.top < window.innerHeight && near0.bottom > 0;
    const fidget = window.setInterval(() => {
      if (!near || document.hidden) return;
      const k = Math.floor(Math.random() * tiles.length);
      reshape(k);
      turn(k, 90);
    }, 1100);

    return () => {
      offs.forEach((off) => off());
      stopRead();
      window.clearInterval(fidget);
    };
  }, []);

  return (
    <div ref={host} aria-hidden className="flex items-center gap-2">
      {SHAPES.map((shape, k) => (
        <span
          key={k}
          data-shape={k}
          data-tone={k}
          className="m-toy block size-6 cursor-pointer sm:size-7"
          style={{ borderRadius: shape, background: TONES[k] }}
        />
      ))}
    </div>
  );
}
