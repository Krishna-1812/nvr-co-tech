/**
 * The distribution of a multiple across a peer set.
 *
 * ── The quartile method, and why it is worth naming ───────────────────────
 *
 * There is no single definition of a quartile. The nine methods in the
 * statistical literature disagree, and on a peer set of nine companies they can
 * disagree by a lot: for a small sample, the difference between the
 * interpolating and the nearest-rank conventions can move Q1 by a tenth of the
 * range. So the method has to be a decision rather than whatever the first
 * implementation happened to do, and it has to be written down where somebody
 * arguing about the number will find it.
 *
 * This uses **linear interpolation between closest ranks** — rank `(n−1)·p`,
 * interpolated between the two neighbouring order statistics. That is Excel's
 * `QUARTILE.INC` and numpy's default `linear`. The reason is not that it is the
 * best estimator, because for a sample of nine none of them is: it is that the
 * audience is chartered accountants who will rebuild the schedule in Excel to
 * check it, and a tool whose median matches theirs to the fourth decimal is
 * trusted while one that differs in the second is argued with for an hour.
 *
 * The median is the 50th percentile by the same formula, so it agrees with the
 * quartiles by construction rather than by coincidence.
 *
 * ── Why the median leads and the mean is only reported ────────────────────
 *
 * Valuation practice takes the median of a comparables set, and for once the
 * convention is right for a reason rather than by habit: a peer set is nine to
 * fifteen companies, and one of them trading at 40× because it is being acquired
 * moves the mean by a third and the median not at all. The mean is computed and
 * shown anyway, because the gap between mean and median is itself a signal — when
 * they are far apart, something in the set is pulling.
 *
 * ── Why outliers are flagged and never removed ────────────────────────────
 *
 * `outliers` reports what sits beyond the 1.5 × IQR fence and the engine keeps
 * every one of them in `n`, in the median and in the quartiles. Automatic
 * removal is refused, deliberately: the peer trading at 40× may be the most
 * informative company in the set — it may be the one that just transacted, at a
 * price a buyer actually paid — and a tool that had quietly dropped it would have
 * hidden the single most relevant data point while presenting a tidier number.
 * Excluding a peer is a judgement, judgements are recorded on
 * `peer_set_members` with a reason, and this file does not get to make them.
 */

import { isKnown } from './multiples';
import type { Figure, Spread } from './types';

/** An empty spread. What a multiple nobody in the set had looks like. */
function empty(missing: number): Spread {
  return {
    n: 0,
    missing,
    min: null,
    q1: null,
    median: null,
    q3: null,
    max: null,
    mean: null,
    outliers: [],
  };
}

/**
 * The p-th percentile of an already-sorted ascending array, by linear
 * interpolation between closest ranks.
 *
 * `p` is a fraction: 0.25, 0.5, 0.75. A single-element array returns that
 * element for every p, which is correct and worth stating — it means a peer set
 * of one reports a median equal to its only member, and `n: 1` beside it is what
 * tells the reader not to lean on it.
 */
export function percentileSorted(sorted: readonly number[], p: number): Figure {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];

  const rank = (sorted.length - 1) * p;
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];

  return sorted[lo] + (rank - lo) * (sorted[hi] - sorted[lo]);
}

/** The p-th percentile of an unsorted array. Sorts a copy; the input is untouched. */
export function percentile(values: readonly number[], p: number): Figure {
  return percentileSorted([...values].sort((a, b) => a - b), p);
}

/** The median. The 50th percentile, by the same formula as the quartiles. */
export function median(values: readonly number[]): Figure {
  return percentile(values, 0.5);
}

/**
 * The distribution of one figure across a set of rows.
 *
 * `pick` pulls the figure out of each row, and rows where it comes back null are
 * counted in `missing` rather than skipped silently. That count is the honest
 * half of every median this tool prints: "6.1× across four of eleven peers" is a
 * usable statement and "6.1×" on its own is not.
 */
export function spreadOf<T>(rows: readonly T[], pick: (row: T) => Figure): Spread {
  const values: number[] = [];
  let missing = 0;

  for (const row of rows) {
    const value = pick(row);
    if (isKnown(value)) values.push(value);
    else missing += 1;
  }

  if (values.length === 0) return empty(missing);

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentileSorted(sorted, 0.25);
  const q3 = percentileSorted(sorted, 0.75);

  return {
    n: sorted.length,
    missing,
    min: sorted[0],
    q1,
    median: percentileSorted(sorted, 0.5),
    q3,
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((sum, v) => sum + v, 0) / sorted.length,
    outliers: outliersOf(sorted, q1, q3),
  };
}

/**
 * Values beyond the 1.5 × IQR fence, in ascending order.
 *
 * Tukey's fence, because it is the one a reader is most likely to recognise and
 * because it needs no assumption about the shape of the distribution — which
 * matters, since a set of nine multiples is not normally distributed and nobody
 * should pretend to know what it is.
 *
 * An IQR of zero returns nothing rather than flagging every value that differs
 * from the middle at all. That happens when most of the set sits at the same
 * multiple, and in that situation the fence has collapsed to a point and stops
 * being a measure of anything.
 */
export function outliersOf(sorted: readonly number[], q1: Figure, q3: Figure): number[] {
  if (!isKnown(q1) || !isKnown(q3)) return [];
  const iqr = q3 - q1;
  if (iqr <= 0) return [];

  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  return sorted.filter((v) => v < low || v > high);
}

/**
 * How far apart the highest and lowest values are, as a ratio.
 *
 * The single most useful number on a reconciliation screen. A reader who sees 8×
 * knows not to lean on the weighted average however carefully it was weighted,
 * and no amount of methodology in the surrounding prose changes that.
 *
 * Null unless the low is strictly positive, since a ratio against zero or a
 * negative says nothing.
 */
export function dispersionOf(low: Figure, high: Figure): Figure {
  if (!isKnown(low) || !isKnown(high) || low <= 0) return null;
  return high / low;
}

/**
 * Pick the statistic a method should use out of a spread.
 *
 * Exists so `conclude.ts` can be handed a name rather than a number and the
 * choice survives into the stored working, where a reviewer can see that the
 * conclusion used the median rather than the upper quartile.
 */
export function statisticOf(spread: Spread, statistic: 'median' | 'mean' | 'q1' | 'q3'): Figure {
  switch (statistic) {
    case 'median':
      return spread.median;
    case 'mean':
      return spread.mean;
    case 'q1':
      return spread.q1;
    case 'q3':
      return spread.q3;
  }
}
