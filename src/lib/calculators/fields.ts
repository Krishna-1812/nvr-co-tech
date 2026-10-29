import {
  carpetAreaResult,
  evEbitdaResult,
  gstOnFlatResult,
  inr,
  num,
  preEmiResult,
  rentalYieldResult,
  type Result,
} from './math';

/**
 * What each calculator asks for, and the one function that answers it.
 *
 * Shared by the page (which works out the worked example on the server from the
 * defaults) and the calculator in the browser, so the figures a reader or a
 * crawler sees before typing anything are exactly the calculator's. The
 * defaults are each guide's own worked example wherever the guide has one, so
 * the calculator opens on numbers the guide explains line by line.
 *
 * Imports only math.ts: this ends up in the browser bundle.
 */

export type Kind = 'rental-yield' | 'carpet-area' | 'gst-flat' | 'pre-emi' | 'ev-ebitda';

export type Unit = 'inr' | 'pct' | 'sqft' | 'sqm' | 'months' | 'years' | 'crore' | 'times';

export type Field =
  | { id: string; label: string; kind: 'number'; unit: Unit; value: number; step?: number; hint?: string }
  | { id: string; label: string; kind: 'toggle'; value: boolean; hint?: string };

export type Values = Record<string, number | boolean>;

export const FIELDS: Record<Kind, readonly Field[]> = {
  'rental-yield': [
    { id: 'cost', label: 'What the property cost', kind: 'number', unit: 'inr', value: 60_00_000, step: 50_000, hint: 'For a flat bought off plan, its true cost at possession.' },
    { id: 'monthlyRent', label: 'Monthly rent', kind: 'number', unit: 'inr', value: 25_000, step: 500 },
    { id: 'maintenanceMonthly', label: 'Maintenance the owner pays, a month', kind: 'number', unit: 'inr', value: 3_000, step: 100 },
    { id: 'otherCostsYearly', label: 'Other owner costs a year', kind: 'number', unit: 'inr', value: 8_000, step: 500, hint: 'Property tax, insurance, repairs.' },
    { id: 'emptyMonths', label: 'Months empty a year', kind: 'number', unit: 'months', value: 1, step: 1 },
    { id: 'moneyRatePct', label: 'What the money costs a year', kind: 'number', unit: 'pct', value: 8.2, step: 0.1, hint: 'Your loan rate, or what your savings would earn. 0 to leave out.' },
  ],
  'carpet-area': [
    { id: 'superArea', label: 'Super built-up area', kind: 'number', unit: 'sqft', value: 1_000, step: 10 },
    { id: 'carpetArea', label: 'Carpet area', kind: 'number', unit: 'sqft', value: 700, step: 10, hint: 'As written in the agreement under RERA.' },
    { id: 'rate', label: 'Rate quoted per sq ft of super built-up', kind: 'number', unit: 'inr', value: 8_000, step: 100 },
  ],
  'gst-flat': [
    { id: 'price', label: 'Price charged by the builder', kind: 'number', unit: 'inr', value: 40_00_000, step: 50_000, hint: 'Before GST, stamp duty and registration.' },
    { id: 'carpetSqm', label: 'Carpet area', kind: 'number', unit: 'sqm', value: 62, step: 1, hint: 'One square metre is 10.7639 square feet.' },
    { id: 'metro', label: 'In a metropolitan area', kind: 'toggle', value: true, hint: 'Bengaluru, Chennai, Delhi NCR, Hyderabad, Kolkata or the Mumbai Metropolitan Region.' },
    { id: 'completed', label: 'Completion certificate issued before any payment', kind: 'toggle', value: false },
  ],
  'pre-emi': [
    { id: 'disbursed', label: 'Loan disbursed so far', kind: 'number', unit: 'inr', value: 18_00_000, step: 50_000 },
    { id: 'ratePct', label: 'Interest rate a year', kind: 'number', unit: 'pct', value: 8.5, step: 0.05 },
    { id: 'months', label: 'Months until possession', kind: 'number', unit: 'months', value: 24, step: 1 },
    { id: 'tenureYears', label: 'Loan term', kind: 'number', unit: 'years', value: 20, step: 1 },
  ],
  'ev-ebitda': [
    { id: 'marketCap', label: 'Market capitalisation', kind: 'number', unit: 'crore', value: 1_200, step: 10 },
    { id: 'debt', label: 'Debt', kind: 'number', unit: 'crore', value: 300, step: 10 },
    { id: 'cash', label: 'Cash', kind: 'number', unit: 'crore', value: 60, step: 5 },
    { id: 'ebit', label: 'Operating profit (EBIT)', kind: 'number', unit: 'crore', value: 110, step: 5 },
    { id: 'depreciation', label: 'Depreciation and amortisation', kind: 'number', unit: 'crore', value: 40, step: 5 },
    { id: 'peerMultiple', label: 'Peer median EV/EBITDA to value at', kind: 'number', unit: 'times', value: 11, step: 0.5, hint: '0 to leave the valuation out.' },
  ],
};

/** A field's opening figure, as a reader would say it: ₹40,00,000, 62 sq m, Yes. */
export function shownValue(f: Field): string {
  if (f.kind === 'toggle') return f.value ? 'Yes' : 'No';
  const v = f.value;
  switch (f.unit) {
    case 'inr':
      return inr(v);
    case 'crore':
      return `₹${num(v)} crore`;
    case 'pct':
      return `${v}%`;
    case 'sqft':
      return `${num(v)} sq ft`;
    case 'sqm':
      return `${num(v)} sq m`;
    case 'months':
      return `${v} ${v === 1 ? 'month' : 'months'}`;
    case 'years':
      return `${v} years`;
    case 'times':
      return `${v}x`;
  }
}

/** The calculator's opening values, by field id. */
export function defaults(kind: Kind): Values {
  return Object.fromEntries(FIELDS[kind].map((f) => [f.id, f.value]));
}

const n = (v: Values, id: string) => (typeof v[id] === 'number' ? (v[id] as number) : NaN);
const b = (v: Values, id: string) => v[id] === true;

/** Work a calculator out from its values. */
export function run(kind: Kind, v: Values): Result {
  switch (kind) {
    case 'rental-yield':
      return rentalYieldResult({
        cost: n(v, 'cost'),
        monthlyRent: n(v, 'monthlyRent'),
        maintenanceMonthly: n(v, 'maintenanceMonthly'),
        otherCostsYearly: n(v, 'otherCostsYearly'),
        emptyMonths: n(v, 'emptyMonths'),
        moneyRatePct: n(v, 'moneyRatePct'),
      });
    case 'carpet-area':
      return carpetAreaResult({ superArea: n(v, 'superArea'), carpetArea: n(v, 'carpetArea'), rate: n(v, 'rate') });
    case 'gst-flat':
      return gstOnFlatResult({ price: n(v, 'price'), carpetSqm: n(v, 'carpetSqm'), metro: b(v, 'metro'), completed: b(v, 'completed') });
    case 'pre-emi':
      return preEmiResult({ disbursed: n(v, 'disbursed'), ratePct: n(v, 'ratePct'), months: n(v, 'months'), tenureYears: n(v, 'tenureYears') });
    case 'ev-ebitda':
      return evEbitdaResult({
        marketCap: n(v, 'marketCap'),
        debt: n(v, 'debt'),
        cash: n(v, 'cash'),
        ebit: n(v, 'ebit'),
        depreciation: n(v, 'depreciation'),
        peerMultiple: n(v, 'peerMultiple'),
      });
  }
}
