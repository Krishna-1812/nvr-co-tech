/**
 * The one credential Contact Finder cannot work without.
 *
 * Read at call time rather than captured in a module constant, so a key added to
 * the environment takes effect on the next request instead of on the next
 * deploy. Every other secret in this app is read the same way for the same
 * reason.
 *
 * ── Why this is not imported from analytics/enrich/paid ────────────────────
 *
 * It is literally the same key. But `paid.ts` is built around being unreachable
 * by accident — a paid lookup there happens because one person deliberately
 * clicked one button about one account, and that guarantee is kept by there
 * being almost no import edges running toward the module. Adding one from a tool
 * that searches in pages would weaken exactly the property that file exists to
 * have, in exchange for saving a single `process.env` read. So the env var's
 * name is written down twice on purpose, and this comment is the link between
 * the two copies.
 */

/** The key itself, or null when this environment has none. */
export function apolloKey(): string | null {
  const key = process.env.APOLLO_API_KEY?.trim();
  return key ? key : null;
}

export function apolloConfigured(): boolean {
  return apolloKey() !== null;
}

/**
 * What every surface says when the key is missing.
 *
 * One sentence, written once, because the alternative is five slightly different
 * versions of it and a reader who cannot tell whether they are looking at five
 * problems or one. It names the cause rather than the symptom: "no results" is
 * what an unconfigured environment looks like from the outside, and reporting a
 * missing credential as an empty result set is the single failure this whole
 * tool is built not to commit.
 */
export const APOLLO_NOT_CONFIGURED =
  'Apollo is not configured on this environment, so nothing was searched. This is a missing credential, not an empty result.';
