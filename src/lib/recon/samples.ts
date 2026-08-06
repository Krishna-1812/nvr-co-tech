/**
 * A pair of ledgers to try the tool on.
 *
 * This exists because of a real problem with the first run: you cannot see what
 * a reconciliation tool does until you have two files that belong together, and
 * most people arriving here have one bank statement open and nothing to compare
 * it against. Sending them away to find a second file is how a tool gets closed
 * and not reopened.
 *
 * The pair is built to produce something worth looking at rather than a clean
 * tie-out with nothing in it. Reconciled as of 30 April, starting from the
 * company's books, it comes back RECONCILED with two explained differences:
 *
 *   cheque #4471, issued but not yet presented   → in the books only
 *   interest the bank credited on the 30th       → in the statement only
 *
 * It is also a genuine CONTRA pair, which is the case worth demonstrating. A
 * bank statement is written from the bank's side: money you paid in is a credit
 * there, because the bank now owes it to you, and a debit in your own cash book.
 * So the two files record every shared line on opposite sides and the statement
 * opens on a credit balance. Nobody has to tell the tool that — it works it out
 * from the entries the two books share.
 *
 * The columns are deliberately named differently in each file (Particular
 * against Narration, Debit against Withdrawal, Reference against Cheque No), for
 * the same reason: that is what arrives, and it should work without editing.
 */

const COMPANY: string[][] = [
  ['Opening Balance (as on 01-Apr-2026): 10,00,000', '', '', '', ''],
  ['Date', 'Particular', 'Reference', 'Debit', 'Credit'],
  ['05-Apr-2026', 'Sales receipt - INV001', 'UTR8891', '50,000', '-'],
  ['11-Apr-2026', 'Payment to supplier', 'NEFT4410', '-', '10,000'],
  ['15-Apr-2026', 'Rent for April', 'CHQ-4468', '-', '5,000'],
  ['20-Apr-2026', 'Bank charges', '', '-', '500'],
  ['26-Apr-2026', 'Cheque issued to Sharma & Co', 'CHQ-4471', '-', '8,000'],
  ['28-Apr-2026', 'Office supplies', 'CHQ-4472', '-', '2,000'],
  ['Closing Balance (as on 28-Apr-2026): 10,24,500', '', '', '', ''],
];

const BANK: string[][] = [
  ['Opening Balance (as on 01-Apr-2026): 10,00,000 Cr', '', '', '', ''],
  ['Date', 'Narration', 'Cheque No', 'Deposit', 'Withdrawal'],
  ['05-Apr-2026', 'NEFT CR INV001', 'UTR8891', '50,000', '-'],
  ['12-Apr-2026', 'NEFT DR SUPPLIER', 'NEFT4410', '-', '10,000'],
  ['15-Apr-2026', 'CHQ CLG 4468', 'CHQ-4468', '-', '5,000'],
  ['20-Apr-2026', 'SERVICE CHARGES', '', '-', '500'],
  ['28-Apr-2026', 'CHQ CLG 4472', 'CHQ-4472', '-', '2,000'],
  ['30-Apr-2026', 'INTEREST CREDITED', '', '200', '-'],
  ['Closing Balance (as on 30-Apr-2026): 10,32,700 Cr', '', '', '', ''],
];

/** Quote a cell only where it needs it, so the file stays readable when opened. */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export type SampleLedger = { filename: string; label: string; csv: string };

export const SAMPLE_LEDGERS: SampleLedger[] = [
  { filename: 'sample-company-books.csv', label: 'Company books', csv: toCsv(COMPANY) },
  { filename: 'sample-bank-statement.csv', label: 'Bank statement', csv: toCsv(BANK) },
];

/**
 * The samples as File objects, so they go through exactly the same path a
 * dropped file does. Anything else would be a demo of a different code path.
 */
export function sampleFiles(): File[] {
  return SAMPLE_LEDGERS.map(
    (s) => new File([s.csv], s.filename, { type: 'text/csv' }),
  );
}
