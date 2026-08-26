/**
 * Route constants shared between the proxy, the auth screens and the OAuth
 * callback. They all have to agree on where signing in lands you, and `/` is
 * no longer that place — it is the marketing home page.
 */

/**
 * Where signing in goes when there is nothing specific to return to.
 *
 * The hub, not the voucher dashboard. Signing in gets you into the platform, and
 * the platform is a growing set of tools of which Voucher Desk is one. Landing
 * straight on the voucher dashboard made the whole of The Finance Intelligence look like
 * one application with an odd marketing site attached.
 */
export const AFTER_LOGIN = '/hub';

/** The signed-in application. Everything not under one of these is public. */
export const PROTECTED_PREFIXES = [
  '/hub',
  '/dashboard',
  '/vouchers',
  '/approvals',
  '/admin',
  '/settings',
  '/reconcile',
  '/ask',
  // Valuation Desk. Reads the shared company registry, which every signed-in
  // person may read and none may write — see migration 0028.
  '/comps',
  // Signed in, but not yet a member of an organization — see requireOrgMember().
  '/onboarding',
  // Visitor intelligence. Gated a second time inside its own layout against the
  // analytics allowlist, which is a different and much shorter list than
  // "anybody with a session" — see lib/analytics/admin.
  '/analytics',
  // Contact Finder. Gated against the same allowlist and for a sharper reason:
  // a search here can spend from the platform's own credit pool, so a session
  // alone is not enough — see lib/analytics/admin and the note on FINDER_SLUG.
  '/contacts',
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
