import type { Statistic } from './types';

/**
 * The four peer statistics, with their labels.
 *
 * A plain module, not part of `DeskControls`, on purpose: the server component
 * that renders the desk reads this list to validate the `?stat=` param, and a
 * server component cannot import a value from a `'use client'` file — across that
 * boundary an array comes back as a client-reference proxy, and `STATISTICS.find`
 * is then "not a function" at request time (a failure `tsc` and the build both
 * pass clean, because it only exists once the module graph is split for the
 * browser). Living here, it is the same array on both sides.
 *
 * `short` is the segmented-control label ("Q1"); `label` is the full name for the
 * accessible title and tooltip.
 */
export const STATISTICS: { value: Statistic; label: string; short: string }[] = [
  { value: 'median', label: 'Median', short: 'Median' },
  { value: 'mean', label: 'Mean', short: 'Mean' },
  { value: 'q1', label: 'Lower quartile', short: 'Q1' },
  { value: 'q3', label: 'Upper quartile', short: 'Q3' },
];
