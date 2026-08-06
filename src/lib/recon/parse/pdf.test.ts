import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPdf } from './pdf';
import { parseRowsToLedger } from './rows';

/**
 * The PDF parser, against a real PDF.
 *
 * This is the one part of the parser that cannot be tested from a fixture in
 * source, because the fixture would have to be a PDF. So the sample generator
 * writes one — a deliberately BORDERLESS table, which is the hard case and the
 * shape every bank statement arrives in — and this reads it back.
 *
 *   npm run recon:sample
 *
 * The test is skipped rather than failed when that has not been run, because it
 * depends on a generated artefact that is not in the repository. Every other
 * suite here is hermetic; this one is honest about not being.
 */
const SCRATCH = join(process.cwd(), 'scratch');
const BANK = join(SCRATCH, 'sample-bank-statement.pdf');
const BOOKS = join(SCRATCH, 'sample-company-books.pdf');
const generated = existsSync(BANK) && existsSync(BOOKS);

const read = async (path: string) => {
  const bytes = readFileSync(path);
  // A Buffer's underlying ArrayBuffer can be a shared pool slab, so slice to
  // exactly this file's bytes rather than handing over the whole pool.
  return readPdf(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};

describe.skipIf(!generated)('reading a borderless PDF ledger', () => {
  it('rebuilds the table from where the words are', async () => {
    const { rows, text } = await read(BANK);

    // The header row was found, and every column with it.
    expect(rows[0].map((c) => c.toLowerCase())).toEqual(
      expect.arrayContaining(['date', 'narration', 'cheque no', 'deposit', 'withdrawal']),
    );
    expect(text).toContain('Opening Balance');
  });

  it('produces the same ledger the CSV of it produces', async () => {
    const { rows, text } = await read(BANK);
    const ledger = parseRowsToLedger(rows, text, { name: 'Bank statement', filename: 'b.pdf' });

    expect(ledger.openingBalance).toBe(-1_000_000);
    expect(ledger.closingBalance).toBe(-1_032_700);
    expect(ledger.transactions).toHaveLength(6);

    const [first] = ledger.transactions;
    expect(first).toMatchObject({
      date: '2026-04-05',
      particular: 'NEFT CR INV001',
      reference: 'UTR8891',
      credit: 50_000,
      debit: 0,
    });

    // A row where the amount is in the OTHER column, so the column assignment
    // is doing real work rather than putting everything in one place.
    const charges = ledger.transactions.find((t) => t.particular === 'SERVICE CHARGES');
    expect(charges).toMatchObject({ debit: 500, credit: 0 });
  });

  it('keeps the closing balance line out of the last transaction', async () => {
    /*
     * Regression. A closing balance printed under the table has no date and
     * nothing in an amount column, so it looked like a wrapped fragment and was
     * glued onto the row above — producing a narration of "INTEREST CREDITED
     * (as on 30-Apr-2026): 10,32,700 Cr". The figures survived it; the narration
     * did not, and narration is what matching runs on.
     */
    const { rows, text } = await read(BANK);
    const ledger = parseRowsToLedger(rows, text, { name: 'Bank statement', filename: 'b.pdf' });

    expect(ledger.transactions.map((t) => t.particular)).toEqual([
      'NEFT CR INV001',
      'NEFT DR SUPPLIER',
      'CHQ CLG 4468',
      'SERVICE CHARGES',
      'CHQ CLG 4472',
      'INTEREST CREDITED',
    ]);
    expect(ledger.transactions.some((t) => /closing/i.test(t.particular))).toBe(false);
  });

  it('reads the other side of the pair too', async () => {
    const { rows, text } = await read(BOOKS);
    const ledger = parseRowsToLedger(rows, text, { name: 'Company books', filename: 'a.pdf' });

    expect(ledger.openingBalance).toBe(1_000_000);
    expect(ledger.transactions).toHaveLength(6);
    expect(ledger.transactions.map((t) => t.debit - t.credit)).toEqual([
      50_000, -10_000, -5_000, -500, -8_000, -2_000,
    ]);
  });
});
