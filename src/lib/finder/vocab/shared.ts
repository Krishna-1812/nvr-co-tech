/**
 * What the two vocabulary modules have to agree about.
 *
 * `industries` holds Apollo's industry taxonomy; `codes` holds NAICS, SIC,
 * technologies and places. Neither depends on the other's data and neither
 * should. But one picker widget renders both, so the entry shape, the cap and
 * the notion of when two strings are the same string are not each module's
 * private business: they are the contract between them.
 *
 * ── A deliberate departure from the source ─────────────────────────────────
 *
 * The Python this is ported from writes `norm` and `PICKER_LIMIT` out twice, and
 * pins the two copies together with a test. That is the right call in a codebase
 * where the alternative is one module importing the other and dragging its
 * vocabulary along. Here a third module can hold just the contract, so the
 * copies are unnecessary and the test that guards them would be guarding
 * nothing. The independence the duplication was protecting is preserved: this
 * file contains no vocabulary at all.
 */

/**
 * Lowercased, with "&" read as "and" and all other punctuation and spacing
 * removed.
 *
 * So "Hospital & Health Care" and "hospital and health care" compare equal, and
 * so do "WordPress.org", "wordpress org" and "wordpress_org". Apollo is not
 * consistent about any of those spellings and neither is anybody typing into a
 * box, so comparing the raw strings answers "is this the same value" wrongly in
 * both directions.
 *
 * A slash is removed rather than read as "and", so "hospital/health care" does
 * NOT collapse onto "hospital & health care". That asymmetry is inherited from
 * the source and kept deliberately: Apollo's taxonomy uses slashes and
 * ampersands for different things ("airlines/aviation" is one industry, not two
 * joined), and no value in it is spelled both ways, so there is no pair this
 * could wrongly separate. Written down because the shape of the function invites
 * the assumption that it would.
 */
export function norm(s: string | null | undefined): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

/** One row in a picker, whichever vocabulary produced it. */
export type PickerEntry = {
  /** What gets sent as the filter value. */
  value: string;
  /** Which vocabulary this came from: a family, an industry, naics, sic, ... */
  kind: string;
  /**
   * This exact string has been seen on a real Apollo record.
   *
   * The picker says so, because a seeded value nobody has ever seen returned is
   * a guess this file made, and a value Apollo really uses is not.
   */
  confirmed: boolean;
  /** For an industry family, the Apollo values selecting it actually selects. */
  covers: readonly string[];
  /** A code's official title. Empty for the vocabularies that have none. */
  note?: string;
};

/**
 * Filled in by `suggest` when a caller passes one.
 *
 * The same out-parameter shape the Apollo client uses for pagination totals, and
 * for the same reason: a caller that shows a capped list must be able to say it
 * is capped, rather than presenting the first N as though they were the whole
 * vocabulary.
 */
export type PickerMeta = { total: number; truncated: boolean };

/**
 * How many entries one picker request may return.
 *
 * It was 40 once, which was below the size of every vocabulary in the tool, so
 * the picker was an alphabetical dead end rather than a list. Opening the
 * industry picker and scrolling to the bottom reached "executive office" and
 * nothing after it: families sort above industries, so those first 40 entries
 * were 21 families and only 19 industries, and 128 of Apollo's 147 industries
 * could not be browsed to at all. The location list stopped at "Czech Republic",
 * hiding 163 of 204 places.
 *
 * This sits above every seed vocabulary, so browsing now reaches the real end of
 * the list. `meta` still reports a cap that is hit, because learned values can
 * push a vocabulary past it.
 */
export const PICKER_LIMIT = 300;
