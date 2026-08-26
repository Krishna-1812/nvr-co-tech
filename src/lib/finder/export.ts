import * as XLSX from 'xlsx';
import { VERIFY_LABELS } from './verify';

/**
 * The file, and the four things a file gets wrong that a screen does not.
 *
 * A spreadsheet outlives the session that made it. It gets filtered, mail-merged
 * and pasted into a CRM months later by somebody who was not there when it was
 * downloaded, and every qualification the screen carried in a tooltip or a badge
 * is gone by then. So the file has to state in columns what the screen states in
 * chrome — which is why three of the columns below are derived rather than
 * stored, and why two headers name their unit.
 *
 * Rows come from the browser rather than being re-queried, so exporting a
 * selection costs nothing and contains exactly what somebody ticked, including
 * enrichment they have already paid for.
 */

/** Each column: the row key it reads, and the header it prints. */
type Column = readonly [key: string, header: string];

export const PERSON_COLUMNS: readonly Column[] = [
  ['full_name', 'Name'],
  /*
   * On screen a masked surname sits beside a badge and a tooltip. In a file it
   * was just the name — "Vivek Sh***a" under a header called Name, with nothing
   * to say it is incomplete. The raw value stays as Apollo returned it, because
   * the asterisked form still tells two same-first-name people apart.
   */
  ['name_withheld', 'Surname withheld by Apollo'],
  ['title', 'Title'],
  ['seniority', 'Seniority'],
  // Both read off the title rather than returned by Apollo, and labelled that
  // way: a column called "Seniority" holding a value Apollo never asserted is
  // exactly the kind of quiet fiction a spreadsheet carries forever.
  ['seniority_from_title', 'Seniority (from title)'],
  ['functions_from_title', 'Function (from title)'],
  ['email', 'Email'],
  ['email_status', 'Email status'],
  ['phones', 'Phone'],
  /*
   * An empty Email means one of two entirely different things: nobody has spent
   * a credit on this person, or a credit was spent and Apollo holds no address.
   * The card distinguishes them with a Reveal button; the file could not, so
   * every blank read as "Apollo has nothing".
   */
  ['contact_revealed', 'Contact details revealed'],
  ['city', 'City'],
  ['state', 'State'],
  ['country', 'Country'],
  ['departments', 'Departments'],
  ['past_companies', 'Previous companies'],
  ['linkedin_url', 'LinkedIn'],
  ['organization_name', 'Company'],
  ['organization_domain', 'Domain'],
  ['organization_industry', 'Industry'],
  ['organization_employees', 'Company employees'],
  ['organization_revenue', 'Company revenue'],
  ['organization_funding', 'Company total funding'],
  ['organization_founded', 'Company founded'],
  ['organization_ticker', 'Company ticker'],
  ['organization_city', 'Company city'],
  ['organization_state', 'Company state'],
  ['organization_country', 'Company country'],
  ['organization_phone', 'Company phone'],
  // On the card this is "+19% headcount", one of the strongest buying signals
  // the free tier gives away, and the file had no column for it at all.
  ['organization_growth6', 'Company headcount growth 6mo %'],
  ['organization_growth12', 'Company headcount growth 12mo %'],
  ['organization_technologies', 'Company technologies'],
  ['organization_keywords', 'Company keywords'],
  ['organization_description', 'Company description'],
  ['organization_website', 'Company website'],
  ['organization_linkedin', 'Company LinkedIn'],
  ['id', 'Apollo ID'],
];

export const COMPANY_COLUMNS: readonly Column[] = [
  ['name', 'Company'],
  ['primary_domain', 'Domain'],
  ['industry', 'Industry'],
  ['industries', 'Other industries'],
  ['estimated_num_employees', 'Employees'],
  ['annual_revenue', 'Annual revenue'],
  ['revenue_printed', 'Revenue (as Apollo prints it)'],
  ['growth6', 'Headcount growth 6mo %'],
  ['growth12', 'Headcount growth 12mo %'],
  ['total_funding', 'Total funding'],
  ['latest_funding_round_date', 'Latest round'],
  ['founded_year', 'Founded'],
  ['publicly_traded_symbol', 'Ticker'],
  ['phone', 'Phone'],
  ['city', 'City'],
  ['state', 'State'],
  ['country', 'Country'],
  ['raw_address', 'Address'],
  ['technologies', 'Technologies'],
  ['keywords', 'Keywords'],
  ['short_description', 'Description'],
  ['website_url', 'Website'],
  ['linkedin_url', 'LinkedIn'],
  ['twitter_url', 'X / Twitter'],
  ['id', 'Apollo ID'],
];

/**
 * A value that is only digits and phone punctuation.
 *
 * A leading `=`, `+`, `-` or `@` makes a spreadsheet treat a cell as a formula,
 * so third-party text has to be defused. But phone numbers legitimately start
 * with `+` and negative figures with `-`, and quoting those puts a stray
 * apostrophe in every phone column. So a value matching this is left alone;
 * anything carrying letters or a pipe — `=cmd|…`, `+HYPERLINK(…)`, a DDE payload
 * — still gets the apostrophe.
 */
const NUMERIC_CELL = /^[+-]?[\d\s().+\-/]+$/;

/** Flatten one value to a string, and defuse formula injection. */
export function csvSafe(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  const flat = Array.isArray(value)
    ? value.filter((v) => v !== null && v !== undefined && v !== '').map(String).join(', ')
    : String(value);
  if (/^[=+\-@]/.test(flat) && !NUMERIC_CELL.test(flat)) return `'${flat}`;
  return flat;
}

/**
 * The two columns Apollo returns as a fraction.
 *
 * 0.19 is 19%. These once dumped the fraction raw under a header with no unit,
 * so a card reading "+19%" exported as "0.19" while a sibling workbook reading
 * the same Apollo field wrote 19.0 under a header ending in "%". Three
 * renderings of one number. The headers above name the unit; this matches them.
 */
const PERCENT_COLUMNS = new Set([
  'growth6',
  'growth12',
  'organization_growth6',
  'organization_growth12',
]);

export function exportPercent(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  // Anything unparseable is left exactly as Apollo sent it rather than being
  // silently dropped: a value we cannot read is still a value somebody may need.
  if (!Number.isFinite(n)) return csvSafe(value);
  const pct = n * 100;
  return Number.isInteger(pct) ? String(pct) : String(Math.round(pct * 10) / 10);
}

/**
 * One cell, including the three columns that are derived rather than stored.
 *
 * `name_withheld` is derived FROM the row rather than trusted from it: the flag
 * is read where it exists, and an asterisk in the name counts as proof on its
 * own — so a row saved to history before the flag existed still exports
 * honestly.
 */
export function exportCell(row: Record<string, unknown>, key: string): string {
  if (key === 'name_withheld') {
    const masked = Boolean(row.name_masked) || String(row.full_name ?? '').includes('*');
    return masked ? 'Yes, reveal to see it' : '';
  }
  if (key === 'contact_revealed') {
    const has = row.enriched || row.email || (Array.isArray(row.phones) && row.phones.length > 0);
    return has ? 'Yes' : 'No, not revealed';
  }
  if (PERCENT_COLUMNS.has(key)) return exportPercent(row[key]);
  return csvSafe(row[key]);
}

// ─── The "Search details" sheet ──────────────────────────────────────────────

/**
 * Keys that travel with the filters but constrain nothing.
 *
 * Internal page-size caps, which the sheet already covers with "Rows in this
 * file", plus the history drawer's own bookkeeping — what an entry cost, how
 * much came from cache, and the key that stops one contact being saved twice.
 * A reader would take any of them for a constraint on the search, which none is.
 *
 * `company_detail` is deliberately NOT here. It is not a filter either, but it
 * is the reason one file has employer columns and another has them blank, which
 * is a question a reader of an old spreadsheet really does ask.
 */
const NON_FILTERS = new Set([
  'max_people',
  'max_companies',
  'credits',
  'from_cache',
  'dedupe',
  // The panel's own state, stored alongside so reopening a saved search puts
  // the controls back exactly where they were. It is the same information the
  // filters already carry, in the shape the form speaks rather than the shape
  // Apollo does, and printing both would list every constraint twice.
  'panel',
]);

/** Only the keys where the generic rule gets it wrong. */
const FILTER_LABELS: Readonly<Record<string, string>> = {
  naics_codes: 'NAICS codes',
  exclude_naics_codes: 'NAICS codes excluded',
  sic_codes: 'SIC codes',
  exclude_sic_codes: 'SIC codes excluded',
  company_domains: 'At company (name or domain)',
  domains: 'Domain',
  locations: 'HQ location',
  exclude_locations: 'HQ location excluded',
  company_locations: 'Employer HQ location',
  person_locations: 'Person location',
  employee_min: 'Employees from',
  employee_max: 'Employees up to',
  revenue_min: 'Revenue from',
  revenue_max: 'Revenue up to',
  technologies_all: 'Uses ALL of these technologies',
  exclude_technologies: 'Does not use these technologies',
  include_similar_titles: 'Similar titles included',
  days_in_title_min: 'Days in current role, from',
  days_in_title_max: 'Days in current role, up to',
  linkedin_urls: 'LinkedIn profile URLs',
  organization_ids: 'Scoped to specific companies',
  // Not a constraint on which rows came back, only on how much was fetched about
  // each one, so it is labelled as the fetch it is.
  company_detail: 'Employer details fetched',
};

/**
 * The filters as a person would say them.
 *
 * Two things it deliberately does not do. It does not list keys that are not
 * filters, because the sheet is read as the search's constraints. And it never
 * prints Apollo organisation ids: a company-scoped search is the commonest
 * scoped search there is, and a column of 24-character hex tells the reader
 * nothing about WHICH company, which is precisely the question this sheet
 * exists to answer.
 */
export function filtersReadable(
  filters: Record<string, unknown>,
): [label: string, value: string][] {
  const out: [string, string][] = [];

  for (const [key, raw] of Object.entries(filters ?? {})) {
    if (NON_FILTERS.has(key)) continue;
    if (raw === null || raw === undefined || raw === '') continue;
    if (Array.isArray(raw) && raw.length === 0) continue;

    if (key === 'organization_ids') {
      const ids = (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
      if (ids.length === 0) continue;
      out.push([
        FILTER_LABELS[key],
        `${ids.length} ${ids.length === 1 ? 'company' : 'companies'}, resolved by name`,
      ]);
      continue;
    }

    let value: string;
    if (Array.isArray(raw)) {
      value = raw.filter((v) => v !== null && v !== undefined && v !== '').map(String).join(', ');
    } else if (typeof raw === 'boolean') {
      value = raw ? 'Yes' : 'No';
    } else if (typeof raw === 'object') {
      value = Object.entries(raw as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join('; ');
    } else {
      value = String(raw);
    }
    if (!value) continue;

    const label =
      FILTER_LABELS[key] ??
      key.replace(/_/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
    out.push([label, value]);
  }

  return out;
}

// ─── Building the files ──────────────────────────────────────────────────────

export type ExportMeta = {
  total?: number | null;
  rejected?: Record<string, number>;
  label?: string;
};

export type ExportRequest = {
  entity: 'people' | 'companies';
  rows: Record<string, unknown>[];
  filters: Record<string, unknown>;
  meta: ExportMeta;
};

/** Every other client-supplied collection here is capped; this one was not. */
export const EXPORT_ROW_CAP = 5000;

export function columnsFor(entity: string): readonly Column[] {
  return entity === 'companies' ? COMPANY_COLUMNS : PERSON_COLUMNS;
}

/**
 * A flat, re-importable table.
 *
 * With a byte-order mark, because without it Excel opens a UTF-8 file as the
 * system codepage and every accented name in it becomes mojibake.
 */
export function buildCsv(req: ExportRequest): string {
  const columns = columnsFor(req.entity);
  const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const lines = [columns.map(([, header]) => quote(header)).join(',')];
  for (const row of req.rows) {
    lines.push(columns.map(([key]) => quote(exportCell(row, key))).join(','));
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Rough width from the widest value in a column, clamped to something sane. */
function widthFor(header: string, values: string[]): number {
  const longest = values.reduce((max, v) => Math.max(max, v.length), header.length);
  return Math.min(Math.max(longest + 2, 10), 46);
}

/**
 * The workbook: the rows, and — where a search produced them — a second sheet
 * saying what search that was.
 *
 * The second sheet exists on .xlsx only. A .csv stays a flat re-importable table
 * rather than growing a mismatched header block above its own columns.
 */
export function buildWorkbook(req: ExportRequest): XLSX.WorkBook {
  const columns = columnsFor(req.entity);
  const body = req.rows.map((row) => columns.map(([key]) => exportCell(row, key)));

  const sheet = XLSX.utils.aoa_to_sheet([columns.map(([, header]) => header), ...body]);

  sheet['!cols'] = columns.map(([, header], c) =>
    ({ wch: widthFor(header, body.map((row) => row[c] ?? '')) }),
  );
  sheet['!freeze'] = { xSplit: '0', ySplit: '1', topLeftCell: 'A2', activePane: 'bottomLeft' };
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range(
      { c: 0, r: 0 },
      { c: columns.length - 1, r: Math.max(body.length, 1) },
    ),
  };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, req.entity === 'companies' ? 'Companies' : 'People');

  const readable = filtersReadable(req.filters);
  const hasMeta = Object.keys(req.meta ?? {}).length > 0;

  if (readable.length > 0 || hasMeta) {
    const details: [string, string][] = [
      ['Looking for', req.entity === 'companies' ? 'Companies' : 'People'],
      ['Rows in this file', String(req.rows.length)],
    ];
    if (req.meta.total != null) details.push(['Total matches in Apollo', String(req.meta.total)]);

    /*
     * The rows Apollo returned that the filters were then enforced against.
     * Without this the file looks like everything Apollo offered, when it is
     * deliberately less — and that difference is the whole point of the
     * verification pass.
     */
    const rejected = req.meta.rejected ?? {};
    for (const [reason, n] of Object.entries(rejected).sort(
      ([a, x], [b, y]) => (y ?? 0) - (x ?? 0) || a.localeCompare(b),
    )) {
      if (!n) continue;
      details.push([`Removed on checking: ${VERIFY_LABELS[reason] ?? reason}`, String(n)]);
    }

    if (req.meta.label) details.push(['Saved search', req.meta.label]);
    details.push([
      'Exported',
      new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' IST',
    ]);
    details.push(...readable);

    const second = XLSX.utils.aoa_to_sheet([
      ['Field', 'Value'],
      ...details.map(([label, value]) => [csvSafe(label), csvSafe(value)]),
    ]);
    second['!cols'] = [{ wch: 26 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(book, second, 'Search details');
  }

  return book;
}

export function buildXlsx(req: ExportRequest): Buffer {
  return XLSX.write(buildWorkbook(req), { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** `contact-finder-people-2026-08-27-1410.xlsx`. */
export function exportFilename(entity: string, format: string): string {
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
  const stamp = `${now.slice(0, 10)}-${now.slice(11, 13)}${now.slice(14, 16)}`;
  return `contact-finder-${entity}-${stamp}.${format}`;
}
