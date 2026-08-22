/**
 * Applying peer multiples to the subject, and reconciling the answers.
 *
 * ── The one error this file exists to prevent ─────────────────────────────
 *
 * EV/Revenue and EV/EBITDA are ENTERPRISE multiples. Applying one gives an
 * enterprise value, which is what the whole business is worth to everybody who
 * has a claim on it — lenders included. The shareholders own what is left after
 * the lenders are paid, so getting from there to an equity value needs the
 * bridge:
 *
 *     equity = enterprise value − total debt + cash
 *
 * P/E is an EQUITY multiple. Applying one gives an equity value directly, and
 * putting it through the bridge as well subtracts the net debt twice.
 *
 * Both halves of that mistake are common and neither is visible in the output —
 * the wrong number looks exactly like the right one. For a company with ₹30 crore
 * of net debt, treating an EV multiple's answer as equity overstates the
 * shareholders' position by ₹30 crore, and the schedule that says so will be
 * signed. So the bridge is applied in exactly one place, per method, decided by
 * the method's own kind, and `conclude.test.ts` asserts a leveraged subject
 * lands on different equity values from the two families.
 *
 * ── The bridge uses the SUBJECT's balance sheet ───────────────────────────
 *
 * Not the peers'. The peers' debt and cash are already inside their multiples —
 * that is what makes an enterprise multiple comparable across companies with
 * different leverage, and it is the reason enterprise multiples are preferred for
 * exactly that comparison. Reaching for a peer's net debt here would double-count
 * theirs and ignore the subject's.
 *
 * ── Nothing is defaulted ──────────────────────────────────────────────────
 *
 * `applyDiscounts` takes the discounts as arguments and has no default values,
 * and that is deliberate rather than unfinished. A discount for lack of
 * marketability moves a conclusion by twenty or thirty per cent, it is the
 * assumption a reviewer challenges first, and a library that supplied "the usual"
 * figure would be putting an opinion nobody made into a signed document. The
 * caller states the number and the number is recorded next to the answer.
 */

import { isKnown } from './multiples';
import { dispersionOf, statisticOf } from './stats';
import type {
  Comparable,
  Conclusion,
  Figure,
  MethodKey,
  MethodOutput,
  MethodRefusal,
  Spread,
  Statistic,
  Subject,
} from './types';

/** Which family a method belongs to. This is what decides the bridge. */
export function isEnterpriseMultiple(method: MethodKey): boolean {
  return method === 'ev_revenue' || method === 'ev_ebitda';
}

/** What the method reads off the subject. */
function subjectMetric(subject: Subject, method: MethodKey): Figure {
  switch (method) {
    case 'ev_revenue':
      return subject.revenue;
    case 'ev_ebitda':
      return subject.ebitda;
    case 'pe':
      return subject.pat;
  }
}

/** What that metric is called, for a refusal a person can read. */
function metricName(method: MethodKey): string {
  switch (method) {
    case 'ev_revenue':
      return 'revenue';
    case 'ev_ebitda':
      return 'EBITDA';
    case 'pe':
      return 'profit after tax';
  }
}

/** Which multiple to read off each comparable. */
function peerMultiple(method: MethodKey): (c: Comparable) => Figure {
  switch (method) {
    case 'ev_revenue':
      return (c) => c.multiples.evToRevenue;
    case 'ev_ebitda':
      return (c) => c.multiples.evToEbitda;
    case 'pe':
      return (c) => c.multiples.priceToEarnings;
  }
}

export const METHOD_PICKERS: Record<MethodKey, (c: Comparable) => Figure> = {
  ev_revenue: peerMultiple('ev_revenue'),
  ev_ebitda: peerMultiple('ev_ebitda'),
  pe: peerMultiple('pe'),
};

/**
 * Enterprise value to equity value.
 *
 * A null debt or cash counts as zero, matching `enterpriseValue` in multiples.ts
 * and the coalesce in migration 0028. Applied to the subject this is a more
 * comfortable assumption than it is for a peer: whoever is running the valuation
 * has the subject's balance sheet in front of them, so a blank here means a real
 * zero far more often than it means an unknown.
 */
export function equityFromEnterprise(enterprise: Figure, subject: Subject): Figure {
  if (!isKnown(enterprise)) return null;
  const debt = isKnown(subject.totalDebt) ? subject.totalDebt : 0;
  const cash = isKnown(subject.cash) ? subject.cash : 0;
  return enterprise - debt + cash;
}

/** Equity value back to enterprise value. The bridge in reverse. */
export function enterpriseFromEquity(equity: Figure, subject: Subject): Figure {
  if (!isKnown(equity)) return null;
  const debt = isKnown(subject.totalDebt) ? subject.totalDebt : 0;
  const cash = isKnown(subject.cash) ? subject.cash : 0;
  return equity + debt - cash;
}

/**
 * Apply one method, or say why it could not be applied.
 *
 * Returns a refusal rather than a null-filled output, because "EV/EBITDA was not
 * applied because the subject is loss-making at EBITDA" is a sentence a reader
 * can act on and a row of dashes is not. Three distinct refusals are possible
 * and they are worth keeping apart:
 *
 *   * no peer had the multiple at all
 *   * the subject's own figure is missing
 *   * the subject's figure is non-positive, so the method would produce a
 *     negative value that no transaction has ever happened at
 */
export function applyMethod(
  method: MethodKey,
  spread: Spread,
  statistic: Statistic,
  subject: Subject,
): MethodOutput | MethodRefusal {
  const multiple = statisticOf(spread, statistic);
  if (!isKnown(multiple)) {
    return {
      method,
      reason: `No comparable in the set had a usable ${method === 'pe' ? 'P/E' : 'multiple'}, so there is nothing to apply`,
    };
  }

  const metric = subjectMetric(subject, method);
  if (!isKnown(metric)) {
    return { method, reason: `The subject's ${metricName(method)} is not known` };
  }
  if (metric <= 0) {
    return {
      method,
      reason: `The subject's ${metricName(method)} is not positive, so this method cannot produce a meaningful value`,
    };
  }

  const product = multiple * metric;

  // The bridge, applied once, decided by the method's family. See the header.
  const impliedEnterpriseValue = isEnterpriseMultiple(method)
    ? product
    : enterpriseFromEquity(product, subject);
  const impliedEquityValue = isEnterpriseMultiple(method)
    ? equityFromEnterprise(product, subject)
    : product;

  return {
    method,
    statistic,
    multiple,
    subjectMetric: metric,
    impliedEnterpriseValue,
    impliedEquityValue,
    peers: spread.n,
  };
}

/** Whether an applyMethod result was applied or refused. */
export function isApplied(r: MethodOutput | MethodRefusal): r is MethodOutput {
  return 'multiple' in r;
}

/**
 * Weight the applied methods into one conclusion.
 *
 * Weights are given per method. Anything not named gets zero, so a caller who
 * lists two methods has deliberately excluded the third rather than accidentally
 * included it at some default.
 *
 * If the named weights do not sum to 1 they are scaled so they do, and
 * `weightsNormalised` records that this happened. Scaling silently would mean a
 * reviewer being asked to accept a 40/40/40 weighting that the tool had quietly
 * turned into 33/33/33 — the answer would be defensible and the working would not
 * match what was handed in.
 *
 * A method that was refused contributes nothing and is not renormalised away: if
 * EV/EBITDA was to carry 30% and could not be applied, the remaining methods are
 * rescaled across what actually ran, and the refusal stays in the output so the
 * reader can see that 30% of the intended weighting had nowhere to go.
 */
export function reconcile(
  results: readonly (MethodOutput | MethodRefusal)[],
  weights: Partial<Record<MethodKey, number>>,
): Conclusion {
  const applied = results.filter(isApplied);
  const refused = results.filter((r): r is MethodRefusal => !isApplied(r));

  const raw: Record<string, number> = {};
  for (const output of applied) {
    const w = weights[output.method];
    raw[output.method] = typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 0;
  }

  const total = Object.values(raw).reduce((sum, w) => sum + w, 0);
  const weightsNormalised = total > 0 && Math.abs(total - 1) > 1e-9;

  const used: Record<string, number> = {};
  for (const [method, w] of Object.entries(raw)) {
    used[method] = total > 0 ? w / total : 0;
  }

  const values = applied
    .map((o) => o.impliedEquityValue)
    .filter((v): v is number => isKnown(v));

  if (values.length === 0) {
    return {
      applied,
      refused,
      weights: used,
      weightsNormalised,
      low: null,
      high: null,
      weighted: null,
      dispersion: null,
    };
  }

  const low = Math.min(...values);
  const high = Math.max(...values);

  // Null rather than zero when every weight was zero. A caller who weighted
  // nothing has not concluded anything, and printing 0 would look like a
  // valuation of nothing rather than an absence of one.
  let weighted: Figure = null;
  if (total > 0) {
    weighted = 0;
    for (const output of applied) {
      const value = output.impliedEquityValue;
      if (isKnown(value)) weighted += value * (used[output.method] ?? 0);
    }
  }

  return {
    applied,
    refused,
    weights: used,
    weightsNormalised,
    low,
    high,
    weighted,
    dispersion: dispersionOf(low, high),
  };
}

/**
 * Apply a marketability and/or control discount to a value.
 *
 * Both are fractions — 0.25 is a twenty-five per cent discount — and both have
 * no default, on purpose. See the header: this is the assumption a reviewer
 * challenges first, and it is not a library's to invent.
 *
 * Applied multiplicatively rather than by addition, because they are successive
 * reductions of the same value rather than two slices of it: a 20% DLOM and a 10%
 * DLOC leave 0.8 × 0.9 = 72% of the value, not 70%. The difference is small and
 * the reasoning is not, and a reviewer who adds them will get 70% and ask which
 * is right — so `describeDiscounts` states the arithmetic.
 */
export function applyDiscounts(
  value: Figure,
  { dlom = 0, dloc = 0 }: { dlom?: number; dloc?: number },
): Figure {
  if (!isKnown(value)) return null;
  const m = Math.min(Math.max(dlom, 0), 1);
  const c = Math.min(Math.max(dloc, 0), 1);
  return value * (1 - m) * (1 - c);
}

/** The discounts as a sentence, with the arithmetic shown. */
export function describeDiscounts({ dlom = 0, dloc = 0 }: { dlom?: number; dloc?: number }): string {
  if (dlom <= 0 && dloc <= 0) return 'No marketability or control discount applied';

  const parts: string[] = [];
  if (dlom > 0) parts.push(`DLOM ${(dlom * 100).toFixed(0)}%`);
  if (dloc > 0) parts.push(`DLOC ${(dloc * 100).toFixed(0)}%`);

  const retained = (1 - Math.min(dlom, 1)) * (1 - Math.min(dloc, 1));
  // "in succession" only where there is a succession. One discount applied once
  // does not need the word, and using it anyway is the kind of small wrongness
  // that makes a reader wonder what else was generated rather than written.
  const how = parts.length > 1 ? ', applied in succession' : ', applied';
  return `${parts.join(' and ')}${how} — ${(retained * 100).toFixed(1)}% of the undiscounted value`;
}
