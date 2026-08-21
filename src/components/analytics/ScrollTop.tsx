'use client';

import { useEffect } from 'react';

/**
 * Start at the top.
 *
 * Browsers restore the previous scroll position when a page is revisited, which
 * is right almost everywhere and wrong here: this page is normally reached from
 * a notification about one specific request, and landing halfway down a list of
 * four hundred with no idea why is disorienting. The newest request is at the
 * top, so the top is where the answer is.
 *
 * Renders nothing. An effect in a component rather than a script so it runs after
 * the browser has finished its own restoration, which would otherwise win.
 */
export function ScrollTop() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return null;
}
