'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the desktop rail is collapsed.
 *
 * The value lives on `<html data-rail>` and in localStorage, not in React. That is
 * deliberate: the rail and the content column beside it are rendered by different
 * components and must change in the same frame, and a CSS variable keyed off the
 * attribute is the only way to do that without a server component holding state.
 *
 * Read through useSyncExternalStore for the same reason `lib/theme.ts` does — it
 * gives a correct server snapshot, so there is no hydration mismatch and no
 * setState-in-an-effect to cascade a second render. The script in the root layout
 * has already applied the attribute before first paint, so nothing here is
 * responsible for how the page looks; this only tells the toggle which way round
 * its icon should be.
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
  getSnapshot: () => document.documentElement.getAttribute('data-rail') === 'collapsed',
  // The server cannot know. Expanded is the default the CSS also assumes.
  getServerSnapshot: () => false,
};

export function setRailCollapsed(collapsed: boolean) {
  const root = document.documentElement;
  if (collapsed) root.setAttribute('data-rail', 'collapsed');
  else root.removeAttribute('data-rail');

  try {
    localStorage.setItem('rail', collapsed ? 'collapsed' : 'open');
  } catch {
    // A blocked storage API is not a reason to refuse to collapse the rail.
  }

  listeners.forEach((l) => l());
}

export function useRailCollapsed(): boolean {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
