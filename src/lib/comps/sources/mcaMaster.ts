/**
 * MCA company master data, from data.gov.in.
 *
 * The free bulk download of every company registered with the Registrar of
 * Companies — around 3.6 million rows, published as ZIPs of CSVs, one set per
 * state. It costs nothing, needs no key, and it is the whole universe this tool
 * searches. Nothing else in the stack is as cheap or as complete.
 *
 * ── This module takes rows, not files ─────────────────────────────────────
 *
 * The caller unzips and reads the CSV — with SheetJS, which is already a
 * dependency and already does this job in `src/lib/recon/parse/sheet.ts` — and
 * hands over `Record<string, string>` rows. Writing a second CSV parser here
 * would be a second place for a quoted comma to be got wrong.
 *
 * It also means the decisions in this file are pure and every one of them is
 * tested against a literal row, which matters more than usual because of the
 * next paragraph.
 *
 * ── Headers vary between files, so they are aliased, not assumed ──────────
 *
 * These files are published per state and per vintage, and the headers are not
 * stable across either: `CORPORATE_IDENTIFICATION_NUMBER` in one and `CIN` in
 * another, `PAIDUP_CAPITAL` and `PAIDUP_CAP`, `REGISTERED_STATE` and `STATE`.
 * So every column is looked up through an alias list against a normalised header
 * — uppercased with punctuation stripped — and a row whose CIN column cannot be
 * found is skipped with a reason naming what was looked for. That reason is how a
 * renamed column announces itself, rather than a run that loads three million
 * companies with no names.
 *
 * ── What is deliberately NOT mapped ───────────────────────────────────────
 *
 * `PRINCIPAL_BUSINESS_ACTIVITY` becomes `industry` and is **not** used to seed
 * `business_description`. That is the most important line in this file.
 *
 * Peer discovery embeds the business description, and it exists because industry
 * codes are too coarse to build a peer set from — one code holding cybersecurity,
 * gaming and enterprise software. Seeding the description with the category label
 * would make every company in a category embed to nearly the same vector, so the
 * nearest-neighbour search would return the industry code back with extra steps
 * and the whole reason for having embeddings would be gone. A real description
 * comes from an annual report, a DRHP or a 10-K, and until one arrives the column
 * stays null and the company is simply not a candidate for similarity search.
 */

import { parseCin } from './cin';
import type { CompanyRecord, Harvest, Skip } from './types';
import { emptyHarvest } from './types';

const SOURCE = 'mca_master' as const;

/** Where the bulk data lives, recorded so the provenance line can point at it. */
export const MCA_MASTER_URL = 'https://www.data.gov.in/catalog/company-master-data';

/**
 * Column aliases, most specific first.
 *
 * Compared against headers normalised by `normaliseHeader`, so
 * `Corporate Identification Number` and `CORPORATE_IDENTIFICATION_NUMBER` are the
 * same key and neither needs its own entry.
 */
const COLUMNS = {
  cin: ['CORPORATEIDENTIFICATIONNUMBER', 'CIN', 'COMPANYCIN', 'CINLLPIN'],
  name: ['COMPANYNAME', 'NAMEOFCOMPANY', 'COMPANY'],
  status: ['COMPANYSTATUS', 'COMPANYSTATUSFOREFILING', 'STATUS'],
  registeredOn: ['DATEOFREGISTRATION', 'DATEOFINCORPORATION', 'REGISTRATIONDATE'],
  state: ['REGISTEREDSTATE', 'STATE', 'REGISTEREDOFFICESTATE'],
  activity: [
    'PRINCIPALBUSINESSACTIVITYASPERCIN',
    'PRINCIPALBUSINESSACTIVITY',
    'INDUSTRIALCLASS',
    'NICCODEOFTHECOMPANY',
  ],
  companyClass: ['COMPANYCLASS', 'CLASS'],
} as const;

/** Uppercase, and drop everything that is not a letter or a digit. */
export function normaliseHeader(header: string): string {
  return header.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** A row with its headers normalised once, so lookups are cheap. */
export type NormalisedRow = Record<string, string>;

/** Normalise a raw row's keys. Values are trimmed; blanks become ''. */
export function normaliseRow(row: Record<string, unknown>): NormalisedRow {
  const out: NormalisedRow = {};
  for (const [key, value] of Object.entries(row)) {
    out[normaliseHeader(key)] = value === null || value === undefined ? '' : String(value).trim();
  }
  return out;
}

/** The first alias that is present and non-empty, or null. */
function pick(row: NormalisedRow, aliases: readonly string[]): string | null {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== '') return value;
  }
  return null;
}

/**
 * Company statuses that mean the company still exists as a going concern.
 *
 * Everything else — struck off, dissolved, amalgamated, converted to an LLP,
 * under liquidation — is a company that cannot be a comparable, because whatever
 * multiple it once traded at describes a business that is not there any more.
 * Those rows are skipped with the status as the reason, which is also how the
 * ingest log ends up reporting roughly how much of the register is dormant.
 */
const LIVE_STATUSES = new Set(['ACTIVE', 'ACTIVEINPROGRESS', 'DORMANTUNDER455', 'NOTAVAILABLEFOREFILING']);

/**
 * Whether a status counts as live.
 *
 * `NOT AVAILABLE FOR EFILING` is included, and it is the one that deserves a
 * note: it means the MCA's own portal cannot accept filings for the company,
 * usually because the record predates a migration. It does not mean the company
 * has stopped trading, and excluding it would drop a slice of older, larger
 * companies — exactly the ones most likely to be somebody's comparable.
 */
export function isLiveStatus(status: string | null): boolean {
  if (!status) return true; // No status column at all: not a reason to drop a row.
  return LIVE_STATUSES.has(normaliseHeader(status));
}

/**
 * A date from an MCA file, as ISO `yyyy-mm-dd`.
 *
 * These arrive as `18-05-2005`, `18/05/2005`, `18-MAY-2005` and occasionally
 * already as ISO. **Day comes first**, which is the MCA's convention and is
 * assumed rather than detected — there is no way to tell `01-02-2005` apart
 * otherwise, and guessing per row would put some companies a month out from
 * their neighbours in the same file.
 *
 * A row that does not fit any of those shapes returns null rather than a partial
 * date. An incorporation year is used to filter and to display, and a wrong one
 * is worse than a missing one.
 */
export function parseMcaDate(raw: string | null): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (text === '') return null;

  // Already ISO.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return validIso(iso[1], iso[2], iso[3]);

  // Day first, numeric month.
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text);
  if (dmy) {
    return validIso(dmy[3], dmy[2].padStart(2, '0'), dmy[1].padStart(2, '0'));
  }

  // Day first, three-letter month.
  const dMy = /^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{4})$/.exec(text);
  if (dMy) {
    const month = MONTHS[dMy[2].toUpperCase()];
    if (!month) return null;
    return validIso(dMy[3], month, dMy[1].padStart(2, '0'));
  }

  return null;
}

const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

/**
 * Assemble an ISO date only if it is a real one.
 *
 * `31-02-2005` parses happily as three numbers and is not a date. Checking it by
 * round-tripping through UTC catches that, and catches a February the 29th in a
 * year that had none — which turns up in this data more often than it should.
 */
function validIso(year: string, month: string, day: string): string | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const stamp = Date.UTC(y, m - 1, d);
  const back = new Date(stamp);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

/** What one row became. */
export type RowOutcome = { company: CompanyRecord } | { skip: Skip };

/**
 * Map one row.
 *
 * `at` identifies the row in the skip log — the CIN where there is one, otherwise
 * whatever the caller passes for the row number. A skip that cannot say which row
 * it was is not much use when the file has three million of them.
 */
export function mcaMasterRow(raw: Record<string, unknown>, at: string): RowOutcome {
  const row = normaliseRow(raw);

  const rawCin = pick(row, COLUMNS.cin);
  if (!rawCin) {
    return {
      skip: {
        at,
        reason: `No CIN column found. Looked for: ${COLUMNS.cin.join(', ')}`,
      },
    };
  }

  const cin = parseCin(rawCin);
  if (!cin) {
    return { skip: { at, reason: `Not a well-formed CIN: ${JSON.stringify(rawCin)}` } };
  }

  const name = pick(row, COLUMNS.name);
  if (!name) {
    return { skip: { at: cin.cin, reason: 'No company name in the row' } };
  }

  const status = pick(row, COLUMNS.status);
  if (!isLiveStatus(status)) {
    return {
      skip: {
        at: cin.cin,
        reason: `Company status is ${status}, so it cannot be a comparable`,
      },
    };
  }

  return {
    company: {
      name,
      cin: cin.cin,
      country: 'IN',
      /*
       * From the CIN's first letter. A hint, not the truth — an exchange record
       * beats it, which is why master data must be loaded BEFORE exchange data.
       * See the header of cin.ts: reversed, a bulk pass here would relabel every
       * listed company in the registry as unlisted.
       */
      listing_status: cin.listed ? 'listed' : 'unlisted',
      incorporated_on: parseMcaDate(pick(row, COLUMNS.registeredOn)),
      /*
       * The CIN's own state wins over the column when they disagree. The column
       * is the registered office's state and can be updated; the CIN records the
       * registrar that issued it, which is what the filings are actually with.
       */
      registered_state: cin.state ?? pick(row, COLUMNS.state),
      nic_code: cin.industryCode,
      industry: pick(row, COLUMNS.activity),
      /*
       * Left null on purpose. Seeding it with the industry label would make the
       * embeddings a re-encoding of the industry code — see the header.
       */
      business_description: null,
      source: SOURCE,
      source_url: MCA_MASTER_URL,
    },
  };
}

/**
 * Map a batch of rows.
 *
 * Batches, not whole files: three and a half million rows will not fit in memory
 * as objects, and a skip list of two million dormant companies is not a report
 * anybody reads. The caller streams the CSV, calls this per chunk, writes the
 * companies through `upsert_company` and tallies the skips by reason.
 */
export function mcaMasterBatch(
  rows: readonly Record<string, unknown>[],
  { firstRowNumber = 1 }: { firstRowNumber?: number } = {},
): Harvest {
  const harvest = emptyHarvest();

  rows.forEach((raw, i) => {
    const outcome = mcaMasterRow(raw, `row ${firstRowNumber + i}`);
    if ('company' in outcome) harvest.companies.push(outcome.company);
    else harvest.skipped.push(outcome.skip);
  });

  return harvest;
}

/**
 * Count skips by reason, for the ingest log.
 *
 * Reasons that quote the offending value are grouped with the value elided, so
 * three hundred thousand malformed CINs become one line saying three hundred
 * thousand rather than three hundred thousand lines saying one. Truncating
 * instead would not have worked: `Not a well-formed CIN: "AAAA"` is twenty-nine
 * characters, so any sane cut-off keeps the values apart and the report is again
 * as long as the problem.
 *
 * Reasons that name a category rather than a value — a company status, a missing
 * column — carry no quotes and stay distinct, which is the point: "STRIKE OFF"
 * and "AMALGAMATED" are different facts about the register and worth counting
 * separately.
 */
export function tallySkips(skips: readonly Skip[]): { reason: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const skip of skips) {
    const key = skip.reason.replace(/"[^"]*"/g, '"…"');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

export const MCA_MASTER = {
  id: SOURCE,
  label: 'MCA company master data (data.gov.in)',
  politeness: {
    // A bulk file, downloaded once. There is no per-request budget to respect.
    requestsPerSecond: 1,
  },
} as const;
