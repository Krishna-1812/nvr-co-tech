import {
  amountsFromCells,
  hasCreditMarker,
  parseAmount,
  signedAmountCell,
  stripDrCr,
} from '../amount';
import { money } from '../config';
import { parseLedgerDate } from '../dates';
import type { Ledger, Txn } from '../types';
import { findHeader, parseStatus, type ColumnMapping } from './columns';

/**
 * Rows of cells to a ledger.
 *
 * Every format funnels through here, so an .xlsx and a PDF of the same ledger
 * produce the same result. What this has to survive is the shape real exports
 * arrive in: an opening balance written as a sentence above the table, or as a
 * row inside it, or both; a closing balance printed in the balancing column with
 * its Dr/Cr marker attached; grand-total rows with figures and no narration; and
 * headers in an order nobody agreed on.
 */

export class LedgerParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerParseError';
  }
}

/** A currency amount, Indian or western grouping. */
const AMOUNT_TOKEN = /\d[\d,]*(?:\.\d+)?/g;

/** The "(as on 01-Apr-2026)" clause, ending at a bracket or a colon. */
const AS_ON = /as\s+on\s*([0-9A-Za-z\-/ ,]+?)\s*[):]/i;

/**
 * Labels a balance line can carry.
 *
 * A bare "opening" and "closing" are accepted because PDF extraction routinely
 * splits "Opening Balance" across two cells, and half a label is still a label.
 */
const OPENING_LABELS = [
  'opening balance', 'opening bal', 'balance b/f', 'balance b/d', 'b/f', 'b/d', 'opening',
];
const CLOSING_LABELS = [
  'closing balance', 'closing bal', 'balance c/f', 'balance c/d', 'c/f', 'c/d', 'closing',
];

function collapse(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function isOpeningLabel(low: string): boolean {
  const text = collapse(low);
  return text.includes('opening balance') || OPENING_LABELS.includes(text);
}

function isClosingLabel(low: string): boolean {
  const text = collapse(low);
  return text.includes('closing balance') || CLOSING_LABELS.includes(text);
}

/**
 * The same question asked of the whole row rather than of the Particular cell.
 *
 * A balance line does not reliably land in the narration column. In a PDF it is
 * one run of text spread across whatever columns it happens to overlap, so
 * "Closing Balance" can end up in the date column and the figure in the
 * narration one. Reading the row as a whole catches it wherever it fell.
 *
 * Deliberately stricter than the cell version: the full phrase only, never the
 * bare "opening" or "b/f" that a single cell is allowed to be. Across an entire
 * row those would match narrations that merely mention the word.
 */
const BALANCE_ROW = {
  opening: /\bopening\s+balance\b|\bbalance\s+b\/[fd]\b/i,
  closing: /\bclosing\s+balance\b|\bbalance\s+c\/[fd]\b/i,
};

/**
 * A balance stated as free text: "Opening Balance (as on 01-Apr-2026): 10,00,000".
 *
 * The amount is taken as the last number AFTER any "as on" clause, so the digits
 * inside the date are never mistaken for the figure — which is exactly what
 * happens if you simply take the last number on the line and the date is written
 * as 01/04/2026.
 */
function extractStatedBalance(
  text: string,
  keyword: string,
  defaultYear: number | null,
): { amount: number | null; date: string | null } {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const at = line.toLowerCase().indexOf(keyword);
    if (at === -1) continue;

    const segment = line.slice(at);
    let date: string | null = null;
    let amountRegion = segment;

    const asOn = AS_ON.exec(segment);
    if (asOn) {
      date = parseLedgerDate(asOn[1], { defaultYear });
      amountRegion = segment.slice(asOn.index + asOn[0].length);
    }

    const tokens = amountRegion.match(AMOUNT_TOKEN) ?? segment.match(AMOUNT_TOKEN);
    if (!tokens || tokens.length === 0) continue;

    let amount = parseAmount(tokens[tokens.length - 1]);
    if (hasCreditMarker(amountRegion)) amount = -Math.abs(amount);
    return { amount: money(amount), date };
  }
  return { amount: null, date: null };
}

/**
 * A printed running balance, as a signed figure.
 *
 * Optional and validation-only, so an unreadable cell returns null rather than
 * throwing. Nothing downstream depends on it.
 */
function parseRunningBalance(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  let amount: number;
  try {
    amount = parseAmount(stripDrCr(trimmed));
  } catch {
    return null;
  }

  if (/\bcr\b/i.test(trimmed)) return money(-Math.abs(amount));
  if (/\bdr\b/i.test(trimmed)) return money(Math.abs(amount));
  return money(amount);
}

/**
 * The signed figure on an opening or closing row.
 *
 * Prefers the Debit and Credit columns, honouring any marker written on the
 * figure, and only falls back to the running Balance column when both are empty,
 * which is how some ledgers print a balance row.
 */
function balanceRowAmount(debitText: string, creditText: string, balanceText: string): number {
  let signed = 0;
  try {
    signed =
      signedAmountCell(debitText, true) + signedAmountCell(creditText, false);
  } catch {
    signed = 0;
  }
  if (signed) return signed;
  return parseRunningBalance(balanceText) ?? 0;
}

export type ParseRowsOptions = {
  name?: string;
  filename?: string | null;
  /** An explicit mapping from the column-matching step, replacing the guess. */
  mapping?: ColumnMapping | null;
};

export function parseRowsToLedger(
  rows: string[][],
  fullText: string,
  { name = 'Ledger', filename = null, mapping: override = null }: ParseRowsOptions = {},
): Ledger {
  const ledger: Ledger = {
    name,
    openingBalance: 0,
    openingBalanceDetected: false,
    openingDate: null,
    closingBalance: null,
    closingDate: null,
    transactions: [],
    sourceFilename: filename,
  };

  // Free-text balances first: the opening date is where the default year for
  // every bare "15-Apr" in the file comes from.
  const openingText = extractStatedBalance(fullText, 'opening balance', null);
  const defaultYear = openingText.date ? Number(openingText.date.slice(0, 4)) : null;
  const closingText = extractStatedBalance(fullText, 'closing balance', defaultYear);

  let openingFound = openingText.amount !== null;
  if (openingText.amount !== null) {
    ledger.openingBalance = openingText.amount;
    ledger.openingDate = openingText.date;
  }
  if (closingText.amount !== null) {
    ledger.closingBalance = closingText.amount;
    ledger.closingDate = closingText.date;
  }
  /*
   * An inline closing row must not overwrite a stated one. Tally prints the
   * closing in the BALANCING column, so its column sign is inverted and only the
   * free-text label carries the true Dr/Cr. The opening is the opposite case: it
   * sits in its natural column, so the inline row IS the reliable sign there,
   * and free text (which carries no marker and would default positive) is the
   * one that must give way. Hence one flag, and only for the closing.
   */
  const statedClosing = closingText.amount !== null;

  const found = findHeader(rows);
  let mapping: ColumnMapping;
  let start: number;
  if (found.index === null) {
    // No header at all: assume Date | Particular | Debit | Credit, from row one.
    mapping = override ?? { date: 0, particular: 1, debit: 2, credit: 3 };
    start = 0;
  } else {
    mapping = override ?? found.mapping;
    start = found.index + 1;
  }

  const cell = (row: string[], field: keyof ColumnMapping): string => {
    const index = mapping[field];
    if (index === null || index === undefined || index >= row.length) return '';
    return row[index] ?? '';
  };

  const transactions: Txn[] = [];

  for (let offset = start; offset < rows.length; offset += 1) {
    const row = rows[offset];
    if (!row.some((c) => c.trim())) continue;

    const particular = collapse(cell(row, 'particular'));
    const dateText = cell(row, 'date').trim();
    const debitText = cell(row, 'debit').trim();
    const creditText = cell(row, 'credit').trim();
    const low = particular.toLowerCase();
    const rowText = collapse(row.join(' '));
    const parsedDate = parseLedgerDate(dateText, { defaultYear });

    // ── An opening or closing row inside the table ──────────────────────────
    if (isOpeningLabel(low) || BALANCE_ROW.opening.test(rowText)) {
      openingFound = true; // the line exists, even where its amount is nil
      if (parsedDate && ledger.openingDate === null) ledger.openingDate = parsedDate;
      const signed = balanceRowAmount(debitText, creditText, cell(row, 'balance'));
      if (signed) {
        ledger.openingBalance = money(signed);
        ledger.openingDate = parsedDate ?? ledger.openingDate;
      }
      continue;
    }

    if (isClosingLabel(low) || BALANCE_ROW.closing.test(rowText)) {
      if (parsedDate && ledger.closingDate === null) ledger.closingDate = parsedDate;
      if (!statedClosing) {
        const signed = balanceRowAmount(debitText, creditText, cell(row, 'balance'));
        if (signed) {
          ledger.closingBalance = money(signed);
          ledger.closingDate = parsedDate ?? ledger.closingDate;
        }
      }
      continue;
    }

    let amounts: { debit: number; credit: number };
    try {
      amounts = amountsFromCells(debitText, creditText);
    } catch {
      // A cell that is not a number at all. Skip the row and keep reading, so
      // one stray line does not cost the whole file.
      continue;
    }

    /*
     * A row with no narration is not a transaction. It is either genuinely blank
     * or a grand-total line carrying nothing but summed figures — which, taken
     * as a transaction, would double the whole ledger.
     */
    if (!particular) continue;

    transactions.push({
      date: parsedDate,
      particular,
      debit: money(amounts.debit),
      credit: money(amounts.credit),
      row: offset + 1,
      balance: parseRunningBalance(cell(row, 'balance')),
      reference: cell(row, 'reference').trim() || null,
      clearingDate: parseLedgerDate(cell(row, 'clearingDate').trim(), { defaultYear }),
      status: parseStatus(cell(row, 'status')),
      notes: collapse(cell(row, 'notes')) || null,
    });
  }

  ledger.openingBalanceDetected = openingFound;
  ledger.transactions = transactions;

  if (
    transactions.length === 0 &&
    ledger.openingBalance === 0 &&
    ledger.closingBalance === null
  ) {
    throw new LedgerParseError(
      `Nothing recognisable as a ledger in ${filename ?? name}. It needs a table with ` +
        `Date, Particular, Debit and Credit columns.`,
    );
  }

  return ledger;
}
