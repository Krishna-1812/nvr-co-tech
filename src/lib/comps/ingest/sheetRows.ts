/**
 * A parsed sheet, turned into the rows `mcaMasterBatch` wants.
 *
 * `mcaMaster.ts` is explicit about whose job this is: "the caller unzips and
 * reads the CSV... and hands over `Record<string, string>` rows." `RawSheet`
 * from `src/lib/recon/parse/sheet.ts` is the reading half, already built and
 * already handling the quoted-comma cases a second parser would get wrong
 * again. This is the rest of it — the header row becomes keys, everything
 * below becomes one object per row — kept separate from the sheet reader
 * because that module has no reason to know MCA exists, and separate from
 * `mcaMaster.ts` because that module has no reason to know what a spreadsheet
 * is.
 */

import type { RawSheet } from '../../recon/parse/sheet';

/**
 * Rows per MCA batch, shared by the form that builds them and the action that
 * writes them.
 *
 * `upsert_company` is one Postgres round trip per company, and a batch has to
 * finish inside one web request's own timeout — the same constraint EDGAR and
 * NSE hit at 25 identifiers, just a smaller number here because each row is
 * cheaper to fetch but no faster to write. Living here rather than in the
 * server action is not a style choice: a `'use server'` file may only export
 * async functions, so a plain constant has nowhere to live there for the
 * client to import.
 */
export const MCA_BATCH_SIZE = 100;

/**
 * Identifiers per EDGAR/NSE batch, shared by the manual form, the full-universe
 * sync loop, and the action that runs them — same reasoning and the same
 * `'use server'` restriction as `MCA_BATCH_SIZE` above.
 */
export const MAX_ITEMS = 25;

/**
 * Rows keyed by header, blank rows dropped.
 *
 * A row shorter than the header (a trailing blank column MCA's export left
 * off) fills in with empty strings rather than dropping the row — `pick` in
 * `mcaMaster.ts` already treats an empty string as "not present" for every
 * column, so a short row loses only the columns it was actually missing,
 * not the row.
 */
export function sheetRowsToRecords(sheet: RawSheet): Record<string, string>[] {
  const [header, ...rows] = sheet.rows;
  if (!header) return [];

  return rows
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => {
      const record: Record<string, string> = {};
      header.forEach((key, i) => {
        if (key !== '') record[key] = row[i] ?? '';
      });
      return record;
    });
}

/**
 * Split into fixed-size chunks, the last one whatever is left over.
 *
 * Sized by the caller to whatever a single write can finish inside a request's
 * own time budget — see the comment on `MCA_BATCH_SIZE` where this is used for
 * why that number is small.
 */
export function batch<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
