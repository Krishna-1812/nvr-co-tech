/**
 * Reading and writing money.
 *
 * Ledger exports are written for people, not for parsers. The same figure turns
 * up as `10,00,000`, `1,000,000`, `₹10,00,000.50`, `(2,000)`, `15000 Cr` and a
 * bare dash meaning nothing, sometimes in the same file. All of it has to become
 * a number, and a number that cannot be read has to say so rather than silently
 * become zero — a swallowed amount is a difference nobody will ever find.
 */

/** Currency symbols, grouping separators and stray whitespace. */
const NOISE = /[₹$£€,\s]/g;

/** A cell holding only a dash. Ledgers use it for "nothing here". */
const DASH_ONLY = /^[-–—]+$/;

/** A trailing or leading Dr / Cr marker on a figure. */
const DRCR = /\b(dr|cr)\b/i;

export class AmountError extends Error {
  constructor(value: unknown) {
    super(`Not a number: ${JSON.stringify(value)}`);
    this.name = 'AmountError';
  }
}

/**
 * Parse a human-written amount.
 *
 * Blank, null and dash placeholders are zero. Parentheses negate, which is the
 * accountancy convention and not something JavaScript would guess. Anything else
 * that is not a number throws, so the caller can drop one malformed row rather
 * than treat it as a zero-value transaction that then fails to match.
 */
export function parseAmount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const text = String(value).trim();
  if (text === '' || DASH_ONLY.test(text)) return 0;

  let body = text;
  let negative = false;
  if (body.startsWith('(') && body.endsWith(')')) {
    negative = true;
    body = body.slice(1, -1);
  }

  const cleaned = body.replace(NOISE, '');
  if (cleaned === '' || cleaned === '-') return 0;

  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) throw new AmountError(value);

  return negative ? -amount : amount;
}

/**
 * The signed value of one amount cell, debit-positive.
 *
 * A Dr / Cr marker written on the figure wins over the column it landed in. That
 * is not defensive coding: Tally prints a closing balance in the *balancing*
 * column, so a credit closing arrives sitting in the Debit column with "Cr"
 * beside it, and believing the column would flip the sign of the whole ledger.
 */
export function signedAmountCell(text: string, isDebitColumn: boolean): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const marker = DRCR.exec(trimmed);
  const value = parseAmount(stripDrCr(trimmed));

  if (marker) return marker[1].toLowerCase() === 'cr' ? -Math.abs(value) : Math.abs(value);
  return isDebitColumn ? value : -value;
}

/**
 * The debit and credit magnitudes from a row's two amount cells.
 *
 * Returns magnitudes rather than a signed total because a transaction records
 * which side it is on, and "50,000 debit" and "-50,000 credit" are the same
 * number but not the same fact.
 */
export function amountsFromCells(debitText: string, creditText: string): {
  debit: number;
  credit: number;
} {
  let debit = 0;
  let credit = 0;

  for (const [text, isDebitColumn] of [
    [debitText, true],
    [creditText, false],
  ] as const) {
    const trimmed = text.trim();
    if (!trimmed) continue;

    const marker = DRCR.exec(trimmed);
    const amount = Math.abs(parseAmount(stripDrCr(trimmed)));
    if (!amount) continue;

    const isCredit = marker ? marker[1].toLowerCase() === 'cr' : !isDebitColumn;
    if (isCredit) credit += amount;
    else debit += amount;
  }

  return { debit, credit };
}

/** Remove a Dr / Cr marker, leaving the figure. */
export function stripDrCr(text: string): string {
  return text.replace(DRCR, '').trim();
}

/** Whether a cell carries an explicit Cr marker. */
export function hasCreditMarker(text: string): boolean {
  const m = DRCR.exec(text);
  return m ? m[1].toLowerCase() === 'cr' : false;
}

/**
 * Rupees in the Indian numbering system: ₹10,05,000.00.
 *
 * `en-IN` groups by lakh and crore natively, which is the only reason this is
 * three lines rather than the digit-pairing loop it replaced. Always two decimal
 * places, because a column of figures where some have paise and some do not is
 * unreadable, and this is a column of figures.
 */
const INR = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number, { symbol = true }: { symbol?: boolean } = {}): string {
  // -0 formats as "-0.00", which reads as a real negative on a balance line.
  const value = Object.is(amount, -0) ? 0 : amount;
  const sign = value < 0 ? '-' : '';
  const body = INR.format(Math.abs(value));
  return `${sign}${symbol ? '₹' : ''}${body}`;
}

/** The same figure without decimals, for headline numbers that need no paise. */
export function formatINRShort(amount: number): string {
  const value = Math.round(Math.abs(amount));
  const sign = amount < 0 ? '-' : '';
  return `${sign}₹${new Intl.NumberFormat('en-IN').format(value)}`;
}
