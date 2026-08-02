/**
 * Route constants shared between the proxy, the auth screens and the OAuth
 * callback. They all have to agree on where signing in lands you, and `/` is
 * no longer that place — it is the marketing home page.
 */

/** Where signing in goes when there is nothing specific to return to. */
export const AFTER_LOGIN = '/dashboard';

/** The signed-in application. Everything not under one of these is public. */
export const PROTECTED_PREFIXES = [
  '/dashboard',
  '/vouchers',
  '/approvals',
  '/admin',
  '/settings',
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
