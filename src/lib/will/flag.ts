import { LAW } from './law';

/**
 * Whether the Will Maker may be seen, and by whom.
 *
 * It is built and deployed ahead of its legal review (docs/will-maker/02-plan.md,
 * Phase 5), so until an advocate has signed the rules off it is visible to the
 * platform's admins only. Everybody else gets the site's ordinary not-found
 * page: the route does not announce itself, and it is in no menu, card, sitemap
 * or roster either.
 *
 * Opening it to the public takes **two** things, and neither is enough alone:
 *
 *   1. `LAW.advocateSignOff` is filled in (lib/will/law). A flag cannot stand
 *      in for a lawyer's signature, so `NEXT_PUBLIC_WILL_MAKER=1` on its own
 *      changes nothing for the public while the sign-off is null.
 *   2. `NEXT_PUBLIC_WILL_MAKER=1`, so launch is a decision somebody takes on
 *      the day, not a side effect of merging a sign-off.
 *
 * `willMakerPublic` is read where the roster, the sitemap, the hub and the
 * guide page decide whether to exist at all, so before launch there is nothing
 * on the public site that mentions the tool.
 */
export function willMakerPublic(): boolean {
  return process.env.NEXT_PUBLIC_WILL_MAKER === '1' && LAW.advocateSignOff !== null;
}

export function willMakerOpen(admin: boolean): boolean {
  return admin || willMakerPublic();
}
