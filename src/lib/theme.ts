'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export const THEMES: readonly Theme[] = ['light', 'dark', 'system'];

/**
 * What a new account gets before anybody has chosen.
 *
 * Dark rather than 'system'. The public site is dark always, so somebody arriving
 * from it on a light-set machine used to watch the product turn white at the moment
 * they signed in, which reads as two different products. Whoever wants their machine
 * followed can say so in the account menu, and that choice then wins for good.
 */
export const DEFAULT_THEME: Theme = 'dark';

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
   * Dark until told otherwise. This has to be the same rule the pre-paint script
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
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
