import type { Metadata } from 'next';
import { NotFoundPanel } from '@/components/marketing/NotFoundPanel';
import { PublicShell } from '@/components/marketing/PublicShell';

/**
 * Every URL on this origin that matches no route at all, plus the deliberate
 * notFound() calls that are thrown from a layout rather than from a page —
 * which is the analytics gate, and is why the copy names nothing.
 *
 * ── Why it no longer asks who is here ──────────────────────────────────────
 *
 * It used to read the session and give a signed-in person the application's
 * 404 instead of the public site's. That one cookie read made the whole public
 * site uncacheable: Next renders this boundary into the payload of every page,
 * so reading a cookie here marked every page as rendered per request. Each one
 * was built afresh on every visit (`no-store`), half a second of server time
 * before the first byte, where a static page answers from the edge in a tenth
 * of that. Search engines measure that wait, and so does every visitor.
 *
 * So this is the public 404, for everybody, and it is static. The signed-in
 * groups whose pages call notFound() for a missing record (vouchers,
 * reconciliations, contacts, Will Maker) have their own not-found.tsx with the
 * application's 404 (components/app/AppNotFound). What still lands here for a
 * signed-in person is a mistyped address and the analytics gate (thrown from
 * `(insight)/layout.tsx`, which a not-found beside it cannot catch); the public
 * 404 says nothing about /analytics either, and offers the way back in.
 */

// Title only. Next stamps its own `noindex` on a not-found response, so setting
// `robots` here would put a second, redundant robots tag beside it.
export const metadata: Metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <PublicShell>
      <NotFoundPanel />
    </PublicShell>
  );
}
