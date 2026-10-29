/**
 * The arithmetic behind the free calculators, and nothing else.
 *
 * Pure functions of plain numbers, so the page can work out its own worked
 * example on the server (the figures a crawler reads are the figures the
 * calculator shows before anybody touches it) and the browser can do the same
 * as the reader types. Each one follows the guide it belongs to, formula for
 * formula; math.test.ts checks every calculator against its guide's worked
 * example, so the two can never quietly disagree.
 *
 * A result is a list of labelled lines rather than a bag of numbers, because
 * the lines are what is shown, read aloud and quoted, and they are formatted
 * here once, in Indian digit grouping (₹3,00,000), rather than in each place.
 *
 * Keep this file free of imports: the calculator component bundles it.
 */

export type Line = {
  label: string;
  value: string;
  /** The line the calculator exists to answer. */
  strong?: boolean;
};

export type Result = {
  lines: Line[];
  /** One sentence on what the figures mean, or why there are none. */
  note?: string;
};

const NONE = '—';

const finite = (n: number) => Number.isFinite(n);
const positive = (n: number) => finite(n) && n > 0;
const atLeastZero = (n: number) => (finite(n) && n > 0 ? n : 0);

/** ₹ in Indian digit grouping, to the rupee. */
export function inr(n: number): string {
  if (!finite(n)) return NONE;
  const sign = n < 0 ? '−' : '';
  return `${sign}₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
}

/** A plain number in Indian digit grouping, to `digits` places. */
export function num(n: number, digits = 0): string {
  if (!finite(n)) return NONE;
  return n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** A ratio as a percentage, to two places: 0.05 → 5.00%. */
export function pct(ratio: number, digits = 2): string {
  return finite(ratio) ? `${(ratio * 100).toFixed(digits)}%` : NONE;
}

/** One square metre in square feet. */
export const SQFT_PER_SQM = 10.7639;

/* ── Rental yield ─────────────────────────────────────────────────────────── */

export type RentalInput = {
  /** What the property cost: the price, or for a flat bought off plan its true cost. */
  cost: number;
  monthlyRent: number;
  maintenanceMonthly: number;
  otherCostsYearly: number;
  /** Months a year it stands empty between tenants, 0 to 12. */
  emptyMonths: number;
  /** What the money in the property costs a year, in per cent. 0 leaves out the break-even rent. */
  moneyRatePct: number;
};

export function rentalYield(i: RentalInput) {
  const vacancy = Math.min(12, atLeastZero(i.emptyMonths)) / 12;
  const grossAnnual = atLeastZero(i.monthlyRent) * 12;
  const fixed = atLeastZero(i.maintenanceMonthly) * 12 + atLeastZero(i.otherCostsYearly);
  const netAnnual = grossAnnual * (1 - vacancy) - fixed;
  const cost = positive(i.cost) ? i.cost : NaN;
  const rate = atLeastZero(i.moneyRatePct) / 100;
  return {
    grossAnnual,
    netAnnual,
    grossYield: grossAnnual / cost,
    netYield: netAnnual / cost,
    // The rent at which the net yield equals what the money costs: below it,
    // the rent does not pay for the money in the property.
    breakEvenRent: rate > 0 && vacancy < 1 ? (rate * cost + fixed) / (12 * (1 - vacancy)) : NaN,
  };
}

export function rentalYieldResult(i: RentalInput): Result {
  const r = rentalYield(i);
  if (!positive(i.cost) || !positive(i.monthlyRent)) {
    return { lines: [], note: 'Enter what the property cost and the monthly rent.' };
  }
  const lines: Line[] = [
    { label: 'Rent for a full year', value: inr(r.grossAnnual) },
    { label: 'Net rent after empty months and owner costs', value: inr(r.netAnnual) },
    { label: 'Gross rental yield', value: pct(r.grossYield) },
    { label: 'Net rental yield', value: pct(r.netYield), strong: true },
  ];
  if (finite(r.breakEvenRent)) lines.push({ label: 'Monthly rent that would cover the money', value: inr(r.breakEvenRent) });
  const note =
    r.netAnnual <= 0
      ? 'The owner costs and the empty months take up all of the rent.'
      : finite(r.breakEvenRent)
        ? r.netYield * 100 >= atLeastZero(i.moneyRatePct)
          ? 'The rent covers what the money in the property costs.'
          : 'The rent covers less than the money in the property costs; the rest has to come from the property rising in value.'
        : undefined;
  return { lines, note };
}

/* ── Carpet area and loading ─────────────────────────────────────────────── */

export type CarpetInput = {
  /** Super built-up area, square feet. */
  superArea: number;
  /** Carpet area, square feet. */
  carpetArea: number;
  /** The rate quoted per square foot of super built-up area. */
  rate: number;
};

export function carpetArea(i: CarpetInput) {
  const superArea = positive(i.superArea) ? i.superArea : NaN;
  const carpet = positive(i.carpetArea) ? i.carpetArea : NaN;
  const price = superArea * atLeastZero(i.rate);
  return {
    price,
    /** As a share of the carpet area: super ÷ carpet − 1. */
    loadingOnCarpet: superArea / carpet - 1,
    /** As a share of the super built-up area: 1 − carpet ÷ super. */
    loadingOnSuper: 1 - carpet / superArea,
    perCarpetSqft: price / carpet,
    carpetSqm: carpet / SQFT_PER_SQM,
  };
}

export function carpetAreaResult(i: CarpetInput): Result {
  if (!positive(i.superArea) || !positive(i.carpetArea) || !positive(i.rate)) {
    return { lines: [], note: 'Enter both areas and the rate quoted.' };
  }
  if (i.carpetArea > i.superArea) {
    return { lines: [], note: 'The carpet area cannot be larger than the super built-up area. Check that the two are not the wrong way round.' };
  }
  const r = carpetArea(i);
  return {
    lines: [
      { label: 'Price', value: inr(r.price) },
      { label: 'Loading on the carpet area', value: pct(r.loadingOnCarpet, 1) },
      { label: 'Common area, as a share of super built-up', value: pct(r.loadingOnSuper, 1) },
      { label: 'Carpet area in square metres', value: `${num(r.carpetSqm, 2)} sq m` },
      { label: 'Price per sq ft of carpet area', value: inr(r.perCarpetSqft), strong: true },
    ],
    note: 'Compare flats on the price per square foot of carpet area: it is the space you can actually use.',
  };
}

/* ── GST on an under-construction flat ───────────────────────────────────── */

/** The price limit for an affordable residential apartment. */
export const AFFORDABLE_PRICE = 45_00_000;
/** Carpet area limits for an affordable residential apartment, square metres. */
export const AFFORDABLE_SQM = { metro: 60, other: 90 } as const;

export type GstInput = {
  /** The price charged by the builder, before GST. */
  price: number;
  carpetSqm: number;
  /** In one of the metropolitan areas named in the rules. */
  metro: boolean;
  /** Completion certificate issued (or first occupied), with the whole price received after it. */
  completed: boolean;
};

export function gstOnFlat(i: GstInput) {
  const price = positive(i.price) ? i.price : NaN;
  const limit = i.metro ? AFFORDABLE_SQM.metro : AFFORDABLE_SQM.other;
  const overPrice = price > AFFORDABLE_PRICE;
  const overArea = !(atLeastZero(i.carpetSqm) <= limit);
  const affordable = !overPrice && !overArea;
  const ratePct = i.completed ? 0 : affordable ? 1 : 5;
  return { ratePct, gst: (price * ratePct) / 100, affordable, overPrice, overArea, limit };
}

export function gstOnFlatResult(i: GstInput): Result {
  if (!positive(i.price) || !positive(i.carpetSqm)) {
    return { lines: [], note: 'Enter the price and the carpet area in square metres.' };
  }
  const r = gstOnFlat(i);
  const why = r.affordable
    ? `Yes: up to ${r.limit} sq m and no more than ₹45 lakh`
    : r.overPrice && r.overArea
      ? `No: over ₹45 lakh and over ${r.limit} sq m`
      : r.overPrice
        ? 'No: the price is over ₹45 lakh'
        : `No: the carpet area is over ${r.limit} sq m`;
  const lines: Line[] = [
    ...(i.completed ? [] : [{ label: 'Affordable home?', value: why }]),
    { label: 'GST rate on the price', value: `${r.ratePct}%` },
    { label: 'GST', value: inr(r.gst), strong: true },
    { label: 'Price with GST', value: inr(i.price + r.gst) },
    { label: 'Carpet area in square feet', value: `${num(i.carpetSqm * SQFT_PER_SQM)} sq ft` },
  ];
  return {
    lines,
    note: i.completed
      ? 'No GST: the flat is sold after its completion certificate, with the whole price received after it. Stamp duty and registration are still due.'
      : 'Stamp duty and registration are charged by the state on top, and are not part of GST.',
  };
}

/* ── Pre-EMI or full EMI ─────────────────────────────────────────────────── */

export type EmiInput = {
  /** Loan disbursed so far. */
  disbursed: number;
  ratePct: number;
  /** Months until possession at this stage. */
  months: number;
  tenureYears: number;
};

/** The standard EMI on `principal` at `ratePct` a year over `n` months. */
export function emi(principal: number, ratePct: number, n: number): number {
  const r = ratePct / 1200;
  if (!positive(principal) || !positive(n)) return NaN;
  if (r === 0) return principal / n;
  const f = (1 + r) ** n;
  return (principal * r * f) / (f - 1);
}

/** What is still owed after `paid` EMIs. */
export function balanceAfter(principal: number, ratePct: number, n: number, paid: number): number {
  const r = ratePct / 1200;
  const e = emi(principal, ratePct, n);
  if (r === 0) return principal - e * paid;
  const f = (1 + r) ** paid;
  return principal * f - (e * (f - 1)) / r;
}

export function preEmi(i: EmiInput) {
  const p = positive(i.disbursed) ? i.disbursed : NaN;
  const rate = atLeastZero(i.ratePct);
  const months = Math.round(atLeastZero(i.months));
  const n = Math.round(atLeastZero(i.tenureYears) * 12);
  const pre = (p * rate) / 1200;
  const full = emi(p, rate, n);
  const repaid = p - balanceAfter(p, rate, n, Math.min(months, n));
  return {
    preEmi: pre,
    preEmiTotal: pre * months,
    fullEmi: full,
    firstRepaid: full - pre,
    repaidByPossession: repaid,
    owedAfterFull: p - repaid,
    extraEachMonth: full - pre,
  };
}

export function preEmiResult(i: EmiInput): Result {
  if (!positive(i.disbursed) || !positive(i.ratePct) || !positive(i.tenureYears)) {
    return { lines: [], note: 'Enter the amount disbursed, the interest rate and the loan term.' };
  }
  const r = preEmi(i);
  const months = Math.round(atLeastZero(i.months));
  return {
    lines: [
      { label: 'Pre-EMI a month (interest only)', value: inr(r.preEmi), strong: true },
      { label: `Pre-EMI paid over ${months} months`, value: inr(r.preEmiTotal) },
      { label: 'Full EMI a month', value: inr(r.fullEmi), strong: true },
      { label: 'Of the first full EMI, repays the loan', value: inr(r.firstRepaid) },
      { label: `Loan repaid in ${months} months on full EMI`, value: inr(r.repaidByPossession) },
      { label: 'Owed at possession on pre-EMI', value: inr(i.disbursed) },
      { label: 'Owed at possession on full EMI', value: inr(r.owedAfterFull) },
    ],
    note: `Full EMI costs ${inr(r.extraEachMonth)} more a month while the flat is built, and the loan starts coming down at once.`,
  };
}

/* ── EV/EBITDA ───────────────────────────────────────────────────────────── */

export type EvInput = {
  /** All in ₹ crore. */
  marketCap: number;
  debt: number;
  cash: number;
  /** Operating profit (EBIT). */
  ebit: number;
  depreciation: number;
  /** A peer median to value at; 0 leaves the valuation out. */
  peerMultiple: number;
};

export function evEbitda(i: EvInput) {
  const ev = atLeastZero(i.marketCap) + atLeastZero(i.debt) - atLeastZero(i.cash);
  const ebitda = (finite(i.ebit) ? i.ebit : 0) + atLeastZero(i.depreciation);
  const netDebt = atLeastZero(i.debt) - atLeastZero(i.cash);
  const impliedEv = atLeastZero(i.peerMultiple) * ebitda;
  return { ev, ebitda, multiple: ebitda > 0 ? ev / ebitda : NaN, netDebt, impliedEv, impliedEquity: impliedEv - netDebt };
}

/** ₹ crore, whole where the figure is whole and to two places where it is not. */
const crore = (n: number) => (finite(n) ? `₹${num(n, Math.abs(n - Math.round(n)) < 0.005 ? 0 : 2)} crore` : NONE);

export function evEbitdaResult(i: EvInput): Result {
  if (!positive(i.marketCap)) return { lines: [], note: 'Enter the market capitalisation, in ₹ crore.' };
  const r = evEbitda(i);
  const lines: Line[] = [
    { label: 'Enterprise value', value: crore(r.ev) },
    { label: 'EBITDA', value: crore(r.ebitda) },
    { label: 'EV/EBITDA', value: finite(r.multiple) ? `${r.multiple.toFixed(1)}x` : NONE, strong: true },
  ];
  if (positive(i.peerMultiple) && r.ebitda > 0) {
    lines.push(
      { label: `Enterprise value at ${num(i.peerMultiple, 1)}x`, value: crore(r.impliedEv) },
      { label: 'Less net debt', value: crore(r.netDebt) },
      { label: 'Value of the shares at that multiple', value: crore(r.impliedEquity), strong: true },
    );
  }
  return {
    lines,
    note: r.ebitda > 0 ? undefined : 'EBITDA is nil or negative, so the multiple means nothing. Value it another way.',
  };
}
