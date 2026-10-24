/**
 * The advocate's written sign-off, and nothing else.
 *
 * Deliberately its own file, outside `REVIEWED_FILES` (review.ts): the sign-off
 * names a digest of the legal files, so it cannot live inside one of them, or
 * filling it in would change the digest it records. Only the owner edits this
 * file, from a written sign-off; see docs/will-maker/launch-runbook.md.
 *
 * `packet` is the digest printed at the top of docs/will-maker/legal-review.md:
 * a hash of the files that carry every legal sentence the product says. A test
 * recomputes it, so changing a rule, a clause or a sentence of guidance after
 * the sign-off turns the build red until the packet is regenerated and the
 * advocate has read the change. A sign-off that quietly outlives the text it
 * approved is worse than none.
 */
export type SignOff = {
  /** Name, enrolment number and firm, as the advocate wrote them. */
  by: string;
  /** ISO date of the written sign-off. */
  on: string;
  /** The packet digest the advocate signed. */
  packet: string;
};

/** Null means nobody has signed off, and the tool stays admin-only (lib/will/flag). */
export const SIGN_OFF: SignOff | null = null;
