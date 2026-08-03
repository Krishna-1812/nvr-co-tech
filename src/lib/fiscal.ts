/**
 * Today, and where it sits in the financial year.
 *
 * Everything here goes through Asia/Kolkata explicitly rather than through the
 * server's local time. On Vercel the server runs in UTC, so between 18:30 and
 * midnight IST a naive `new Date()` is already on the previous day — which for an
 * app whose voucher numbers embed the financial year, and whose users file to
 * statutory dates, is the kind of quiet off-by-one that ends up in a return.
 */

/** Today in Asia/Kolkata as `yyyy-mm-dd`. en-CA is ISO order by definition. */
export function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** "Mon 3 Aug", for the top bar. */
export function istLongDate(): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date());
}

/**
 * The day and the hour in Kolkata, for a greeting that is right for the reader
 * rather than for whichever region the server happens to be in.
 *
 * `hour12: false` matters: with it on, en-GB renders midnight as "12 am" and the
 * hour parses to 12, which would greet somebody at one in the morning with "good
 * afternoon".
 */
export function istParts(): { weekday: string; hour: number; partOfDay: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 9);

  return {
    weekday,
    hour,
    partOfDay: hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening',
  };
}

export type Fiscal = {
  /** "26-27", matching the string inside a voucher number. */
  label: string;
  /** Percentage of the year elapsed, one decimal place. */
  progress: number;
  daysLeft: number;
};

/**
 * The Indian financial year: 1 April to 31 March.
 *
 * Takes a `yyyy-mm-dd` rather than a Date so the caller has already decided which
 * timezone "today" means, and so this is a pure function that can be reasoned
 * about without a clock.
 */
export function fiscalYear(ymd: string): Fiscal {
  const [y, m, d] = ymd.split('-').map(Number);
  const startYear = m >= 4 ? y : y - 1;

  // UTC arithmetic throughout: these are three points on the same calendar, and
  // a local-time midnight would put a DST-shifted hour between them.
  const start = Date.UTC(startYear, 3, 1);
  const end = Date.UTC(startYear + 1, 3, 1);
  const today = Date.UTC(y, m - 1, d);

  const span = end - start;
  const gone = Math.min(Math.max(today - start, 0), span);

  return {
    label: `${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`,
    progress: Math.round((gone / span) * 1000) / 10,
    daysLeft: Math.round((end - today) / 86_400_000),
  };
}
