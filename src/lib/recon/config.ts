/**
 * Every tunable the reconciliation engine has, in one place.
 *
 * The two tolerances are the reason this is a module rather than four literals
 * scattered through the matcher: "are these two amounts the same" is asked in
 * five places, and if two of them ever disagreed the statement would stop tying
 * out for reasons nobody could find.
 */

/** Two amounts within this are the same amount. One paisa. */
export const AMOUNT_TOLERANCE = 0.01;

/** A residual at or under this is a clean tie-out. */
export const VARIANCE_TOLERANCE = 0.01;

/**
 * Upload ceiling.
 *
 * Parsing happens in the browser, so this is not protecting a server — it is
 * protecting the tab. A 40 MB workbook read into an array of arrays will lock
 * the main thread for long enough to look like a crash, and telling somebody
 * their file is too big is better than letting them watch it hang.
 */
export const MAX_FILE_MB = 10;

/** Above this a ledger is refused rather than reconciled slowly. */
export const MAX_TRANSACTIONS = 10_000;

/** What the file input will accept, and what the parser can actually read. */
export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xlsm', '.csv', '.pdf'] as const;

/** Rounded to paise. Repeated addition of currency floats drifts otherwise. */
export function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Whether two amounts are equal within the engine's tolerance. */
export function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}
