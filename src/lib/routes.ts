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

/**
 * The few screens that only make sense with an account. Everything else is
 * public — including, since 18 October 2026, the whole workspace.
 *
 * The workspace used to sit behind this list in full. It is open now (see
 * lib/access): a visitor can walk into /hub, use True Property Cost and Wealth
 * Tracker without an account, and open any of the four locked tools to see it
 * described and ask for it. Those locked tools decide for themselves, in their
 * layouts and again in every action and route behind them, and a visitor
 * reaching one is shown the tool rather than a sign-in screen, because signing
 * in would not open it.
 *
 * What is left is what an account is for.
 */
export const PROTECTED_PREFIXES = [
  // Your account.
  '/settings',
  // Ask. A conversation is kept against its owner (0009), and every answer
  // spends model credits, so it needs somebody to belong to.
  '/ask',
  // Signed in, setting up an organisation for Voucher Desk.
  '/onboarding',
  // Visitor intelligence. Gated a second time inside its own layout against the
  // analytics allowlist — see lib/analytics/admin.
  '/analytics',
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
