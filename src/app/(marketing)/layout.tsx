import type { Viewport } from 'next';
import { PublicShell } from '@/components/marketing/PublicShell';

/**
 * The colour a phone paints its browser chrome on public pages: the bone the
 * page is drawn on, so the address bar reads as part of the page rather than a
 * navy band above it. The root layout's navy stays for the signed-in app.
 */
export const viewport: Viewport = {
  themeColor: '#F6EFE4',
};

/**
 * Shell for every public page.
 *
 * The frame itself is `PublicShell`, not this file, because the root
 * `not-found.tsx` has to render the same header, footer and skin and cannot use
 * a route-group layout to get them. See the note in that component.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
