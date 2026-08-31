import { PublicShell } from '@/components/marketing/PublicShell';

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
