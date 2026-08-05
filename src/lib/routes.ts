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
 * straight on the voucher dashboard made the whole of Finance Intelligence look like
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
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
