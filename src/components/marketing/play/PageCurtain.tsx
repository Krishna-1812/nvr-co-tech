'use client';

import { useEffect, useState } from 'react';
import type React from 'react';
import { usePathname } from 'next/navigation';
import { agentBySlug } from '@/lib/marketing/content';
import { ACCENT, ON_ACCENT } from '../bits';

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
 *
 * ── Arriving at a tool ────────────────────────────────────────────────────
 *
 * A page about one tool gets its own door instead of the bands (17 Oct): a
 * doorway in that tool's colour rises up the screen with the tool's name set
 * across it, holds for a beat, and lifts away to show the page. Whether the
 * reader came from the roster, from the "next tool" link at the foot of
 * another tool, or from the footer, the arrival is the tool's own, and it is
 * the same arch the tool stands in everywhere else on the site.
 */
let mounted = false;

export function PageCurtain({
  children,
  scope = 'site',
}: {
  children: React.ReactNode;
  /**
   * Which template mounted this. The site's template remounts only when the
   * first part of the address changes, so it never sees /tools to
   * /tools/voucher-desk, or one tool to the next. `tools/template.tsx` mounts
   * a second curtain that does, and the site's stands aside anywhere under
   * /tools so the two never play at once.
   */
  scope?: 'site' | 'tools';
}) {
  const [entering] = useState(() => mounted);
  const path = usePathname() ?? '';
  const tool = agentBySlug(/^\/tools\/([^/]+)\/?$/.exec(path)?.[1] ?? '');

  useEffect(() => {
    mounted = true;
  }, []);

  if (scope === 'site' && /^\/tools(\/|$)/.test(path)) return <>{children}</>;

  return (
    <>
      {/* A sibling of the page, not inside it: the page's rise is a clip-path,
          and a clip on an ancestor clips fixed descendants too. */}
      {entering && tool && (
        <div
          aria-hidden
          className="m-door"
          style={{ '--door': ACCENT[tool.accent], '--door-on': ON_ACCENT[tool.accent] } as React.CSSProperties}
        >
          <div className="m-door-arch">
            <span className="m-door-sun" />
            <span className="m-door-name m-display">{tool.name}</span>
          </div>
        </div>
      )}
      {entering && !tool && (
        <div aria-hidden className="m-curtain">
          <i style={{ background: 'var(--p-band-1)' }} />
          <i style={{ background: 'var(--p-band-2)' }} />
          <i style={{ background: 'var(--p-band-3)' }} />
          <i style={{ background: 'var(--p-band-4)' }} />
        </div>
      )}
      <div className={entering ? 'm-page-in' : undefined}>{children}</div>
    </>
  );
}
