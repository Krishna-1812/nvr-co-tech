/**
 * Giving a person a stable visual identity, without anybody assigning one.
 *
 * Every roster table, drawer header and profile modal in the analytics section
 * shows the same people, and they have to be recognisable across all of them —
 * the same person the same colour on every screen, different people visibly
 * different, and none of it stored or configured anywhere. So the colour is
 * derived: hash the one string that genuinely identifies them and index into a
 * fixed palette.
 *
 * The palette is the app's own eight accent tokens rather than a new set of
 * literals. They are already defined with `light-dark()`, so a hashed avatar
 * stays legible in both themes for free, which a hardcoded hex could not do.
 */

/** The eight accents, in a fixed order. Reordering this recolours every avatar. */
export const ACCENTS = [
  'var(--h-indigo)',
  'var(--h-violet)',
  'var(--h-cyan)',
  'var(--h-emerald)',
  'var(--h-amber)',
  'var(--h-rose)',
  'var(--h-lime)',
  'var(--h-magenta)',
] as const;

/**
 * FNV-1a, 32-bit.
 *
 * Chosen for being stable rather than for being good: this has to produce the
 * same colour in the browser, on the server and after any future refactor, so
 * what matters is that it is a few lines of arithmetic with no dependencies and
 * no platform-specific behaviour. It is not used for anything security-related.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    // The shifts are the standard 16777619 multiply, written to stay in int32.
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

/** The accent this identity always gets. Lowercased first, so case never splits one person in two. */
export function accentFor(identity: string): string {
  return ACCENTS[hash(identity.trim().toLowerCase()) % ACCENTS.length];
}

/**
 * Two letters, from whatever we actually have.
 *
 * Prefers a real name's initials, because that is what a person recognises.
 * Falls back to the email's local part, and only then to a bare pair of
 * characters — an avatar with something in it beats a blank circle even when
 * the something is not very meaningful.
 */
export function initialsFor(name: string | null | undefined, email: string): string {
  const clean = (name ?? '').trim();

  if (clean) {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return parts[0][0].toUpperCase();
  }

  const local = email.split('@')[0]?.replace(/[^a-zA-Z0-9]/g, '') ?? '';
  return (local.slice(0, 2) || '??').toUpperCase();
}

/** What to call somebody when the logs never captured a name. */
export const displayName = (name: string | null | undefined, email: string): string =>
  (name ?? '').trim() || email.split('@')[0] || email;

/**
 * Recently active, for the presence dot on an avatar.
 *
 * Forty-eight hours rather than something tighter: these dashboards are read
 * once a day at most, and a dot that means "active in the last five minutes"
 * would be dark for essentially everybody essentially always, which tells the
 * reader nothing. Two days is the window where "lit" genuinely distinguishes a
 * live account from a dormant one.
 */
export const ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isRecentlyActive(lastSeen: string | null | undefined, now = Date.now()): boolean {
  if (!lastSeen) return false;
  const at = new Date(lastSeen).getTime();
  return Number.isFinite(at) && now - at <= ACTIVE_WINDOW_MS;
}

/**
 * Free/personal mail domains.
 *
 * Used in two places that both matter: never claim somebody works at
 * "gmail.com", and never spend a paid company lookup on a domain that cannot
 * possibly resolve to an employer. Kept deliberately long rather than clever —
 * a missing entry here shows up as a wrong company name on a person's profile,
 * which is the most embarrassing thing these screens can do.
 */
export const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk', 'ymail.com',
  'rocketmail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'msn.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me', 'pm.me',
  'zoho.com', 'zohomail.com', 'gmx.com', 'gmx.de', 'mail.com', 'yandex.com', 'yandex.ru',
  'rediffmail.com', 'rediff.com', 'sify.com', 'indiatimes.com', 'fastmail.com',
  'hushmail.com', 'tutanota.com', 'tuta.io', 'mail.ru', 'inbox.com', 'email.com',
  'qq.com', '163.com', '126.com', 'naver.com', 'daum.net',
]);

/** The domain part, lowercased, or an empty string if this is not an address. */
export function domainOf(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).trim().toLowerCase();
}

/** Whether this address can stand in for an employer at all. */
export const isPersonalEmail = (email: string): boolean =>
  PERSONAL_EMAIL_DOMAINS.has(domainOf(email));

/**
 * The company a bare email address implies, or nothing.
 *
 * Deliberately returns null rather than the domain for personal addresses. The
 * calling screens then show "personal email" instead of a company, which is a
 * true statement, where "gmail.com" in a Company column is a false one.
 */
export function companyFromEmail(email: string): string | null {
  const domain = domainOf(email);
  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}
