/**
 * Turning what a ledger wrote into something two ledgers can be compared on.
 *
 * The same payment is described differently in each book by definition — one
 * side says "To Sales", the other says "By Purchases" — so nothing here tries to
 * understand a narration. It only removes the differences that are certainly
 * meaningless: casing, spacing, and the punctuation people put in cheque
 * numbers.
 */

/** Lower-case, trimmed, internal whitespace collapsed. */
export function normaliseParticular(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * A reference reduced to what is actually identifying.
 *
 * "CHQ #000123", "chq-123" and "123" are one cheque. Everything that is not a
 * letter or a digit goes, then the padding zeros, which exist only because
 * somebody formatted a column to six places.
 *
 * The zeros are stripped in two positions, not one: at the front of the string,
 * and directly after a letter prefix. Only doing the first leaves "CHQ #000123"
 * as `chq000123` and "chq-123" as `chq123`, so the two never match — which is
 * the whole thing this function exists to prevent.
 *
 * A blank reference normalises to the empty string and the matcher never keys on
 * it, or every line without a cheque number would match every other one.
 */
export function normaliseReference(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^0+(?=\d)/, '')
    .replace(/([a-z])0+(?=\d)/g, '$1');
}

export type DifferenceClass = 'None' | 'Rounding' | 'Decimal' | 'Proportion' | 'Other';

/**
 * A guess at why two amounts differ, which is the first question anybody asks.
 *
 * Rounding and a misplaced decimal point are the two mistakes that actually
 * happen when a figure is keyed twice, and they need completely different
 * follow-up: one is noise to write off, the other is a wrong entry. Naming which
 * it looks like turns "these do not agree" into somewhere to start.
 *
 * A guess, and labelled as one in the UI. Nothing downstream branches on it.
 */
export function classifyAmountDifference(a: number, b: number): DifferenceClass {
  const gap = Math.abs(a - b);
  if (gap < 0.01) return 'None';
  if (gap < 1) return 'Rounding';

  const [smaller, larger] = [Math.abs(a), Math.abs(b)].sort((x, y) => x - y);
  if (smaller > 0) {
    const ratio = larger / smaller;
    const log10 = Math.log10(ratio);
    // A clean power of ten: 100 against 1,000, 50 against 5,000.
    if (Math.abs(log10 - Math.round(log10)) < 1e-6 && Math.round(log10) >= 1) return 'Decimal';
    // A whole multiple: two units billed where one was paid.
    if (Math.abs(ratio - Math.round(ratio)) < 1e-6 && Math.round(ratio) >= 2) return 'Proportion';
  }
  return 'Other';
}
