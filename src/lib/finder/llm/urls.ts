/**
 * Cleaning a URL that came out of a model.
 *
 * A web-searching model appends its own tracking parameter to the sources it
 * cites, and that once travelled all the way into an answer's citation link. Two
 * things are wrong with that: it tags a colleague's click as vendor-referred
 * traffic in the destination's own analytics, and it is not what anybody would
 * paste if they were quoting the source by hand.
 */

/**
 * Only unambiguous tracking keys.
 *
 * `ref`, `source`, `via` and friends are deliberately absent: they carry real
 * routing meaning on some sites, and silently rewriting a URL into one that
 * serves different content would be a worse bug than the one being fixed.
 */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_name',
  'utm_reader',
  'utm_brand',
  'utm_social',
  'gclid',
  'gclsrc',
  'dclid',
  'fbclid',
  'msclkid',
  'twclid',
  'ttclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  '_hsenc',
  '_hsmi',
  'vero_id',
  'yclid',
]);

/**
 * One URL, with its tracking parameters removed and nothing else touched.
 *
 * Anything that is not a parseable http(s) URL comes back exactly as given: this
 * runs over model output, so it must never mangle a string that merely looked
 * URL-ish. A query that was ENTIRELY tracking loses its "?" too, rather than
 * being left with a bare trailing question mark.
 */
export function cleanUrl(url: string): string {
  const raw = String(url ?? '').trim();
  if (!raw) return raw;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return raw;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return raw;

  const keys = [...parsed.searchParams.keys()];
  const dirty = keys.filter((k) => TRACKING_PARAMS.has(k.toLowerCase()));
  // Nothing to strip means byte-identical output, rather than whatever
  // re-serialising happens to do to the ordering and the escaping.
  if (dirty.length === 0) return raw;

  for (const key of dirty) parsed.searchParams.delete(key);
  const query = parsed.searchParams.toString();
  return `${parsed.origin}${parsed.pathname}${query ? `?${query}` : ''}${parsed.hash}`;
}

/**
 * Stops at whitespace and at the characters that commonly BRACKET a URL in prose
 * rather than belong to it, so a citation inside parentheses or quotes does not
 * swallow the closing mark.
 */
const URL_IN_TEXT = /https?:\/\/[^\s<>"'`)\]}]+/g;

/**
 * Every URL in a block of prose, cleaned.
 *
 * Applied to finished answers, so a tracking parameter cannot reach a reader no
 * matter which step of the pipeline introduced it.
 */
export function stripTracking(text: string): string {
  return String(text ?? '').replace(URL_IN_TEXT, (match) => {
    // Trailing sentence punctuation is not part of the URL. Peeled off before
    // parsing and put back after, so a sentence keeps its full stop.
    let raw = match;
    let trail = '';
    while (raw && '.,;:!?'.includes(raw[raw.length - 1])) {
      trail = raw[raw.length - 1] + trail;
      raw = raw.slice(0, -1);
    }
    return cleanUrl(raw) + trail;
  });
}
