'use client';

import { useEffect } from 'react';
import { BRAND } from '@/lib/marketing/brand';
import { LogoMark } from '../Logo';
import { Letters } from './Letters';

/**
 * The workspace's welcome: once per session after signing in, a greeting by
 * name drops in over four bands of the desert's colours, and then the bands
 * lift off the page like a blind going up, uncovering the hub as its lines
 * rise.
 *
 * The public home page opened the same way until 29 Oct, with the brand in
 * place of the greeting. It was taken off for speed: for its second and a half
 * a first visit saw nothing else, which on a phone held the first sight of the
 * page back to about 3 seconds. A signed-in reader has already chosen to be
 * here; a first-time visitor and a search engine's measurements have not.
 *
 * ── Who sees it, and when that is decided ────────────────────────────────
 *
 * The decision is made before first paint, by the inline script in the root
 * layout's <head>: the hub, no `tfi-welcome` in sessionStorage, and no request
 * for reduced motion. If all of
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
export function IntroCurtain({
  text = BRAND.name,
  tag = BRAND.tagline,
  storageKey = 'tfi-intro',
}: {
  /** The line that drops in. The brand on the public site; a greeting in the app. */
  text?: string;
  tag?: string;
  /** The sessionStorage key the <head> script checks. One per curtain. */
  storageKey?: string;
} = {}) {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== 'on') return;
    try {
      sessionStorage.setItem(storageKey, '1');
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
  }, [storageKey]);

  return (
    <div aria-hidden className="m-intro">
      <div className="m-intro-face">
        <div className="m-intro-word">
          <LogoMark id="intro-mark" className="m-intro-mark size-14 sm:size-20" />
          <span className="m-display">
            <Letters text={text} />
          </span>
          <span className="m-intro-tag m-mono t-1 t-caps uppercase">{tag}</span>
        </div>
      </div>
      <div className="m-intro-bars">
        <i style={{ background: 'var(--p-band-1)' }} />
        <i style={{ background: 'var(--p-band-2)' }} />
        <i style={{ background: 'var(--p-band-3)' }} />
        <i style={{ background: 'var(--p-band-4)' }} />
      </div>
    </div>
  );
}
