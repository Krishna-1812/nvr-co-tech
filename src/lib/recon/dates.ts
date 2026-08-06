/**
 * Reading and writing ledger dates.
 *
 * Everything in the engine is a `yyyy-mm-dd` string. That is not laziness about
 * Date objects: a date in a ledger is a calendar day with no time and no
 * timezone, and the moment it becomes a Date it acquires both, which is how you
 * end up reconciling to 31 March in Kolkata and 30 March on the server. Strings
 * also compare correctly with `<=`, which is the only comparison timing needs.
 *
 * Day-first is assumed throughout, because these files are Indian ledger and
 * bank exports. `04/03/2026` is the fourth of March.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const SEP = '[\\s\\-/.,]+';
const MONTH_WORD = '[A-Za-z]{3,9}';

/** 2026-04-01, and the slash form some systems export. */
const ISO_RE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;
/** 01-Apr-2026, 1 Apr 26, 01-Apr — the year is optional. */
const DMY_WORD_RE = new RegExp(`(\\d{1,2})${SEP}(${MONTH_WORD})(?:${SEP}(\\d{2,4}))?`);
/** Apr-01-2026, "April 1, 2026", Apr 1. */
const MDY_WORD_RE = new RegExp(`(${MONTH_WORD})${SEP}(\\d{1,2})(?:${SEP}(\\d{2,4}))?`);
/** 01-04-2026, 01/04/2026, 01.04.2026 — day first. */
const DMY_NUM_RE = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/;

/** Pad and join, without going near a Date. */
function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Rejects 31 April and 29 February in a common year, rather than rolling them
  // silently into the next month the way Date.UTC would.
  const stamp = Date.UTC(year, month - 1, day);
  const check = new Date(stamp);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Two digits mean this century. A ledger is never from 1926. */
function fullYear(token: string | undefined, fallback: number): number {
  if (token === undefined) return fallback;
  const n = Number(token);
  return n < 100 ? 2000 + n : n;
}

/**
 * Parse a date out of a cell.
 *
 * `defaultYear` is what a bare `01-Apr` becomes. It comes from the ledger's own
 * opening date, so a file that prints its year once at the top and then omits it
 * on every line still reconciles to the right year.
 *
 * Returns null rather than guessing when nothing recognisable is there. The
 * validator turns that into a warning, and the engine treats an undated line as
 * posted, which is the safe reading: including it is visible in the balance,
 * quietly dropping it is not.
 */
export function parseLedgerDate(
  value: unknown,
  { defaultYear }: { defaultYear?: number | null } = {},
): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return iso(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const text = String(value).trim();
  if (!text) return null;

  const fallbackYear = defaultYear ?? new Date().getFullYear();

  const isoMatch = ISO_RE.exec(text);
  if (isoMatch) return iso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));

  const dmyWord = DMY_WORD_RE.exec(text);
  if (dmyWord) {
    const month = MONTHS[dmyWord[2].toLowerCase()];
    if (month) return iso(fullYear(dmyWord[3], fallbackYear), month, Number(dmyWord[1]));
  }

  const mdyWord = MDY_WORD_RE.exec(text);
  if (mdyWord) {
    const month = MONTHS[mdyWord[1].toLowerCase()];
    if (month) return iso(fullYear(mdyWord[3], fallbackYear), month, Number(mdyWord[2]));
  }

  const dmyNum = DMY_NUM_RE.exec(text);
  if (dmyNum) {
    const day = Number(dmyNum[1]);
    const month = Number(dmyNum[2]);
    const year = fullYear(dmyNum[3], fallbackYear);
    // Day-first, unless the first field cannot be a day and the second can. A
    // US-formatted export of 04/25/2026 would otherwise be thrown away entirely.
    if (day > 12 && month <= 12) return iso(year, month, day);
    if (month > 12 && day <= 12) return iso(year, day, month);
    return iso(year, month, day);
  }

  return null;
}

/** Whether a string is already a `yyyy-mm-dd` we produced. */
export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** `2026-04-30` → `30 Apr 2026`. What a statement actually prints. */
export function formatLedgerDate(value: string | null | undefined): string {
  if (!isIsoDate(value)) return '—';
  const [y, m, d] = value.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/** Shift a date by whole days. UTC arithmetic, so no hour can go missing. */
export function addDays(value: string, days: number): string {
  const [y, m, d] = value.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return iso(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate()) ?? value;
}

/** Whole days from `a` to `b`, negative when b is earlier. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** ISO strings sort as dates, which is the whole reason for the format. */
export function minDate(dates: (string | null | undefined)[]): string | null {
  const real = dates.filter(isIsoDate);
  return real.length ? real.reduce((lo, d) => (d < lo ? d : lo)) : null;
}

export function maxDate(dates: (string | null | undefined)[]): string | null {
  const real = dates.filter(isIsoDate);
  return real.length ? real.reduce((hi, d) => (d > hi ? d : hi)) : null;
}
