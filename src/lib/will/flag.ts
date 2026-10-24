/**
 * Whether the Will Maker may be seen yet.
 *
 * It is built and deployed ahead of its legal review (docs/will-maker/02-plan.md,
 * Phase 5), so until `LAW.advocateSignOff` is filled in and the flag is turned
 * on, it is visible to the platform's admins only. Everybody else gets the
 * site's ordinary not-found page: the route does not announce itself, and it is
 * in no menu, card, sitemap or roster either.
 *
 * `NEXT_PUBLIC_WILL_MAKER=1` opens it to everybody. Do not set that before an
 * advocate has signed off.
 */
export function willMakerOpen(admin: boolean): boolean {
  return admin || process.env.NEXT_PUBLIC_WILL_MAKER === '1';
}
