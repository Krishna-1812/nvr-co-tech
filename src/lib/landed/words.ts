import type { RentalYield } from './calc';

/**
 * What True Property Cost says in words, written once.
 *
 * The screen, the PDF and the workbook each used to carry their own copy of the
 * method, the yield's verdict and the after-OC caution, and the printed copies
 * had already been shortened: the PDF's method left out how compounding works
 * and what "true cost" and "cash cost" mean, and the verdict on the screen —
 * the sentence that actually answers whether the flat pays — was not printed at
 * all. A reader handed the file got less than a reader looking at the screen.
 * Kept here, every surface prints the same sentences.
 */

const pct = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;

/** Whether the rent covers what the money costs, as the screen says it. */
export function rentVerdict(y: RentalYield): { covers: boolean; text: string } {
  const covers = y.spread >= 0;
  return {
    covers,
    text: covers
      ? `The rent covers the money, with ${pct(y.spread)} a year to spare.`
      : `The rent falls ${pct(-y.spread)} a year short of what the money costs. It pays only if the property gains in value.`,
  };
}

/** The caution under the working when payments fall on or after the OC date. */
export function afterOcNote(count: number): string {
  return `${count === 1 ? 'One payment falls' : `${count} payments fall`} on or after the OC date, so ${
    count === 1 ? 'it carries' : 'they carry'
  } no cost of funds. Check the date if that is not what happened.`;
}

/** The method and its limits. */
export const METHOD = {
  formula: 'Amount × rate a year × days to possession ÷ 365',
  rules: [
    'Days run from the day after a payment up to and including the OC date. A payment made on the OC date, or after it, carries nothing.',
    'Own funds are charged at the return they gave up. Borrowed funds at the loan rate. One rate per source, for every payment from it.',
    'Compounding, when chosen, applies the same days and rate yearly, quarterly or monthly.',
  ],
  meanings: [
    ['True cost', 'everything paid, plus the loan interest, plus the return own funds gave up.'],
    ['Cash cost', 'everything paid, plus the loan interest. What actually left the account.'],
    ['Net yield', 'rent after vacancy, maintenance and other costs, on the true cost.'],
  ] as const,
  notModelled:
    'EMI repayments during construction, since the borrowed principal is treated as outstanding until possession. Changes in rates. Tax on rent, and tax benefits on home-loan interest. Appreciation and rent escalation.',
  yieldBasis: 'Pre-tax. No appreciation, no rent escalation, and no tax benefit on the loan interest.',
} as const;
