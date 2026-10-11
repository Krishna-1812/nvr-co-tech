import { ledgerMaxDate, ledgerMinDate } from './calculator';
import { matchTransactions } from './matcher';
import { readCsv } from './parse/csv';
import { parseRowsToLedger } from './parse/rows';
import { reconcile } from './reconciler';
import { SAMPLE_LEDGERS } from './samples';
import type { DifferenceType, Ledger, ReconResult } from './types';

/**
 * The public site's reconciliation demo, run on the real engine.
 *
 * Nothing in here is a stand-in. The two sample ledgers are the same files the
 * signed-in tool offers under "Try the samples" (samples.ts); they are read by
 * the same CSV reader and row parser an upload goes through, paired by the same
 * matcher, and reconciled by the same `reconcile` the tool calls. The demo only
 * adds one thing the tool does not need: which row in one book each row in the
 * other was paired with, by position, so the page can draw the line between
 * them. That comes from `matchTransactions` itself, called with exactly the
 * options `reconcile` uses internally, so the lines drawn are the pairs the
 * statement was built from.
 *
 * Pure and synchronous, with no network, storage or DOM, so it runs in the
 * browser on the public page and in a test under Node alike.
 */

export type DemoPair = {
  category: DifferenceType;
  particular: string;
  /** Index into the company books' transactions, or null if only the bank has it. */
  a: number | null;
  /** Index into the bank statement's transactions, or null if only the books have it. */
  b: number | null;
};

export type ReconDemo = {
  books: Ledger;
  bank: Ledger;
  pairs: DemoPair[];
  result: ReconResult;
};

function read(index: number, name: string): Ledger {
  const sample = SAMPLE_LEDGERS[index];
  const { rows, text } = readCsv(sample.csv);
  return parseRowsToLedger(rows, text, { name, filename: sample.filename });
}

export function runReconDemo(): ReconDemo {
  const books = read(0, 'Company books');
  const bank = read(1, 'Bank statement');

  // The whole period: the latest date either book reaches, which is what the
  // tool proposes as its default too.
  const reconciliationDate =
    [ledgerMaxDate(books), ledgerMaxDate(bank)]
      .filter((d): d is string => d !== null)
      .sort()
      .at(-1) ?? '2026-04-30';
  const earliestDate =
    [ledgerMinDate(books), ledgerMinDate(bank)]
      .filter((d): d is string => d !== null)
      .sort()[0] ?? reconciliationDate;

  const result = reconcile(books, bank, { reconciliationDate, startingLedger: 'A' });

  const pairs = matchTransactions(books.transactions, bank.transactions, {
    reconDate: reconciliationDate,
    toleranceDays: null,
    earliestDate,
    startingLedger: 'A',
  }).map((m) => ({
    category: m.category,
    particular: m.particular,
    a: m.a ? books.transactions.indexOf(m.a) : null,
    b: m.b ? bank.transactions.indexOf(m.b) : null,
  }));

  return { books, bank, pairs, result };
}
