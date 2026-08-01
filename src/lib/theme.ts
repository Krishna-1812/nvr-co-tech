'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export const THEMES: readonly Theme[] = ['light', 'dark', 'system'];

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
  getSnapshot: (): Theme => (localStorage.getItem('theme') as Theme) ?? 'system',
  // The server cannot know the preference; 'system' is the safe default.
  getServerSnapshot: (): Theme => 'system',
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
