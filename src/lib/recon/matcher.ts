import { amountsEqual } from './config';
import { addDays, daysBetween } from './dates';
import { normaliseParticular, normaliseReference } from './text';
import type { DifferenceType, LedgerKey, Txn } from './types';
import { amountOf, effectiveDateOf, isPostedAsOf, sideOf } from './txn';

/**
 * Pairing one ledger's lines against the other's.
 *
 * Six passes, strongest evidence first, each one greedy: once a line in B has
 * been claimed it is gone. That ordering is the whole design. A shared cheque
 * number is proof two lines are the same payment; a shared amount is a hint, and
 * on a bank statement full of round numbers it is a weak one. So references go
 * first and bare amounts go last, and by the time the amount passes run, every
 * line they could steal a counterpart from has already been paired properly.
 *
 *   0  reference          same cheque / UTR / voucher number
 *   1  particular + amount   same narration, same figure
 *   2  particular            same narration, different figure
 *   3  contra amount         same figure, opposite Dr/Cr side
 *   4  any amount            same figure
 *   5  whatever is left      one-sided
 *
 * Matching runs over the FULL transaction lists, including lines dated after the
 * reconciliation date. It has to: a timing difference is precisely the case
 * where the counterpart exists and has not been posted yet, and you cannot see
 * that by looking only at what has been posted.
 */

export type MatchResult = {
  category: DifferenceType;
  particular: string;
  a: Txn | null;
  b: Txn | null;
  /** Posted in A on or before the reconciliation date. */
  aPosted: boolean;
  bPosted: boolean;
  /**
   * Whether the other ledger's leg cleared inside the starting entry's ± window.
   * Only meaningful when both legs are posted; true whenever no window was set.
   */
  withinWindow: boolean;
};

export type MatcherOptions = {
  reconDate: string;
  /** ± days around each starting-ledger entry. Null means no narrowing. */
  toleranceDays?: number | null;
  /** Earliest transaction across both ledgers: the backward cap on a window. */
  earliestDate?: string | null;
  startingLedger?: LedgerKey;
};

export function matchTransactions(
  ledgerA: Txn[],
  ledgerB: Txn[],
  options: MatcherOptions,
): MatchResult[] {
  const { reconDate, toleranceDays = null, startingLedger = 'A' } = options;
  const earliestDate = options.earliestDate ?? reconDate;

  const results: MatchResult[] = [];

  // Reversed lines are void. Dropping them here as well as from balances keeps
  // them from surfacing as one-sided noise against a ledger that never had them.
  const aTxns = ledgerA.filter((t) => t.status !== 'REVERSED');
  const bTxns = ledgerB.filter((t) => t.status !== 'REVERSED');
  const used = new Set<Txn>();

  const posted = (txn: Txn | null) => txn !== null && isPostedAsOf(txn, reconDate);

  /**
   * Did the other ledger's leg clear inside the starting entry's window?
   *
   * The window is centred on the STARTING ledger's posting date and clamped to
   * [earliest transaction, reconciliation date], because looking for a
   * counterpart before the data begins or after the date being reconciled to is
   * meaningless. What is checked against it is the other leg's *effective* date,
   * so a cheque written in time but cleared late is caught.
   */
  const withinWindow = (a: Txn, b: Txn): boolean => {
    if (toleranceDays === null) return true;
    const [start, other] = startingLedger === 'A' ? [a, b] : [b, a];
    const anchor = start.date;
    const otherEffective = effectiveDateOf(other);
    if (anchor === null || otherEffective === null) return true;

    const back = addDays(anchor, -toleranceDays);
    const forward = addDays(anchor, toleranceDays);
    const from = back > earliestDate ? back : earliestDate;
    const to = forward < reconDate ? forward : reconDate;
    return otherEffective >= from && otherEffective <= to;
  };

  const classifyPair = (a: Txn, b: Txn): MatchResult => {
    const aPosted = posted(a);
    const bPosted = posted(b);

    /*
     * The window only judges a pair that is already balance-neutral, which means
     * both legs posted. Where only one is posted the posted flags have already
     * made it a timing difference; where neither is, both books are equally
     * behind and the pair still nets to nothing.
     */
    const inWindow = aPosted && bPosted ? withinWindow(a, b) : true;

    let category: DifferenceType;
    if (amountsEqual(amountOf(a), amountOf(b))) {
      // Matched needs the two sides to agree on posting AND, where a tolerance
      // was set, the counterpart to have cleared inside it. A pair that cleared
      // outside the window becomes a timing difference whose two legs cancel:
      // flagged and visible, but the variance is untouched.
      category = aPosted === bPosted && inWindow ? 'MATCHED' : 'TIMING';
    } else {
      category = 'AMOUNT_DIFF';
    }

    return { category, particular: a.particular, a, b, aPosted, bPosted, withinWindow: inWindow };
  };

  // ── 0. By reference ────────────────────────────────────────────────────────
  // A shared cheque or transaction number identifies the same payment even when
  // the two books word it completely differently, which is the normal case for
  // intercompany ledgers ("To Sales" against "By Purchases").
  const byReference = new Map<string, Txn[]>();
  for (const txn of bTxns) {
    const ref = normaliseReference(txn.reference);
    if (!ref) continue;
    const bucket = byReference.get(ref);
    if (bucket) bucket.push(txn);
    else byReference.set(ref, [txn]);
  }

  const unreferenced: Txn[] = [];
  for (const a of aTxns) {
    const ref = normaliseReference(a.reference);
    const candidates = ref ? (byReference.get(ref) ?? []).filter((t) => !used.has(t)) : [];
    if (candidates.length === 0) {
      unreferenced.push(a);
      continue;
    }
    const b = earliestDated(candidates);
    used.add(b);
    results.push(classifyPair(a, b));
  }

  // ── 1 & 2. By narration ────────────────────────────────────────────────────
  const byParticular = new Map<string, Txn[]>();
  for (const txn of bTxns) {
    if (used.has(txn)) continue;
    const key = normaliseParticular(txn.particular);
    const bucket = byParticular.get(key);
    if (bucket) bucket.push(txn);
    else byParticular.set(key, [txn]);
  }

  const unnarrated: Txn[] = [];
  for (const a of unreferenced) {
    const key = normaliseParticular(a.particular);
    const candidates = (byParticular.get(key) ?? []).filter((t) => !used.has(t));

    // 1. Same narration and same figure.
    const exact = pickEqualAmount(a, candidates);
    if (exact) {
      used.add(exact);
      results.push(classifyPair(a, exact));
      continue;
    }

    // 2. Same narration, different figure. Reported as an amount difference
    //    directly rather than through classifyPair, which would only reach the
    //    same conclusion by a longer route.
    const closest = pickClosestAmount(a, candidates);
    if (closest) {
      used.add(closest);
      results.push({
        category: 'AMOUNT_DIFF',
        particular: a.particular,
        a,
        b: closest,
        aPosted: posted(a),
        bPosted: posted(closest),
        withinWindow: true,
      });
      continue;
    }

    unnarrated.push(a);
  }

  // ── 3 & 4. By amount ───────────────────────────────────────────────────────
  /*
   * Two passes, and the order matters. Pass one pairs only entries on OPPOSITE
   * Dr/Cr sides — the mirror signal, and strong evidence of a contra entry.
   * Pass two takes anything left with the same figure. Run the other way round,
   * a same-side coincidence could take the counterpart a genuine contra pair
   * needed, and both would then be reported as one-sided.
   */
  const byAmount = (a: Txn, contraOnly: boolean): Txn | null => {
    const candidates = bTxns.filter(
      (t) =>
        !used.has(t) &&
        amountsEqual(amountOf(t), amountOf(a)) &&
        (contraOnly ? sideOf(t) !== sideOf(a) : true),
    );
    if (candidates.length === 0) return null;
    const b = nearestDated(a, candidates);
    used.add(b);
    return b;
  };

  const unpairedBySide: Txn[] = [];
  for (const a of unnarrated) {
    const b = byAmount(a, true);
    if (b) results.push(classifyPair(a, b));
    else unpairedBySide.push(a);
  }

  for (const a of unpairedBySide) {
    const b = byAmount(a, false);
    if (b) {
      results.push(classifyPair(a, b));
      continue;
    }

    // ── 5. Genuinely in A only ───────────────────────────────────────────────
    results.push({
      category: 'ONE_SIDED',
      particular: a.particular,
      a,
      b: null,
      aPosted: posted(a),
      bPosted: false,
      withinWindow: true,
    });
  }

  // Anything in B nobody claimed is in B only.
  for (const b of bTxns) {
    if (used.has(b)) continue;
    results.push({
      category: 'ONE_SIDED',
      particular: b.particular,
      a: null,
      b,
      aPosted: false,
      bPosted: posted(b),
      withinWindow: true,
    });
  }

  return results;
}

// ─── Choosing between candidates ─────────────────────────────────────────────
//
// All three are deterministic. Two runs over the same pair of files must produce
// the same statement, or the tool is not usable as evidence.

/** Earliest dated, undated last. */
function earliestDated(candidates: Txn[]): Txn {
  return candidates.reduce((best, c) => {
    if (best.date === null) return c.date === null ? best : c;
    if (c.date === null) return best;
    return c.date < best.date ? c : best;
  });
}

/** An equal-amount candidate, preferring one on the same side. */
function pickEqualAmount(a: Txn, candidates: Txn[]): Txn | null {
  const equal = candidates.filter((c) => amountsEqual(amountOf(c), amountOf(a)));
  if (equal.length === 0) return null;
  const sameSide = equal.filter((c) => sideOf(c) === sideOf(a));
  return earliestDated(sameSide.length ? sameSide : equal);
}

/** The nearest figure, however far off. Only called on same-narration lines. */
function pickClosestAmount(a: Txn, candidates: Txn[]): Txn | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) =>
    Math.abs(amountOf(c) - amountOf(a)) < Math.abs(amountOf(best) - amountOf(a)) ? c : best,
  );
}

/** Closest by date, undated last, ties broken by the earlier date. */
function nearestDated(a: Txn, candidates: Txn[]): Txn {
  const rank = (c: Txn): [number, number, string] =>
    a.date === null || c.date === null
      ? [1, 0, c.date ?? '9999-12-31']
      : [0, Math.abs(daysBetween(a.date, c.date)), c.date];

  return candidates.reduce((best, c) => {
    const [cGroup, cGap, cDate] = rank(c);
    const [bGroup, bGap, bDate] = rank(best);
    if (cGroup !== bGroup) return cGroup < bGroup ? c : best;
    if (cGap !== bGap) return cGap < bGap ? c : best;
    return cDate < bDate ? c : best;
  });
}
