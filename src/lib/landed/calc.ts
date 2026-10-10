/**
 * Landed cost of an under-construction property.
 *
 * A flat bought off plan is paid for over two or three years before anyone can
 * live in it: a booking amount, then a demand at each slab, each one met either
 * from the buyer's own money or from a loan. The price on the agreement is what
 * was paid. What the flat actually cost by the day it is handed over is that
 * price plus what the money could have earned, or did cost, while it was tied up
 * in a building that did not exist yet. That second figure is what this works
 * out.
 *
 * ── The rules, stated once ──────────────────────────────────────────────────
 *
 *   - Every payment carries the cost of its source of funds from the day it is
 *     paid to the day of the occupancy certificate (OC), which is taken as
 *     possession. Own money carries the return it gave up; borrowed money
 *     carries the loan's interest.
 *   - One rate per source, applied to every payment from that source. The rate
 *     is a fact about the money, not about the instalment.
 *   - Days are counted actual/365, the convention Indian lenders and the Income
 *     Tax Act both use for interest. A payment made on the OC date carries
 *     nothing; one made after it carries nothing either, and is flagged, because
 *     it was not money tied up in construction.
 *   - Simple interest by default, which is how a lender's pre-EMI interest is
 *     charged during construction. Compounding is offered for anyone who
 *     reinvests, and it is applied to the same day count.
 *
 * Pure functions on plain data: no React, no storage, no clock. Dates come in as
 * ISO calendar dates (YYYY-MM-DD) and are counted as whole days in UTC, so a
 * schedule gives the same answer in Mumbai and in a server in Virginia.
 */

export type FundSource = 'self' | 'borrowed';

export type Compounding = 'simple' | 'annual' | 'quarterly' | 'monthly';

export const COMPOUNDING_LABEL: Record<Compounding, string> = {
  simple: 'Simple interest',
  annual: 'Compounded yearly',
  quarterly: 'Compounded quarterly',
  monthly: 'Compounded monthly',
};

const PERIODS_PER_YEAR: Record<Exclude<Compounding, 'simple'>, number> = {
  annual: 1,
  quarterly: 4,
  monthly: 12,
};

export const SOURCE_LABEL: Record<FundSource, string> = {
  self: 'Own funds',
  borrowed: 'Borrowed',
};

export type Instalment = {
  id: string;
  /** What the builder called the demand: "Booking", "On completion of 4th slab". */
  label: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  amount: number;
  source: FundSource;
};

export type Rates = {
  /** Annual cost of own funds, as a percentage: 7.5 means 7.5% a year. */
  self: number;
  /** Annual cost of borrowed funds, as a percentage. */
  borrowed: number;
};

export type Schedule = {
  /** ISO date of the occupancy certificate, which is treated as possession. */
  ocDate: string;
  rates: Rates;
  compounding: Compounding;
  instalments: Instalment[];
  /** Optional carpet area in square feet, for a cost per square foot. */
  areaSqft?: number;
};

export type InstalmentResult = Instalment & {
  /**
   * Where the payment sits in the schedule as typed, from 1. The rows come back
   * in date order, so this is what keeps an unnamed payment called the same
   * thing ("Payment 3") in the editor, the warnings, the table and the workbook.
   */
  position: number;
  /** The label, or "Payment n" from its position when it has none. */
  name: string;
  /** Days from payment to OC. Zero for a payment on or after the OC date. */
  days: number;
  /** Annual rate applied, as a percentage. */
  rate: number;
  /** Cost of carrying this payment to OC. */
  interest: number;
  /** The payment plus its carrying cost. */
  atPossession: number;
  /** Paid on or after the OC date, so it carried nothing. */
  afterOc: boolean;
};

export type SourceTotals = { paid: number; interest: number };

export type LandedCost = {
  rows: InstalmentResult[];
  self: SourceTotals;
  borrowed: SourceTotals;
  /** Everything paid, before any carrying cost. */
  paid: number;
  /** Everything the money cost while it was tied up. */
  interest: number;
  /** paid + interest. */
  landed: number;
  /** interest as a share of paid, as a percentage. Zero when nothing is paid. */
  upliftPct: number;
  /** Amount-weighted average days a rupee was tied up before OC. */
  weightedDays: number;
  perSqft?: { paid: number; landed: number };
};

const DAY_MS = 86_400_000;

/** A calendar date as a whole-day count, read in UTC so no time zone can move it. */
export function dayNumber(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return Number.NaN;
  const [, y, m, d] = match;
  const t = Date.UTC(Number(y), Number(m) - 1, Number(d));
  // Date.UTC rolls 2025-02-31 over into March; a date that does not exist is
  // not a date.
  const back = new Date(t);
  if (back.getUTCFullYear() !== Number(y) || back.getUTCMonth() !== Number(m) - 1 || back.getUTCDate() !== Number(d)) {
    return Number.NaN;
  }
  return Math.round(t / DAY_MS);
}

export function isIsoDate(iso: string): boolean {
  return Number.isFinite(dayNumber(iso));
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

/** The cost of carrying `amount` for `days` at `ratePct` a year. */
export function carryingCost(
  amount: number,
  ratePct: number,
  days: number,
  compounding: Compounding,
): number {
  if (amount <= 0 || ratePct <= 0 || days <= 0) return 0;
  const r = ratePct / 100;
  const years = days / 365;
  if (compounding === 'simple') return amount * r * years;
  const n = PERIODS_PER_YEAR[compounding];
  return amount * ((1 + r / n) ** (n * years) - 1);
}

/** Two decimal places, the way a rupee amount is written. */
function paise(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * The landed cost of a schedule.
 *
 * Rows that cannot be computed — no date, an impossible date, no amount — are
 * left out of the totals rather than guessed at; `problems()` is what reports
 * them. Rows come back in date order, which is the order a reader checks a
 * demand schedule in, whatever order they were typed in.
 */
export function landedCost(schedule: Schedule): LandedCost {
  const oc = dayNumber(schedule.ocDate);
  const usable = schedule.instalments
    .map((i, n) => ({ i, position: n + 1 }))
    .filter(({ i }) => isIsoDate(i.date) && Number.isFinite(i.amount) && i.amount > 0);

  const rows: InstalmentResult[] = usable
    .map(({ i, position }) => {
      const raw = Number.isFinite(oc) ? oc - dayNumber(i.date) : 0;
      const days = Math.max(0, raw);
      const rate = i.source === 'self' ? schedule.rates.self : schedule.rates.borrowed;
      const interest = paise(carryingCost(i.amount, rate, days, schedule.compounding));
      return {
        ...i,
        position,
        name: paymentName(i, position),
        days,
        rate,
        interest,
        atPossession: paise(i.amount + interest),
        afterOc: Number.isFinite(oc) && raw <= 0,
      };
    })
    // Date order, and typed order between two payments on the same day.
    .sort((a, b) => dayNumber(a.date) - dayNumber(b.date) || a.position - b.position);

  const totals = (source: FundSource): SourceTotals =>
    rows
      .filter((r) => r.source === source)
      .reduce((acc, r) => ({ paid: paise(acc.paid + r.amount), interest: paise(acc.interest + r.interest) }), {
        paid: 0,
        interest: 0,
      });

  const self = totals('self');
  const borrowed = totals('borrowed');
  const paid = paise(self.paid + borrowed.paid);
  const interest = paise(self.interest + borrowed.interest);
  const landed = paise(paid + interest);
  const weightedDays = paid > 0 ? rows.reduce((acc, r) => acc + r.amount * r.days, 0) / paid : 0;

  const area = schedule.areaSqft;
  return {
    rows,
    self,
    borrowed,
    paid,
    interest,
    landed,
    upliftPct: paid > 0 ? (interest / paid) * 100 : 0,
    weightedDays,
    perSqft: area && area > 0 ? { paid: paise(paid / area), landed: paise(landed / area) } : undefined,
  };
}

/**
 * A typed amount as a number: NaN for an empty field, null for text that is not
 * a number. Accepts the forms a demand letter uses — "12,50,000",
 * "₹ 12,50,000.00", "Rs. 5,00,000", "INR 5,00,000" — and a trailing "%".
 */
export function parseAmount(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/^(?:rs\.?|inr|₹)\s*/i, '')
    .replace(/[,\s₹%]/g, '');
  if (cleaned === '') return Number.NaN;
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** What a payment is called: its own label, or its place in the schedule. */
export function paymentName(i: Pick<Instalment, 'label'>, position: number): string {
  return i.label.trim() || `Payment ${position}`;
}

export type Problem = { id?: string; message: string };

/** What stops a schedule from giving a complete answer, in words a reader can act on. */
export function problems(schedule: Schedule): Problem[] {
  const out: Problem[] = [];
  if (!schedule.ocDate) out.push({ message: 'Enter the OC date. Interest is counted up to it.' });
  else if (!isIsoDate(schedule.ocDate)) out.push({ message: 'The OC date is not a real date.' });

  for (const [key, label] of [
    ['self', 'own funds'],
    ['borrowed', 'borrowed funds'],
  ] as const) {
    const rate = schedule.rates[key];
    if (!Number.isFinite(rate)) out.push({ message: `Enter a yearly rate for ${label}, or 0.` });
    else if (rate < 0) out.push({ message: `The rate for ${label} must be zero or more.` });
    else if (rate > 100) out.push({ message: `The rate for ${label} is over 100% a year. Check it is a yearly percentage.` });
  }

  schedule.instalments.forEach((i, n) => {
    const name = paymentName(i, n + 1);
    if (!i.date) out.push({ id: i.id, message: `${name} has no date.` });
    else if (!isIsoDate(i.date)) out.push({ id: i.id, message: `${name} has a date that does not exist.` });
    if (!Number.isFinite(i.amount) || i.amount <= 0) out.push({ id: i.id, message: `${name} needs an amount above zero.` });
  });

  if (schedule.areaSqft !== undefined && (!Number.isFinite(schedule.areaSqft) || schedule.areaSqft < 0)) {
    out.push({ message: 'The carpet area must be a positive number, or left empty.' });
  }
  return out;
}
