'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { startCapture } from '@/lib/analytics/capture';

/**
 * The whole client side of the analytics: one component, mounted once in the
 * root layout, so the public site and the workspace are measured the same way.
 *
 * What it does, and nothing else:
 *   - keeps a random visitor ID in the first-party `fi_vid` cookie for a year,
 *     so a returning browser is the same visitor (and the server can read it,
 *     which is how an access request is tied to the browsing behind it);
 *   - keeps a tab-session ID in sessionStorage, so "visits" can be counted;
 *   - on every page opened, sends the page, the referrer, the campaign tags on
 *     the first page, and the screen, language and time zone;
 *   - counts the seconds the page is visible and not left idle for more than
 *     two minutes, and sends the running total every 15 seconds and when the
 *     page is hidden or left.
 * The server adds the rest (lib/analytics/hit) and, if the person is signed
 * in, joins this browser to their account.
 *
 * It also starts lib/analytics/capture, which records the fields people fill
 * in and the buttons they press (migration 0036).
 *
 * It does nothing when the browser sends Do Not Track or Global Privacy
 * Control, and does not record the Admin screen itself, so looking at the
 * numbers does not change them.
 */

const COOKIE = 'fi_vid';
const YEAR = 31536000;
const IDLE_AFTER = 120;

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function visitorId(): string {
  const found = document.cookie.match(/(?:^|;\s*)fi_vid=([0-9a-f-]{36})/i)?.[1];
  const id = found ?? uuid();
  // Rewritten on every visit, so the year runs from the last visit, not the first.
  document.cookie = `${COOKIE}=${id}; Max-Age=${YEAR}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  return id;
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem('fi_sid');
    if (!id) {
      id = uuid();
      sessionStorage.setItem('fi_sid', id);
    }
    return id;
  } catch {
    return 'no-session-storage';
  }
}

function send(body: Record<string, unknown>, leaving = false) {
  const json = JSON.stringify(body);
  if (leaving && navigator.sendBeacon?.('/api/track', new Blob([json], { type: 'application/json' }))) return;
  fetch('/api/track', { method: 'POST', body: json, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
}

const opted = () =>
  navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

/** The page before this one, inside the site, for the referrer of a client-side navigation. */
let previousUrl: string | null = null;
let firstView = true;

export function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    startCapture();
  }, []);

  useEffect(() => {
    if (!pathname || pathname.startsWith('/analytics') || opted()) return;

    const vid = visitorId();
    const sid = sessionId();
    const viewId = uuid();
    const params = new URLSearchParams(location.search);
    const referrer = firstView ? document.referrer : previousUrl;

    let seconds = 0;
    let sent = 0;
    let lastActive = Date.now();

    // A tick later, so a client-side navigation has had its title set.
    const start = window.setTimeout(() => {
      send({
        type: 'view',
        vid,
        sid,
        view_id: viewId,
        // The path alone: query strings carry invite tokens and sign-in codes.
        path: pathname,
        title: document.title,
        referrer,
        ...(firstView
          ? {
              utm_source: params.get('utm_source'),
              utm_medium: params.get('utm_medium'),
              utm_campaign: params.get('utm_campaign'),
            }
          : {}),
        screen: `${screen.width}x${screen.height}`,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      firstView = false;
    }, 300);

    const flush = (leaving = false) => {
      if (seconds === sent) return;
      sent = seconds;
      send({ type: 'time', vid, sid, view_id: viewId, seconds }, leaving);
    };

    const active = () => {
      lastActive = Date.now();
    };
    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if ((Date.now() - lastActive) / 1000 > IDLE_AFTER) return;
      seconds += 1;
      if (seconds % 15 === 0) flush();
    }, 1000);

    const hidden = () => {
      if (document.visibilityState === 'hidden') flush(true);
      else active();
    };
    const leave = () => flush(true);
    const events = ['pointerdown', 'keydown', 'scroll', 'mousemove', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, active, { passive: true });
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', leave);

    return () => {
      window.clearTimeout(start);
      window.clearInterval(tick);
      for (const e of events) window.removeEventListener(e, active);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', leave);
      flush(true);
      previousUrl = location.origin + pathname;
    };
  }, [pathname]);

  return null;
}
