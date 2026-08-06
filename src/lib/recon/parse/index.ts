import { MAX_FILE_MB } from '../config';
import type { Ledger } from '../types';
import { detectColumns, type ColumnMapping, type DetectedColumns } from './columns';
import { readPdf } from './pdf';
import { parseRowsToLedger, LedgerParseError } from './rows';
import { readCsv, readWorkbook, type RawSheet } from './sheet';

export { LedgerParseError } from './rows';
export { PdfParseError } from './pdf';
export type { RawSheet } from './sheet';

/**
 * A file, opened.
 *
 * All of this runs in the browser. That is a deliberate choice and not an
 * accident of where the code ended up: these are somebody's client bank
 * statements, and a tool that never uploads them has a much easier answer to
 * "where does our data go" than one that does. It also means there is no session
 * to keep on a server, no size limit beyond what the tab can hold, and nothing
 * to lose when the server restarts.
 */

/** The raw file, plus everything derived from it that survives a remapping. */
export type OpenedLedger = {
  ledger: Ledger;
  /** Kept so the columns can be reassigned without reading the file again. */
  raw: RawSheet;
  columns: DetectedColumns;
  filename: string;
};

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

/** Read a file into rows, whichever of the three formats it is. */
export async function readLedgerFile(file: File): Promise<RawSheet> {
  const extension = extensionOf(file.name);

  if (file.size === 0) {
    throw new LedgerParseError(`${file.name} is empty.`);
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new LedgerParseError(
      `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB, over the ${MAX_FILE_MB} MB ` +
        `limit. Split it by period and reconcile one period at a time.`,
    );
  }

  if (extension === '.xlsx' || extension === '.xlsm') {
    return readWorkbook(await file.arrayBuffer());
  }
  if (extension === '.csv') {
    return readCsv(await file.text());
  }
  if (extension === '.pdf') {
    return readPdf(await file.arrayBuffer());
  }
  if (extension === '.xls') {
    // The old binary format. Readable in principle, but every version of it is
    // a different format, and everything that can open one can save an .xlsx.
    throw new LedgerParseError(
      `${file.name} is in the old .xls format. Open it and save it again as .xlsx or CSV.`,
    );
  }

  throw new LedgerParseError(
    `${file.name} is not a format this can read. Use .xlsx, .csv or a text PDF.`,
  );
}

/** Read a file and interpret it as a ledger. */
export async function openLedger(file: File, name: string): Promise<OpenedLedger> {
  const raw = await readLedgerFile(file);
  const ledger = parseRowsToLedger(raw.rows, raw.text, { name, filename: file.name });
  return { ledger, raw, columns: detectColumns(raw.rows), filename: file.name };
}

/**
 * Read the same file again under a mapping the user confirmed.
 *
 * The point of this is not correcting a mistake. It is that the two files
 * usually disagree about what a column is called — "Voucher No" in one book and
 * "Reference No" in the other — and pointing both at `reference` is what lets
 * them match on it. Nothing is re-read from disk; the rows were kept.
 */
export function remapLedger(
  opened: OpenedLedger,
  mapping: ColumnMapping,
  name: string,
): Ledger {
  return parseRowsToLedger(opened.raw.rows, opened.raw.text, {
    name,
    filename: opened.filename,
    mapping,
  });
}
