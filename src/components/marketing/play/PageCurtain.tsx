'use client';

import { useEffect, useState } from 'react';

/**
 * The transition between public pages.
 *
 * Four bands of the desert's colours sweep up across the screen as the next
 * page comes in, and the page itself rises in behind them out of a rounded
 * window — the same four colours as the opening sequence, so moving through the
 * site feels like the curtain going up on each room in turn.
 *
 * Mounted by `(marketing)/template.tsx`, which Next remounts on every
 * navigation between public pages. It plays only on those client-side
 * navigations, never on the first page of a visit: the server-rendered page is
 * painted as it arrives, with nothing clipping or covering it, so the first
 * impression and the largest paint are never held up by a transition. The
 * first page has the opening sequence (IntroCurtain) on the home page, and the
 * hero's own entrances everywhere else.
 *
 * `entering` is decided at render from a flag the first mount sets, so the
 * server render and the hydrating render agree (both false) and every later
 * mount renders with it set from its first frame.
 *
 * Under reduced motion CSS removes both the bands and the rise.
 */
let mounted = false;

export function PageCurtain({ children }: { children: React.ReactNode }) {
  const [entering] = useState(() => mounted);

  useEffect(() => {
    mounted = true;
  }, []);

  return (
    <>
      {/* A sibling of the page, not inside it: the page's rise is a clip-path,
          and a clip on an ancestor clips fixed descendants too. */}
      {entering && (
        <div aria-hidden className="m-curtain">
          <i style={{ background: 'var(--m-gold)' }} />
          <i style={{ background: 'var(--m-sun)' }} />
          <i style={{ background: 'var(--m-bg-3)' }} />
          <i style={{ background: 'var(--m-ink)' }} />
        </div>
      )}
      <div className={entering ? 'm-page-in' : undefined}>{children}</div>
    </>
  );
}
