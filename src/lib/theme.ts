'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export const THEMES: readonly Theme[] = ['light', 'dark', 'system'];

/**
 * What a new account gets before anybody has chosen.
 *
 * Light rather than 'system'. The public site is the light desert always, so
 * somebody arriving from it on a dark-set machine would otherwise watch the product
 * turn dark at the moment they signed in, which reads as two different products.
 * Whoever wants their machine followed can say so in the account menu, and that
 * choice then wins for good.
 */
export const DEFAULT_THEME: Theme = 'light';

/**
 * Theme preference lives in localStorage, which is external to React. Reading it
 * with useSyncExternalStore (rather than setState in an effect) gives a correct
 * server snapshot, so there is no hydration mismatch and no cascading render.
 * The inline script in the root layout applies it before first paint.
 *
 * This is a single module-level store on purpose. Both the account menu and the
 * settings screen show the current theme; if each kept its own listener set,
 * changing it in one would leave the other displaying the old value.
 */
const listeners = new Set<() => void>();

const store = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    // Keep other tabs in sync.
    window.addEventListener('storage', cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener('storage', cb);
    };
  },
  /*
   * Light until told otherwise. This has to be the same rule the pre-paint script
   * in the root layout applies, or the account menu would show Dark ticked while
   * the page was light, or the other way round.
   */
  getSnapshot: (): Theme => (localStorage.getItem('theme') as Theme | null) ?? DEFAULT_THEME,
  // The server cannot read localStorage, so it assumes the default. Anyone who has
  // pinned something else sees it corrected on hydration, before paint.
  getServerSnapshot: (): Theme => DEFAULT_THEME,
};

export function setTheme(t: Theme) {
  const root = document.documentElement;
  const apply = () => {
    if (t === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    listeners.forEach((l) => l());
  };

  /*
   * The new theme spreads out as a circle from wherever it was chosen — the
   * account menu, the settings screen, the command palette's row — over the old
   * one, using the browser's own view transition: it photographs the page as
   * it was, applies the change underneath, and this only says how the new
   * picture is uncovered. Without the API, under reduced motion, or when
   * nothing would visibly change, the theme simply changes.
   */
  const dark = () => root.getAttribute('data-theme') === 'dark' ||
    (!root.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const was = dark();
  const willBe = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (
    was === willBe ||
    typeof document.startViewTransition !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    apply();
    return;
  }
  const x = lastPress?.x ?? window.innerWidth / 2;
  const y = lastPress?.y ?? window.innerHeight / 2;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  root.classList.add('d-theming');
  const vt = document.startViewTransition(apply);
  vt.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(0.65, 0, 0.25, 1)', pseudoElement: '::view-transition-new(root)' },
      ),
    )
    .catch(() => {});
  vt.finished.finally(() => root.classList.remove('d-theming'));
}

/** Where the last press landed, so a theme change can spread out from it. */
let lastPress: { x: number; y: number } | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      lastPress = { x: e.clientX, y: e.clientY };
    },
    { capture: true, passive: true },
  );
  // A keyboard choice has no point to spread from; it opens from the middle.
  window.addEventListener('keydown', () => (lastPress = null), { capture: true, passive: true });
}

export function useTheme(): Theme {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
