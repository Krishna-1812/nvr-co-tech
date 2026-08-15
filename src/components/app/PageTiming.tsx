'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * How long a signed-in person spent on each screen.
 *
 * The public site's tracker cannot do this job. It measures a page view, and in
 * an App Router application a move from the register to a voucher is not a page
 * view — nothing unloads, so nothing would ever be sent. So the signed-in side
 * measures the thing it actually has, which is a pathname that changes, and
 * files the previous one when it does.
 *
 * Everything else is left to the server: who this is comes from the session and
 * the visitor id comes from the cookie, neither of which this component sees or
 * needs to. All it contributes is a number of seconds and where they were spent.
 */
export function PageTiming() {
  const pathname = usePathname();
  // Seeded in the effect rather than here: reading the clock during render is
  // an impure call, and the value would be wrong anyway — what is being timed
  // starts when the effect runs, not when React first rendered the tree.
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
    const page = pathname;
    const title = document.title;
    let sent = false;

    const send = () => {
      if (sent) return;
      const seconds = Math.round((Date.now() - startedAt.current) / 1000);
      // Under a second is a redirect or a mistyped click, not a screen anybody
      // read, and a register full of one-second rows tells nobody anything.
      if (seconds < 1) return;
      sent = true;

      const body = JSON.stringify({ page, title, seconds });
      // Same reasoning as the public tracker: sendBeacon is the only delivery
      // that survives the tab going away, which is when this usually fires.
      if (!navigator.sendBeacon?.('/api/track', body)) {
        fetch('/api/track', { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    };

    const onHide = () => {
      if (document.visibilityState === 'hidden') send();
    };

    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', send);

    // The cleanup is the common case: a navigation inside the app, where React
    // unmounts this effect and there is no unload event at all.
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', send);
      send();
    };
  }, [pathname]);

  return null;
}
