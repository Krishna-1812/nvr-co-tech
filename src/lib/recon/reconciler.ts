import { buildSummary, ledgerMinDate } from './calculator';
import { AMOUNT_TOLERANCE, VARIANCE_TOLERANCE, money } from './config';
import { formatINR } from './amount';
import { matchTransactions, type MatchResult } from './matcher';
import { classifyAmountDifference } from './text';
import type {
  DifferenceItem,
  DifferenceType,
  Ledger,
  LedgerKey,
  LedgerSummary,
  ReconResult,
  ReconStatus,
  Statement,
  StatementLine,
  Txn,
} from './types';
import { amountOf, sideOf, signedOf } from './txn';

/**
 * The reconciliation itself: start at one ledger's balance, apply every
 * difference, and see whether you arrive at the other ledger's balance.
 *
 * How the debit and credit rules are actually implemented
 * -------------------------------------------------------
 * Everything is worked out in a signed, debit-positive space and then projected
 * onto the starting ledger's own display side by a single `signFactor` (+1 for a
 * Dr start, −1 for a Cr start). That one multiplication reproduces both of the
 * textbook rules — the one for reconciling from a debit balance and the mirrored
 * one for reconciling from a credit balance — without a single branch. An
 * adjustment's effect on the displayed balance is `signFactor × delta`, where
 * delta is its signed contribution to (other − starting). Positive is an Add,
 * negative is a Less.
 *
 * Contra ledgers get one more factor. Where the two books record the same event
 * on opposite sides — an intercompany pair, where every debit in one is a credit
 * in the other — the other ledger's whole signed space is inverted relative to
 * the starting one. Negating it brings both into the same orientation, after
 * which the same Add/Less fold above works unchanged for both kinds of pair.
 *
 * What is folded, and what is left
 * ---------------------------------
 * All four difference types are folded into the statement. Two internally
 * consistent ledgers therefore tie out to zero with every difference still
 * listed and explained, rather than leaving a residual for somebody to chase.
 * The only thing that can leave a variance is a ledger that disagrees with
 * itself: its own stated closing not matching its own transactions. That surfaces
 * as a data warning and a PARTIAL result, which is the honest answer, because at
 * that point the file is wrong and no reconciliation can fix it.
 */

export type ReconcileOptions = {
  reconciliationDate: string;
  startingLedger: LedgerKey;
  /** ± days a counterpart may clear within before it counts as late. */
  toleranceDays?: number | null;
};

export function reconcile(
  ledgerA: Ledger,
  ledgerB: Ledger,
  options: ReconcileOptions,
): ReconResult {
  const { reconciliationDate, startingLedger, toleranceDays = null } = options;

  const summaryA = buildSummary(ledgerA, 'A', reconciliationDate);
  const summaryB = buildSummary(ledgerB, 'B', reconciliationDate);

  // The backward cap on every tolerance window: never look before the data.
  const earliestDate =
    [ledgerMinDate(ledgerA), ledgerMinDate(ledgerB)]
      .filter((d): d is string => d !== null)
      .sort()[0] ?? reconciliationDate;

  const matches = matchTransactions(ledgerA.transactions, ledgerB.transactions, {
    reconDate: reconciliationDate,
    toleranceDays,
    earliestDate,
    startingLedger,
  });

  const startsWithA = startingLedger === 'A';
  const sSummary = startsWithA ? summaryA : summaryB;
  const oSummary = startsWithA ? summaryB : summaryA;
  const sLedger = startsWithA ? ledgerA : ledgerB;
  const oLedger = startsWithA ? ledgerB : ledgerA;
  const otherKey: LedgerKey = startsWithA ? 'B' : 'A';

  const sSigned = sSummary.calculatedClosingSigned;
  const oSigned = oSummary.calculatedClosingSigned;
  const signFactor = sSummary.balanceType === 'Dr' ? 1 : -1;

  const mirror = isMirror(matches, sLedger, oLedger, sSummary, oSummary);
  const mirrorFactor = mirror ? -1 : 1;

  /** A contribution's signed delta in (other − starting) space. */
  const delta = (aContribution: number, bContribution: number): number => {
    const [s, o] = startsWithA
      ? [aContribution, bContribution]
      : [bContribution, aContribution];
    return mirrorFactor * o - s;
  };

  const lines: StatementLine[] = [];
  const differences: DifferenceItem[] = [];
  const matched: DifferenceItem[] = [];
  const counts: Record<DifferenceType, number> = {
    MATCHED: 0,
    TIMING: 0,
    AMOUNT_DIFF: 0,
    ONE_SIDED: 0,
  };

  // ── The opening balances, if they disagree ─────────────────────────────────
  // Computed in (other − starting) space like everything else, which means a
  // mirrored opening — 15,000 Dr in one book against 15,000 Cr in the other —
  // correctly nets to nothing. Those two describe the same balance.
  const openingDelta = money(mirrorFactor * oLedger.openingBalance - sLedger.openingBalance);
  if (Math.abs(openingDelta) > AMOUNT_TOLERANCE) {
    const display = signFactor * openingDelta;
    lines.push({
      description: 'Opening balance difference',
      amount: money(Math.abs(display)),
      operation: display >= 0 ? 'add' : 'less',
      category: 'ONE_SIDED',
    });
  }

  // ── Every difference ───────────────────────────────────────────────────────
  for (const m of matches) {
    /*
     * A pair that is present and posted in both books but cleared outside the
     * tolerance window. Internally it stays a balance-neutral timing pair whose
     * two legs cancel, but it is presented as a one-sided entry in each ledger,
     * because that is what the person reading it has to chase: two lines, in two
     * books, that did not clear together.
     */
    const outOfTolerance = m.category === 'TIMING' && m.aPosted && m.bPosted;
    counts[outOfTolerance ? 'ONE_SIDED' : m.category] += 1;

    const deltaOS = delta(contribution(m.a, m.aPosted), contribution(m.b, m.bPosted));

    if (m.category === 'MATCHED') {
      // A matched pair needs no adjustment, so it never becomes a statement
      // line. It is still listed in the table: "we looked at this and it agreed"
      // is information, and a statement that only shows problems reads as though
      // nothing else was checked.
      matched.push(matchedItem(m));
      continue;
    }

    if (outOfTolerance) {
      differences.push(toleranceItem(m, toleranceDays));
      // Split into its two legs so each amount is visible and labelled. They are
      // equal and opposite, so the totals are unchanged and the statement still
      // ties out.
      const legs: [number, LedgerKey][] = [
        [delta(contribution(m.a, m.aPosted), 0), 'A'],
        [delta(0, contribution(m.b, m.bPosted)), 'B'],
      ];
      for (const [legDelta, leg] of legs) {
        if (Math.abs(legDelta) <= AMOUNT_TOLERANCE) continue;
        const display = signFactor * legDelta;
        lines.push({
          description: `Out of tolerance in Ledger ${leg}: ${m.particular}`,
          amount: money(Math.abs(display)),
          operation: display >= 0 ? 'add' : 'less',
          category: 'ONE_SIDED',
          sourceLedger: leg,
        });
      }
      continue;
    }

    differences.push(
      m.category === 'AMOUNT_DIFF' ? amountDiffItem(m) : reconcilingItem(m),
    );

    // A one-sided entry dated after the reconciliation date has not moved either
    // balance yet, so it is listed but adjusts nothing.
    if (Math.abs(deltaOS) <= AMOUNT_TOLERANCE) continue;

    const display = signFactor * deltaOS;
    lines.push({
      description: lineDescription(m),
      amount: money(Math.abs(display)),
      operation: display >= 0 ? 'add' : 'less',
      category: m.category,
      sourceLedger: sourceLedgerOf(m),
    });
  }

  // ── Where it lands ─────────────────────────────────────────────────────────
  const startingBalance = money(Math.abs(sSigned));
  const adjustments = lines.reduce(
    (sum, ln) => sum + (ln.operation === 'add' ? ln.amount : -ln.amount),
    0,
  );

  /*
   * Signed projections onto the starting ledger's side. These can legitimately
   * come out negative — a Dr book can reconcile down to a Cr balance — so the
   * arithmetic is done signed and only the display figures take a magnitude.
   */
  const calculatedSigned = money(startingBalance + adjustments);
  // For mirrored books the other ledger's closing projects as its magnitude; for
  // same-side books, as its signed value on the starting side.
  const targetSigned = mirror ? money(Math.abs(oSigned)) : money(signFactor * oSigned);
  const variance = money(targetSigned - calculatedSigned);

  const dataIssue =
    sSummary.closingMatchesProvided === false || oSummary.closingMatchesProvided === false;
  const { status, isReconciled } = statusFor(variance, dataIssue);

  const statement: Statement = {
    reconciliationDate,
    toleranceDays,
    startingLedger,
    otherLedger: otherKey,
    startingLedgerName: sSummary.name,
    otherLedgerName: oSummary.name,
    startingBalance,
    startingBalanceType: sSummary.balanceType,
    lines,
    // Stored as magnitudes: their Dr/Cr nature is carried by the two type
    // fields, so a crossed-over balance reads "1,350 Cr" and never "−1,350".
    calculatedClosing: money(Math.abs(calculatedSigned)),
    targetClosing: money(Math.abs(targetSigned)),
    targetClosingType: oSummary.balanceType,
    variance,
    status,
    isReconciled,
  };

  return {
    reconciliationDate,
    startingLedger,
    statement,
    summaryA,
    summaryB,
    differences,
    matched,
    counts,
  };
}

/** What a line contributed to its own ledger's balance by the date. */
function contribution(txn: Txn | null, posted: boolean): number {
  return txn === null || !posted ? 0 : signedOf(txn);
}

/**
 * Whether the two books are contra recordings of one relationship.
 *
 * Decided from the entries they SHARE: if the paired lines sit on opposite Dr/Cr
 * sides they are mirrors, and if they sit on the same side they are not.
 *
 * Deliberately not decided from the closing balance types, which a single timing
 * difference can flip. Two copies of the same receivable where one side has not
 * posted the latest invoices can end the month on opposite sides while every
 * shared entry agrees, and treating that as a mirror would invert the whole
 * statement. Only where there are no paired entries at all does this fall back to
 * the openings, and then to the balance types.
 */
function isMirror(
  matches: MatchResult[],
  sLedger: Ledger,
  oLedger: Ledger,
  sSummary: LedgerSummary,
  oSummary: LedgerSummary,
): boolean {
  let contra = 0;
  let same = 0;
  for (const m of matches) {
    if (m.a === null || m.b === null) continue;
    if (sideOf(m.a) !== sideOf(m.b)) contra += 1;
    else same += 1;
  }
  if (contra || same) return contra > same;

  const sOpening = sLedger.openingBalance;
  const oOpening = oLedger.openingBalance;
  if (Math.abs(sOpening) > AMOUNT_TOLERANCE && Math.abs(oOpening) > AMOUNT_TOLERANCE) {
    return sOpening < 0 !== oOpening < 0;
  }
  return oSummary.balanceType !== sSummary.balanceType;
}

/**
 * The outcome.
 *
 * Every explained difference is folded in, so a clean pair ties out and is
 * RECONCILED with its differences listed rather than flagged. PARTIAL is
 * reserved for a ledger that contradicts itself — the one problem reconciling
 * cannot solve. A residual with no such contradiction is NOT_RECONCILED.
 */
function statusFor(variance: number, dataIssue: boolean): {
  status: ReconStatus;
  isReconciled: boolean;
} {
  if (Math.abs(variance) <= VARIANCE_TOLERANCE && !dataIssue) {
    return { status: 'RECONCILED', isReconciled: true };
  }
  if (dataIssue) return { status: 'PARTIAL', isReconciled: false };
  return { status: 'NOT_RECONCILED', isReconciled: false };
}

// ─── How each difference is described ────────────────────────────────────────

function lineDescription(m: MatchResult): string {
  if (m.category === 'AMOUNT_DIFF') {
    const a = m.a ? formatINR(amountOf(m.a), { symbol: false }) : '0.00';
    const b = m.b ? formatINR(amountOf(m.b), { symbol: false }) : '0.00';
    return `Amount difference: ${m.particular} (A ${a} against B ${b})`;
  }
  if (m.category === 'TIMING') {
    if (m.aPosted && !m.bPosted) {
      return `Timing difference: ${m.particular} (posted in A, awaited in B)`;
    }
    if (m.bPosted && !m.aPosted) {
      return `Timing difference: ${m.particular} (posted in B, awaited in A)`;
    }
    return `Timing difference: ${m.particular} (cleared outside the tolerance window)`;
  }
  return m.a !== null
    ? `Entry only in Ledger A: ${m.particular}`
    : `Entry only in Ledger B: ${m.particular}`;
}

/** Which ledger an adjustment came from, where one ledger owns it. */
function sourceLedgerOf(m: MatchResult): LedgerKey | null {
  if (m.a !== null && m.b === null) return 'A';
  if (m.b !== null && m.a === null) return 'B';
  if (m.aPosted && !m.bPosted) return 'A';
  if (m.bPosted && !m.aPosted) return 'B';
  return null;
}

/** Carry any note the source file wrote against these lines into the report. */
function withSourceNotes(m: MatchResult, note: string): string {
  const extras: string[] = [];
  for (const [key, txn] of [['A', m.a], ['B', m.b]] as const) {
    if (txn?.notes) extras.push(`Note (${key}): ${txn.notes}`);
  }
  return extras.length ? `${note} ${extras.join(' ')}` : note;
}

function bothSides(m: MatchResult) {
  return {
    ledgerAAmount: m.a ? amountOf(m.a) : null,
    ledgerBAmount: m.b ? amountOf(m.b) : null,
    ledgerADate: m.a?.date ?? null,
    ledgerBDate: m.b?.date ?? null,
  };
}

function matchedItem(m: MatchResult): DifferenceItem {
  const contra = m.a !== null && m.b !== null && sideOf(m.a) !== sideOf(m.b);
  return {
    category: 'MATCHED',
    particular: m.particular,
    ...bothSides(m),
    note: withSourceNotes(m, contra ? 'Matched (contra Dr/Cr entry)' : 'Matched'),
  };
}

/**
 * A pair that cleared outside the window.
 *
 * Labelled one-sided because that is how it has to be chased, with a note saying
 * what it really is. Both per-ledger amounts are populated, which is how the
 * table tells it apart from an entry that genuinely exists in one book only.
 */
function toleranceItem(m: MatchResult, toleranceDays: number | null): DifferenceItem {
  const window = toleranceDays === null ? '' : `${toleranceDays}-day `;
  return {
    category: 'ONE_SIDED',
    particular: m.particular,
    ...bothSides(m),
    note: withSourceNotes(
      m,
      `Present in both ledgers and posted by the reconciliation date, but cleared ` +
        `outside the ${window}tolerance window. Shown as a one-sided entry in each ledger.`,
    ),
  };
}

function reconcilingItem(m: MatchResult): DifferenceItem {
  if (m.category === 'TIMING') {
    // A real posting lag: exactly one side has posted it, and that side is the
    // anchor. The both-posted case never reaches here.
    const postedIn: LedgerKey = m.aPosted ? 'A' : 'B';
    const behind: LedgerKey = postedIn === 'A' ? 'B' : 'A';
    return {
      category: 'TIMING',
      particular: m.particular,
      ...bothSides(m),
      postedIn,
      note: withSourceNotes(
        m,
        `Posted in Ledger ${postedIn} by the reconciliation date but not yet in Ledger ${behind}.`,
      ),
    };
  }

  const inA = m.a !== null;
  return {
    category: 'ONE_SIDED',
    particular: m.particular,
    ...bothSides(m),
    postedIn: inA ? 'A' : 'B',
    note: withSourceNotes(m, `Entry appears only in Ledger ${inA ? 'A' : 'B'}.`),
  };
}

function amountDiffItem(m: MatchResult): DifferenceItem {
  const a = m.a ? amountOf(m.a) : 0;
  const b = m.b ? amountOf(m.b) : 0;
  return {
    category: 'AMOUNT_DIFF',
    particular: m.particular,
    ...bothSides(m),
    difference: money(Math.abs(a - b)),
    differenceClass: classifyAmountDifference(a, b),
    note: withSourceNotes(m, 'Same particular recorded with a different amount in each ledger.'),
  };
}
