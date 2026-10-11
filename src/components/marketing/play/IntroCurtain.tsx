'use client';

import { useEffect } from 'react';
import { BRAND } from '@/lib/marketing/content';
import { LogoMark } from '../Logo';
import { Letters } from './Letters';

/**
 * The opening sequence: the first time someone arrives on the home page in a
 * session, the name drops in over four bands of the desert's colours, and then
 * the bands lift off the page like a blind going up, uncovering the hero as
 * its lines rise.
 *
 * ── Who sees it, and when that is decided ────────────────────────────────
 *
 * The decision is made before first paint, by the inline script in the root
 * layout's <head>: home page, no `tfi-intro` in sessionStorage, not arriving
 * from another page of this site, and no request for reduced motion. If all of
 * that holds it sets `data-intro="on"` on <html>, and CSS does the rest. This
 * markup is always rendered and is `display: none` without that attribute, so
 * nobody who should not see it ever gets a frame of it, and nobody who should
 * waits for hydration to get it.
 *
 * ── It must never be in the way ──────────────────────────────────────────
 *
 * - Any click, key, wheel or touch skips it at once.
 * - It is about a second and a half, start to finish.
 * - It is entirely CSS once the attribute is set, and the overlay carries its
 *   own fail-safe: an animation that hides it outright at 2.4s, so a page
 *   whose scripts never arrive still opens.
 * - The hero underneath waits for it (`--intro-wait`, read by Rise and
 *   LineRise), so the headline's entrance is seen rather than spent behind the
 *   curtain.
 * - It plays once per session. Navigating back to the home page does not
 *   replay it.
 */
export function IntroCurtain() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== 'on') return;
    try {
      sessionStorage.setItem('tfi-intro', '1');
    } catch {
      // Private browsing that refuses storage: the sequence plays, and will
      // play again next time, which is the right way round to fail.
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      root.dataset.intro = 'out';
      // 'out' drops the hero's wait, so its entrance plays now, and pulls the
      // sweep forward; the attribute goes once the bands have cleared.
      window.setTimeout(() => delete root.dataset.intro, 1300);
      events.forEach((t) => window.removeEventListener(t, finish));
    };
    const events = ['click', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((t) => window.addEventListener(t, finish, { passive: true }));
    // The sequence runs itself in CSS; this only ends it early on input,
    // and clears the attribute once the hero's entrance has played out.
    const natural = window.setTimeout(() => {
      done = true;
      events.forEach((t) => window.removeEventListener(t, finish));
      window.setTimeout(() => delete root.dataset.intro, 1500);
    }, 1500);

    return () => {
      window.clearTimeout(natural);
      events.forEach((t) => window.removeEventListener(t, finish));
    };
  }, []);

  return (
    <div aria-hidden className="m-intro">
      <div className="m-intro-face">
        <div className="m-intro-word">
          <LogoMark id="intro-mark" className="m-intro-mark size-14 sm:size-20" />
          <span className="m-display">
            <Letters text={BRAND.name} />
          </span>
          <span className="m-intro-tag m-mono t-1 t-caps uppercase">{BRAND.tagline}</span>
        </div>
      </div>
      <div className="m-intro-bars">
        <i style={{ background: 'var(--m-gold)' }} />
        <i style={{ background: 'var(--m-sun)' }} />
        <i style={{ background: 'var(--m-bg-3)' }} />
        <i style={{ background: 'var(--m-ink)' }} />
      </div>
    </div>
  );
}
