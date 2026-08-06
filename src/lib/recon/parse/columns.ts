import type { TxnStatus } from '../types';

/**
 * Working out which column is which.
 *
 * Four columns are compulsory — Date, Particular, Debit, Credit — and a ledger
 * that does not offer all four cannot be reconciled. Everything else is optional
 * and contributes only when it happens to be there, which is the property that
 * lets the same parser read a two-column CSV somebody typed out and a Tally
 * export with eleven columns.
 *
 * The keyword lists are matched case-insensitively and as substrings, because
 * real headers are "Debit (₹)" and "Txn Date" rather than "Debit" and "Date".
 */

export const FIELDS = [
  'date',
  'particular',
  'debit',
  'credit',
  'balance',
  'clearingDate',
  'reference',
  'status',
  'notes',
] as const;

export type Field = (typeof FIELDS)[number];

/** The four without which there is no ledger. */
export const REQUIRED_FIELDS = ['date', 'particular', 'debit', 'credit'] as const satisfies
  readonly Field[];

/** Column index per logical field, or null where the file has no such column. */
export type ColumnMapping = Partial<Record<Field, number | null>>;

/** What each field means, in the words the column-matching screen uses. */
export const FIELD_LABEL: Record<Field, string> = {
  date: 'Date',
  particular: 'Particular',
  debit: 'Debit',
  credit: 'Credit',
  balance: 'Running balance',
  clearingDate: 'Clearing date',
  reference: 'Reference',
  status: 'Status',
  notes: 'Notes',
};

/** What each optional field changes, said plainly. Shown next to the picker. */
export const FIELD_EFFECT: Record<Field, string> = {
  date: 'When it was posted.',
  particular: 'What it was for.',
  debit: 'Money in, on a ledger.',
  credit: 'Money out, on a ledger.',
  balance: 'Checked against the movements. Never used to reconcile.',
  clearingDate: 'When it actually cleared. Decides timing in place of the date.',
  reference: 'The strongest match there is. Same reference means same transaction.',
  status: 'Cleared, pending, on hold or reversed. A reversal is left out entirely.',
  notes: 'Carried into the report. Never affects matching.',
};

const KEYS: Record<Field, string[]> = {
  date: ['date', 'txn date', 'value date'],
  particular: ['particular', 'narration', 'description', 'details', 'remarks'],
  debit: ['debit', 'withdrawal', 'payment', 'dr'],
  credit: ['credit', 'deposit', 'receipt', 'cr'],
  balance: ['balance', 'running balance', 'closing bal'],
  clearingDate: [
    'clearing date', 'clearance date', 'settlement date', 'settled date',
    'cleared date', 'cleared on', 'realisation date', 'realization date',
  ],
  reference: [
    'reference no', 'reference number', 'reference', 'ref no', 'ref number',
    'cheque no', 'cheque number', 'cheque', 'chq no', 'instrument no',
    'instrument number', 'transaction id', 'txn id', 'utr no', 'utr',
    'voucher no', 'voucher number', 'vch no', 'vch number', 'vch',
    'document no', 'doc no', 'bank reference', 'bank ref',
  ],
  status: ['reconciliation status', 'rec status', 'reco status', 'status'],
  notes: ['rec notes', 'rec note', 'notes', 'note', 'comments', 'comment'],
};

/** The particular keywords, also used to spot a header row inside a PDF. */
export const PARTICULAR_KEYS = KEYS.particular;

/** Amount-ish headers, used to tell a real row from a wrapped label in a PDF. */
export const AMOUNT_KEYS = [...KEYS.debit, ...KEYS.credit, ...KEYS.balance];

function indexOf(header: string[], keys: string[], exclude: Set<number>): number | null {
  for (let i = 0; i < header.length; i += 1) {
    if (exclude.has(i)) continue;
    const cell = header[i].trim().toLowerCase();
    if (keys.some((k) => k === cell || cell.includes(k))) return i;
  }
  return null;
}

/**
 * Find the header row, and what each of its columns is.
 *
 * A row counts as the header when it mentions a date and any of the narration
 * words. That pair is specific enough not to fire on a title line and loose
 * enough to survive the column ordering nobody agrees on.
 *
 * Resolution order matters more than it looks. Clearing Date is claimed before
 * Date, or "Clearing Date" would be taken as the posting date and every line
 * would be timed by when it cleared. The optional columns are then resolved
 * against the indices already spoken for, so a "Reference" header can never
 * shadow a column the engine needs.
 */
export function findHeader(rows: string[][]): { index: number | null; mapping: ColumnMapping } {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const joined = row.map((c) => c.trim().toLowerCase()).join(' ');
    if (!joined.includes('date')) continue;
    if (!PARTICULAR_KEYS.some((p) => joined.includes(p))) continue;

    const none = new Set<number>();
    const clearingDate = indexOf(row, KEYS.clearingDate, none);
    const claimed = new Set<number>(clearingDate === null ? [] : [clearingDate]);

    const mapping: ColumnMapping = {
      date: indexOf(row, KEYS.date, claimed),
      particular: indexOf(row, KEYS.particular, none),
      debit: indexOf(row, KEYS.debit, none),
      credit: indexOf(row, KEYS.credit, none),
      balance: indexOf(row, KEYS.balance, none),
      clearingDate,
    };

    // Optional columns cannot take an index a core column already holds.
    const core = new Set<number>();
    for (const value of Object.values(mapping)) {
      if (typeof value === 'number') core.add(value);
    }

    const reference = indexOf(row, KEYS.reference, core);
    if (reference !== null) core.add(reference);
    const status = indexOf(row, KEYS.status, core);
    if (status !== null) core.add(status);
    const notes = indexOf(row, KEYS.notes, core);

    return { index: i, mapping: { ...mapping, reference, status, notes } };
  }

  return { index: null, mapping: {} };
}

export type DetectedColumns = {
  headers: string[];
  /** False when no header row was found. Columns are then read by position. */
  headerDetected: boolean;
  autoMapping: Record<Field, number | null>;
};

/** What the column-matching screen shows: every header, and its best guess. */
export function detectColumns(rows: string[][]): DetectedColumns {
  const { index, mapping } = findHeader(rows);
  if (index === null) {
    return {
      headers: [],
      headerDetected: false,
      autoMapping: Object.fromEntries(FIELDS.map((f) => [f, null])) as Record<Field, number | null>,
    };
  }
  return {
    headers: rows[index].map((c) => c.trim()),
    headerDetected: true,
    autoMapping: Object.fromEntries(FIELDS.map((f) => [f, mapping[f] ?? null])) as Record<
      Field,
      number | null
    >,
  };
}

/**
 * Free text in a Status column mapped onto the four the engine understands.
 *
 * The list is long because this column is written by hand. "Y", "done",
 * "settled" and "reconciled" all mean cleared to whoever typed them, and a
 * status the parser fails to recognise silently becomes no status at all, which
 * is a pending cheque quietly counted as posted.
 */
const STATUS_VALUES: Record<string, TxnStatus> = {
  cleared: 'CLEARED', clear: 'CLEARED', reconciled: 'CLEARED', matched: 'CLEARED',
  settled: 'CLEARED', complete: 'CLEARED', completed: 'CLEARED', done: 'CLEARED',
  paid: 'CLEARED', yes: 'CLEARED', y: 'CLEARED',

  pending: 'PENDING', unreconciled: 'PENDING', unmatched: 'PENDING', open: 'PENDING',
  outstanding: 'PENDING', uncleared: 'PENDING', 'in transit': 'PENDING',
  intransit: 'PENDING', no: 'PENDING', n: 'PENDING',

  hold: 'HOLD', 'on hold': 'HOLD', held: 'HOLD', blocked: 'HOLD',

  reversed: 'REVERSED', reversal: 'REVERSED', void: 'REVERSED', voided: 'REVERSED',
  cancelled: 'REVERSED', canceled: 'REVERSED', rejected: 'REVERSED',
  returned: 'REVERSED', bounced: 'REVERSED',
};

export function parseStatus(text: string): TxnStatus | null {
  const key = text.trim().replace(/\s+/g, ' ').toLowerCase();
  return key ? (STATUS_VALUES[key] ?? null) : null;
}
