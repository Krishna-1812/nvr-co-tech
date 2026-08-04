/**
 * How a person is turned into a picture, when there is no picture.
 *
 * Both of these were written inline in two components and are the sort of thing
 * that quietly diverges: the account menu showed two letters, the settings card
 * showed two letters, and nothing said they had to agree.
 */

/**
 * Up to two initials from a name, or from an email address when there is no name.
 *
 * Splits on spaces, at-signs and dots so that `krishna.ladha18@gmail.com` gives KL
 * rather than K. Falls back to a question mark, which is what an account with an
 * unusable name should look like rather than an empty tile.
 */
export function initialsFrom(name: string | null | undefined, email: string): string {
  return (
    (name ?? email)
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join('') || '?'
  );
}

/**
 * Whether a stored or claimed picture URL may be rendered.
 *
 * One definition, enforced in two places: where the URL is read off the session,
 * and inside Avatar itself, which is what every other call site goes through.
 *
 * The rule is worth stating even though the database only ever writes values it
 * read from the identity provider. This string reaches an `src` attribute in other
 * people's browsers, so the difference between "we believe it is https" and "we
 * checked" is the difference between a profile picture and an arbitrary outbound
 * request from every colleague who opens the audit trail.
 */
export function safeAvatarUrl(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('https://') ? value : null;
}

/**
 * Ask Google for the size we are actually going to draw.
 *
 * Their avatar URLs carry the size in a `=s96-c` suffix and will serve any square
 * size from the same URL, so a 32px avatar need not download a 400px photograph.
 *
 * Left alone for any other host: this trick is Google's, and guessing at somebody
 * else's URL scheme would break the image rather than shrink it. Left alone too
 * when the URL already carries some other `=` parameter we do not understand,
 * since appending a second one is how you get a 404.
 */
export function avatarAtSize(url: string, px: number): string {
  if (!/^https:\/\/lh\d+\.googleusercontent\.com\//.test(url)) return url;
  if (/=s\d+(-c)?$/.test(url)) return url.replace(/=s\d+(-c)?$/, `=s${px}-c`);
  return url.includes('=') ? url : `${url}=s${px}-c`;
}
