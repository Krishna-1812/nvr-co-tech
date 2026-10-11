'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * How one signed-in screen gives way to the next.
 *
 * Two weights of transition, chosen by how far the person has travelled:
 *
 *   - Into another tool (Voucher Desk to Ledger Reconciliation, the workspace
 *     to anything): the four bands of the public site's curtain sweep up across
 *     the whole window and the new tool rises in behind them. Changing tools is
 *     changing rooms, and it is rare enough to be allowed a moment.
 *   - Within a tool (the register to a voucher, a voucher back to the
 *     register): the screen simply rises into place out of a soft clip, in
 *     under half a second. Somebody working through thirty vouchers is doing
 *     exactly this thirty times, and a curtain on every one of them would be
 *     the decoration getting in the way of the work.
 *
 * Neither plays on the first screen of a visit, which is painted as the server
 * sent it — see PageCurtain on the public site for why the first paint is never
 * held up — and neither plays under reduced motion.
 *
 * Keyed by path rather than mounted per route group, so one component in the
 * shell covers every tool. A change of query string (a filter, a tab, the
 * chosen company on Valuation Desk) is not a navigation to a new screen and
 * does not replay it.
 */
let mounted = false;
let lastRoom = '';

export function RouteStage({ room, children }: { room: string; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <Stage key={path} room={room}>
      {children}
    </Stage>
  );
}

function Stage({ room, children }: { room: string; children: React.ReactNode }) {
  // Decided at render from module state, so the hydrating render matches the
  // server (both 'none') and every later mount renders with its answer from
  // its first frame.
  const [kind] = useState<'none' | 'rise' | 'curtain'>(() =>
    !mounted ? 'none' : lastRoom && lastRoom !== room ? 'curtain' : 'rise',
  );

  useEffect(() => {
    mounted = true;
    lastRoom = room;
  }, [room]);

  return (
    <>
      {kind === 'curtain' && (
        <div aria-hidden className="m-curtain p-lift">
          <i style={{ background: 'var(--p-band-1)' }} />
          <i style={{ background: 'var(--p-band-2)' }} />
          <i style={{ background: 'var(--p-band-3)' }} />
          <i style={{ background: 'var(--p-band-4)' }} />
        </div>
      )}
      {/* The curtain here starts closed and lifts, rather than sweeping up
          from below as the public site's does: a new tool's frame paints
          before its screen has streamed in, and a curtain already down hides
          that half-built moment instead of revealing it. */}
      <div className={kind === 'curtain' ? 'p-tool-in' : kind === 'rise' ? 'p-route-in' : undefined}>
        {children}
      </div>
    </>
  );
}
