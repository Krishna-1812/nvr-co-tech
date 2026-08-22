/**
 * Money, for a screen an Indian finance team reads.
 *
 * Figures are stored in rupees, because that is what the sources publish and a
 * stored figure should be the figure that was filed. They are read in crore,
 * because that is how every annual report, broker note and board pack in the
 * country states a company's revenue, and a comparables schedule in bare rupees
 * is fourteen digits of nothing anybody can compare at a glance.
 *
 * So this is a display boundary and it rounds. The engine never does — see the
 * note at the top of multiples.ts on why a rounded multiple multiplied by a
 * revenue moves the answer by real money.
 */

import { isKnown } from './multiples';
import type { Figure } from './types';

const CRORE = 10_000_000;
const LAKH = 100_000;

/**
 * A figure in crore, with the unit.
 *
 * One decimal below a hundred crore and none above it, which is how the number
 * would be written by hand: ₹43.2 Cr reads as a precise small company, ₹2,100 Cr
 * as a large one, and ₹2,100.4 Cr as a spreadsheet nobody formatted.
 *
 * An absent figure is an em dash. Never a zero and never "N/A" — the dash is what
 * an accountant writes in a column where there is nothing, and it reads as
 * absence rather than as a value. A real zero prints as ₹0.0 Cr, which is a
 * different statement and has to look different.
 */
export function crore(figure: Figure, { symbol = true }: { symbol?: boolean } = {}): string {
  if (!isKnown(figure)) return '—';

  const value = figure / CRORE;
  const magnitude = Math.abs(value);
  const digits = magnitude >= 100 ? 0 : 1;
  const body = Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

  return `${value < 0 ? '-' : ''}${symbol ? '₹' : ''}${body} Cr`;
}

/**
 * The same figure in lakh, for anything too small to read in crore.
 *
 * Used where a subject is genuinely small — a company with ₹3.8 crore of revenue
 * is a real client for this audience, and ₹0.4 Cr on a schedule is worse than
 * ₹38.0 L.
 */
export function lakh(figure: Figure): string {
  if (!isKnown(figure)) return '—';
  const value = figure / LAKH;
  return `${value < 0 ? '-' : ''}₹${Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} L`;
}

/**
 * Crore or lakh, whichever the figure deserves.
 *
 * The threshold is one crore. Below it, crore would print two leading zeros and
 * a decimal that carries the whole meaning.
 */
export function money(figure: Figure): string {
  if (!isKnown(figure)) return '—';
  return Math.abs(figure) < CRORE ? lakh(figure) : crore(figure);
}

/**
 * How far apart two values are, as a signed percentage of the first.
 *
 * On this screen it answers one question and it is the most useful one there:
 * when the subject is itself listed, the peers imply a value and the market has
 * already stated one, so the gap between them is a live check on the whole
 * method. A peer set that implies a number 8% off the market's is working. One
 * that implies half is telling you the peer set is wrong, before a client does.
 */
export function gapPercent(from: Figure, to: Figure): Figure {
  if (!isKnown(from) || !isKnown(to) || from === 0) return null;
  return (to - from) / Math.abs(from);
}

/** A signed percentage, one decimal. Absent renders as a dash. */
export function percent(figure: Figure): string {
  if (!isKnown(figure)) return '—';
  const pct = figure * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

/**
 * A count with its noun, singular where it should be.
 *
 * "1 peers" on a screen for chartered accountants is the sort of thing that
 * makes a reader wonder what else was not checked.
 */
export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * How much of the set a statistic was computed from.
 *
 * Rendered next to every median on the screen, because "6.1×" alone is not a
 * usable statement and "6.1× across 4 of 11 peers" is. `spreadOf` counts the
 * missing for exactly this sentence.
 */
export function coverage(n: number, missing: number): string {
  const total = n + missing;
  if (total === 0) return 'no peers';
  if (missing === 0) return `all ${count(total, 'peer')}`;
  return `${n} of ${total} peers`;
}

/** A `yyyy-mm-dd` date as `31 Mar 2026`. Empty string for nothing. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('T')[0].split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(m) - 1];
  return month ? `${Number(d)} ${month} ${y}` : iso;
}
