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
  /** Optional: what the property is expected to let for, for the yield. */
  rental?: Rental;
};

/**
 * What the property earns once it is let. Every field is optional except the
 * rent itself; a blank is read as nothing rather than as a guess.
 */
export type Rental = {
  /** Expected rent, per month. */
  monthlyRent?: number;
  /** Society maintenance the owner pays, per month. */
  maintenanceMonthly?: number;
  /** Property tax and other fixed owner costs, per year. */
  annualCosts?: number;
  /** Share of the year expected to be empty between tenants, as a percentage. */
  vacancyPct?: number;
  /** What the property would sell for today, for a yield on market value. */
  marketValue?: number;
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
  /**
   * paid + interest on borrowed funds only: the money that actually leaves the
   * buyer's account. The true cost adds the return own funds gave up, which is
   * a real cost but not a payment, and finance teams report the two apart.
   */
  cash: number;
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
/** Whether a payment can be worked out at all: a real date and an amount above zero. */
function counts(i: Instalment): boolean {
  return isIsoDate(i.date) && Number.isFinite(i.amount) && i.amount > 0;
}

export function landedCost(schedule: Schedule): LandedCost {
  const oc = dayNumber(schedule.ocDate);
  const usable = schedule.instalments
    .map((i, n) => ({ i, position: n + 1 }))
    .filter(({ i }) => counts(i));

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
  const cash = paise(paid + borrowed.interest);
  const weightedDays = paid > 0 ? rows.reduce((acc, r) => acc + r.amount * r.days, 0) / paid : 0;

  const area = schedule.areaSqft;
  return {
    rows,
    self,
    borrowed,
    paid,
    interest,
    landed,
    cash,
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

export type Uncounted = Pick<Instalment, 'id' | 'date' | 'amount' | 'source'> & {
  position: number;
  name: string;
  /** What stops it being counted, in the words the screen warns with. */
  reasons: string[];
};

/**
 * The payments landedCost() leaves out, and why.
 *
 * The screen warns about these beside the payment itself, but a printed or
 * exported schedule has no screen around it: a payment that is quietly missing
 * from a PDF reads as a payment that was never made. So the documents list them
 * by name, with the reason, using the same test landedCost() uses to drop them.
 */
export function uncounted(schedule: Schedule): Uncounted[] {
  const issues = problems(schedule);
  return schedule.instalments
    .map((i, n) => ({ i, position: n + 1 }))
    .filter(({ i }) => !counts(i))
    .map(({ i, position }) => ({
      id: i.id,
      date: i.date,
      amount: i.amount,
      source: i.source,
      position,
      name: paymentName(i, position),
      reasons: issues.filter((p) => p.id === i.id).map((p) => p.message),
    }));
}

// ── Over time ────────────────────────────────────────────────────────────────

/** The ISO date `months` calendar months after `iso`, clamped to the month's end. */
export function addMonths(iso: string, months: number): string {
  const n = dayNumber(iso);
  if (!Number.isFinite(n)) return iso;
  const d = new Date(n * DAY_MS);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const day = d.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const out = new Date(Date.UTC(y, m, Math.min(day, lastDay)));
  return out.toISOString().slice(0, 10);
}

/** ISO date from a whole-day number. */
export function isoFromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export type TimelinePoint = {
  /** Whole-day number, see dayNumber. */
  day: number;
  /** Own funds paid by this day. */
  self: number;
  /** Borrowed funds paid by this day. */
  borrowed: number;
  /** Carrying cost accrued by this day, on everything paid so far. */
  carry: number;
};

/**
 * The schedule as money over time: what had been paid from each source, and
 * what carrying cost had built up on it, on each day from the first payment to
 * the later of the OC date and the last payment.
 *
 * Carrying cost stops growing at the OC date, which is the rule the totals use,
 * and a payment made after it steps the paid line up without adding any. The
 * last point is therefore the landed cost exactly: it is taken from
 * landedCost() itself rather than re-summed, so the chart and the figures above
 * it cannot disagree by a paisa of rounding.
 *
 * `samples` sets the even spacing between payments; every payment date is also
 * a point, twice (the day before and the day of), so the steps are vertical.
 */
export function timeline(schedule: Schedule, samples = 96): TimelinePoint[] {
  const result = landedCost(schedule);
  const oc = dayNumber(schedule.ocDate);
  if (result.rows.length === 0 || !Number.isFinite(oc)) return [];

  const paidOn = result.rows.map((r) => ({ ...r, on: dayNumber(r.date) }));
  const start = paidOn[0].on;
  const end = Math.max(oc, paidOn[paidOn.length - 1].on);

  const at = (day: number): TimelinePoint => {
    let self = 0;
    let borrowed = 0;
    let carry = 0;
    for (const r of paidOn) {
      if (r.on > day) continue;
      if (r.source === 'self') self += r.amount;
      else borrowed += r.amount;
      const held = Math.min(day, oc) - r.on;
      carry += carryingCost(r.amount, r.rate, held, schedule.compounding);
    }
    return { day, self, borrowed, carry };
  };

  const days = new Set<number>([start, oc, end]);
  for (let k = 0; k <= samples; k += 1) days.add(Math.round(start + ((end - start) * k) / samples));
  for (const r of paidOn) {
    days.add(r.on);
    if (r.on - 1 >= start) days.add(r.on - 1);
  }

  const points = [...days].sort((a, b) => a - b).map(at);
  const last = points[points.length - 1];
  last.self = result.self.paid;
  last.borrowed = result.borrowed.paid;
  last.carry = result.interest;
  return points;
}

/**
 * The same schedule with possession `months` later. What the screen's "what if
 * the OC slips" control runs, and kept here so it is tested with the rest.
 */
export function withDelay(schedule: Schedule, months: number): Schedule {
  return months === 0 ? schedule : { ...schedule, ocDate: addMonths(schedule.ocDate, months) };
}

export type DelayCase = {
  months: number;
  /** The OC date it would then be. */
  ocDate: string;
  /** Carrying cost added by the wait. */
  extra: number;
  /** extra spread over the months, for "about this much a month". */
  perMonth: number;
  /** The true cost at the later date. */
  landed: number;
  upliftPct: number;
};

/**
 * What a later OC costs: the same payments carried `months` longer. The screen's
 * "If possession slips" panel and the printed documents both read this, so the
 * slider and the table in the PDF cannot disagree.
 */
export function delayCase(schedule: Schedule, months: number, base: LandedCost = landedCost(schedule)): DelayCase {
  const later = withDelay(schedule, months);
  const late = landedCost(later);
  const extra = paise(late.interest - base.interest);
  return {
    months,
    ocDate: later.ocDate,
    extra,
    perMonth: months > 0 ? extra / months : 0,
    landed: late.landed,
    upliftPct: late.upliftPct,
  };
}

/** The delays the documents print, from a quarter to the three years the slider reaches. */
export const DELAY_STEPS = [3, 6, 12, 24, 36] as const;

// ── Rental yield ─────────────────────────────────────────────────────────────

export type RentalYield = {
  /** Rent for a full year, before vacancy and costs. */
  grossAnnual: number;
  /** Rent actually expected after vacancy, less maintenance and fixed costs. */
  netAnnual: number;
  /** Gross rent on the price paid: the yield a broker quotes. */
  grossOnPaid: number;
  /** Gross rent on the true cost. */
  grossOnTrue: number;
  /** Net rent on the true cost: what the money actually earns. */
  netOnTrue: number;
  /** Net rent on today's market value, when one is given. */
  netOnMarket?: number;
  /**
   * What the money in the property costs a year, as a rate: own funds and
   * borrowed funds weighted by how much each paid.
   */
  blendedRate: number;
  /** netOnTrue less blendedRate. Below zero, the rent does not cover the money. */
  spread: number;
  /** Monthly rent at which the net yield on true cost equals the blended rate. */
  breakEvenRent: number;
  /** Years of net rent to earn back the true cost, ignoring growth. */
  paybackYears: number | null;
};

/**
 * The yield on what the property really cost.
 *
 * A yield quoted on the agreement price flatters a flat bought off plan,
 * because the money was out for years before the first month's rent. Measured
 * against the true cost instead, and set beside what that money costs a year,
 * it answers the question an investor actually has: does the rent cover the
 * money?
 *
 * Pre-tax and without growth: no appreciation, no rent escalation, no tax on
 * rent and no deduction for loan interest. Null until a rent is entered.
 */
export function rentalYield(schedule: Schedule, result: LandedCost = landedCost(schedule)): RentalYield | null {
  const r = schedule.rental;
  const rent = r?.monthlyRent ?? 0;
  if (!r || !(rent > 0) || result.paid <= 0) return null;

  const pos = (v: number | undefined) => (v !== undefined && Number.isFinite(v) && v > 0 ? v : 0);
  const vacancy = Math.min(100, pos(r.vacancyPct)) / 100;
  const grossAnnual = rent * 12;
  const fixed = pos(r.maintenanceMonthly) * 12 + pos(r.annualCosts);
  const netAnnual = grossAnnual * (1 - vacancy) - fixed;

  const blendedRate =
    (result.self.paid * schedule.rates.self + result.borrowed.paid * schedule.rates.borrowed) / result.paid;
  const netOnTrue = (netAnnual / result.landed) * 100;
  // The rent at which (12 x rent x (1 - vacancy) - fixed) / true cost equals the
  // blended rate. With the property empty all year no rent is ever enough,
  // which is reported as Infinity rather than as a number.
  const breakEvenRent =
    vacancy >= 1 ? Number.POSITIVE_INFINITY : ((blendedRate / 100) * result.landed + fixed) / (12 * (1 - vacancy));
  const market = pos(r.marketValue);

  return {
    grossAnnual,
    netAnnual,
    grossOnPaid: (grossAnnual / result.paid) * 100,
    grossOnTrue: (grossAnnual / result.landed) * 100,
    netOnTrue,
    netOnMarket: market > 0 ? (netAnnual / market) * 100 : undefined,
    blendedRate,
    spread: netOnTrue - blendedRate,
    breakEvenRent,
    paybackYears: netAnnual > 0 ? result.landed / netAnnual : null,
  };
}
