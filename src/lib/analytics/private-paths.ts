/**
 * Pages whose fields and buttons are never collected, by anyone, ever.
 *
 * The site-wide capture (lib/analytics/capture, migration 0036) reads what is
 * typed into any form field and the label of any button, anywhere, so the Admin
 * screen can show what people asked for. That is right for a contact form and
 * wrong for a will: a will, and the list of what somebody owns, is the most
 * sensitive thing the site is asked to hold, and the tool tells people it is
 * "not counted in our statistics". So nothing on these paths is read:
 *
 *   - the browser does not listen (capture.ts), including the dialogs, which
 *     are drawn outside the page's own markup and so cannot be fenced with
 *     `data-private`;
 *   - the server drops anything that claims to come from them (input.ts), so a
 *     stale or hand-made client cannot get it stored either.
 *
 * The page view itself (the path and the title, which are fixed) is still
 * counted: a number of visits says nothing about anybody.
 *
 * Shared by the browser and the server, so it is pure and has no imports.
 */
export const NEVER_CAPTURE: readonly string[] = ['/will-maker'];

/** Whether this path, or anything under it, is off limits. Case and a trailing slash do not matter. */
export function neverCaptured(path: string): boolean {
  const p = path.trim().toLowerCase().replace(/\/+$/, '') || '/';
  return NEVER_CAPTURE.some((n) => p === n || p.startsWith(`${n}/`));
}
