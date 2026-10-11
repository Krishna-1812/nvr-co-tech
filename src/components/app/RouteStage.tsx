'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * How one signed-in screen gives way to the next.
 *
 * Every move to another screen, within a tool or into another one, plays the
 * public site's curtain: the four bands are already down when the new screen's
 * frame paints, hold a beat while it streams in, and lift band by band as the
 * screen rises in behind them.
 *
 * This used to be two weights — the curtain only when changing tool, and a
 * quick rise within one, on the reasoning that somebody working through thirty
 * vouchers would otherwise see thirty curtains. The owner asked for the curtain
 * on every page change (11 Oct), so it now plays on all of them. If that ever
 * needs walking back, the earlier version is in git: the room each screen
 * belongs to was compared with the last one's.
 *
 * It does not play on the first screen of a visit, which is painted as the
 * server sent it — see PageCurtain on the public site for why the first paint
 * is never held up — and it does not play under reduced motion.
 *
 * Keyed by path rather than mounted per route group, so one component in the
 * shell covers every tool. A change of query string (a filter, a tab, the
 * chosen company on Valuation Desk) is not a navigation to a new screen and
 * does not replay it.
 */
let mounted = false;

export function RouteStage({ children }: { room?: string; children: React.ReactNode }) {
  const path = usePathname();
  return <Stage key={path}>{children}</Stage>;
}

function Stage({ children }: { children: React.ReactNode }) {
  // Decided at render from module state, so the hydrating render matches the
  // server (both false) and every later mount renders with the curtain down
  // from its first frame.
  const [curtain] = useState(() => mounted);

  useEffect(() => {
    mounted = true;
  }, []);

  return (
    <>
      {curtain && (
        <div aria-hidden className="m-curtain p-lift">
          <i style={{ background: 'var(--p-band-1)' }} />
          <i style={{ background: 'var(--p-band-2)' }} />
          <i style={{ background: 'var(--p-band-3)' }} />
          <i style={{ background: 'var(--p-band-4)' }} />
        </div>
      )}
      {/* The curtain here starts closed and lifts, rather than sweeping up
          from below as the public site's does: a new screen's frame paints
          before its content has streamed in, and a curtain already down hides
          that half-built moment instead of revealing it. */}
      <div className={curtain ? 'p-tool-in' : undefined}>{children}</div>
    </>
  );
}
