/**
 * The domain model, and the only description of it.
 *
 * Two things shaped this file. Dates are `yyyy-mm-dd` strings rather than Date
 * objects, because every date here comes out of a spreadsheet and goes into a
 * statement, and a Date carries a timezone that neither of those has — the same
 * off-by-one that lib/fiscal exists to avoid. ISO strings also compare correctly
 * with `<=`, which is the only comparison the engine ever needs.
 *
 * And a transaction is a plain object with free functions over it, not a class.
 * A completed reconciliation is stored as JSON and reopened weeks later, so
 * every value in here has to survive a round trip through the database
 * unchanged. A class would not.
 */

/** Which of the two ledgers. */
export type LedgerKey = 'A' | 'B';

/** Debit or credit balance, worked out from the sign, never asked for. */
export type BalanceType = 'Dr' | 'Cr';

/**
 * What matching concluded about one entry, or one pair of entries.
 *
 * MATCHED      both ledgers have it and both have posted it. No adjustment.
 * TIMING       both have it, one has not posted it yet. Reconciling item.
 * AMOUNT_DIFF  both have it, at different amounts. Reconciling item, itemised.
 * ONE_SIDED    only one ledger has it at all. Reconciling item.
 */
export type DifferenceType = 'MATCHED' | 'TIMING' | 'AMOUNT_DIFF' | 'ONE_SIDED';

/**
 * A status a ledger may carry per line, if it has such a column.
 *
 * All four are optional and a ledger without the column behaves exactly as one
 * that leaves every value unset. REVERSED is the consequential one: it means
 * economically void, so the line is kept out of balances *and* out of matching,
 * rather than turning up later as a one-sided difference nobody can explain.
 */
export type TxnStatus = 'CLEARED' | 'PENDING' | 'HOLD' | 'REVERSED';

/** One line of a ledger. */
export type Txn = {
  /** Posting date, `yyyy-mm-dd`. Null when the source had none we could read. */
  date: string | null;
  particular: string;
  /** Magnitudes, both non-negative. The side is which of the two is set. */
  debit: number;
  credit: number;
  /** Source row, so a difference can be traced back to a line in the file. */
  row: number | null;

  // ── Optional columns. Absent everywhere unless the file had them. ──────────
  /** Running balance as printed. Cross-checked, never used to reconcile. */
  balance?: number | null;
  /** Cheque / instrument / UTR. The primary match key when both sides have it. */
  reference?: string | null;
  /** When it actually cleared. Governs timing in place of the posting date. */
  clearingDate?: string | null;
  status?: TxnStatus | null;
  /** Free text from the file, surfaced in the report. Never affects matching. */
  notes?: string | null;
};

/** A parsed ledger: an opening balance, some lines, maybe a stated closing. */
export type Ledger = {
  name: string;
  /** Signed, debit-positive. A credit opening is negative. */
  openingBalance: number;
  /**
   * Whether an opening line was actually found.
   *
   * False means the balance defaulted to zero, which would quietly skew the
   * whole reconciliation, so the validator warns about it. True by default so a
   * ledger built in a test does not warn about something it never claimed.
   */
  openingBalanceDetected: boolean;
  openingDate: string | null;
  closingBalance: number | null;
  closingDate: string | null;
  transactions: Txn[];
  sourceFilename: string | null;
};

/** One ledger's arithmetic, as of the reconciliation date. */
export type LedgerSummary = {
  key: LedgerKey;
  name: string;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  /** Magnitude. Its Dr/Cr nature is carried by `balanceType`. */
  calculatedClosing: number;
  calculatedClosingSigned: number;
  balanceType: BalanceType;
  providedClosing: number | null;
  /** Null when the file stated no closing balance to check against. */
  closingMatchesProvided: boolean | null;
  transactionCount: number;
};

// ─── Validation ──────────────────────────────────────────────────────────────

export type Severity = 'error' | 'warning';

export type ValidationIssue = {
  ledger?: LedgerKey;
  row?: number | null;
  field?: string;
  severity: Severity;
  message: string;
};

export type ValidationResult = {
  /** False when at least one issue is an error. Errors block the run. */
  isValid: boolean;
  issues: ValidationIssue[];
};

// ─── The statement ───────────────────────────────────────────────────────────

/** One Add or Less line in the reconciliation statement. */
export type StatementLine = {
  description: string;
  /** Always positive. `operation` carries the direction. */
  amount: number;
  operation: 'add' | 'less';
  category: DifferenceType;
  sourceLedger?: LedgerKey | null;
};

/** One row of the differences table. */
export type DifferenceItem = {
  category: DifferenceType;
  particular: string;
  ledgerAAmount: number | null;
  ledgerBAmount: number | null;
  ledgerADate: string | null;
  ledgerBDate: string | null;
  /** The gap, for an amount difference. */
  difference?: number | null;
  /** Why they might differ: Rounding, Decimal, Proportion, Other. */
  differenceClass?: string | null;
  /** Which ledger has posted it, where only one has. */
  postedIn?: LedgerKey | null;
  note: string;
};

export type ReconStatus = 'RECONCILED' | 'PARTIAL' | 'NOT_RECONCILED';

/** The statement itself: start at one balance, adjust, arrive at the other. */
export type Statement = {
  reconciliationDate: string;
  /** The ± window applied to timing, in days. Null when none was asked for. */
  toleranceDays: number | null;
  startingLedger: LedgerKey;
  otherLedger: LedgerKey;
  startingLedgerName: string;
  otherLedgerName: string;

  startingBalance: number;
  startingBalanceType: BalanceType;
  lines: StatementLine[];
  /** Where the adjustments land. A magnitude. */
  calculatedClosing: number;
  /** Where the other ledger says it should land. A magnitude. */
  targetClosing: number;
  targetClosingType: BalanceType;
  variance: number;
  status: ReconStatus;
  isReconciled: boolean;
};

/** Everything one run produces. This is what gets stored. */
export type ReconResult = {
  reconciliationDate: string;
  startingLedger: LedgerKey;
  statement: Statement;
  summaryA: LedgerSummary;
  summaryB: LedgerSummary;
  /** Every difference that needs looking at. */
  differences: DifferenceItem[];
  /** Every pair that agreed. Kept so the table can show the whole picture. */
  matched: DifferenceItem[];
  counts: Record<DifferenceType, number>;
};
