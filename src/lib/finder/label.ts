/**
 * A saved search, named in a line.
 *
 * The drawer is a list of lines, so the line has to carry the search. This reads
 * **every** filter that narrows it, not a chosen few: the version it replaces
 * read nine keys out of fifty, so a search by NAICS code, technology, revenue
 * band or funding was labelled "All people" — a drawer full of entries all
 * claiming to be the same unfiltered search, none of which was.
 */

/** List-shaped filters worth naming, each with the word that makes it read. */
const LISTS: readonly (readonly [string, string])[] = [
  ['titles', ''],
  ['seniorities', ''],
  ['industries', ''],
  ['keywords', ''],
  ['name', ''],
  ['naics_codes', 'NAICS '],
  ['sic_codes', 'SIC '],
  ['technologies', 'uses '],
  ['technologies_all', 'uses '],
  ['market_segments', ''],
  ['job_titles', 'hiring '],
  ['email_status', ''],
];

/**
 * Places, most specific first, and **only one of them**.
 *
 * A line listing the company, its country and the person's country reads as
 * three filters when it is one search.
 */
const PLACES = [
  'company_domains',
  'domains',
  'person_locations',
  'locations',
  'company_locations',
] as const;

/**
 * Range pairs. The fourth field is whether to compact the number: a year is not
 * compacted, because "founded 2K-2K" is what happens when every number goes
 * through the same shortener.
 */
const SPANS: readonly (readonly [string, string, string, boolean, string])[] = [
  ['employee_min', 'employee_max', '', true, '%s employees'],
  ['revenue_min', 'revenue_max', '', true, '%s revenue'],
  ['total_funding_min', 'total_funding_max', '', true, '%s funding'],
  ['founded_min', 'founded_max', '', false, 'founded %s'],
  ['headcount_growth_min', 'headcount_growth_max', '%', true, '%s headcount growth'],
];

/**
 * 1200000 to "1.2M".
 *
 * The same compaction the cards use, so a label reads the way the screen does
 * rather than spelling out eight digits in a drawer line.
 */
export function labelNum(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  for (const [size, suffix] of [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ] as const) {
    if (Math.abs(n) >= size) return `${(n / size).toFixed(1).replace('.0', '')}${suffix}`;
  }
  return Number.isInteger(n) ? String(n) : String(n);
}

/** "50-200", "20%+" or "under 200" for a pair of range filters. */
export function labelSpan(
  filters: Record<string, unknown>,
  loKey: string,
  hiKey: string,
  unit = '',
  compact = true,
): string {
  const blank = (v: unknown) => v === null || v === undefined || v === '';
  const lo = filters[loKey];
  let hi = filters[hiKey];

  /*
   * The employee filter's top bucket is open-ended and carries a sentinel rather
   * than nothing, so it has to read as "no upper bound" and not as 999999999.
   */
  if (!blank(hi) && typeof hi === 'number' && hi >= 999_999_999) hi = null;

  if (blank(lo) && blank(hi)) return '';

  const num = compact ? labelNum : (v: unknown) => String(v ?? '');
  // The unit goes on whichever number ends the phrase, which is where it reads.
  if (blank(hi)) return `${num(lo)}${unit}+`;
  if (blank(lo)) return `under ${num(hi)}${unit}`;
  return `${num(lo)}-${num(hi)}${unit}`;
}

export function historyLabel(entity: string, filters: Record<string, unknown>): string {
  const f = filters ?? {};
  const parts: string[] = [];

  const words = (value: unknown): string[] => {
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    if (!Array.isArray(value)) return [];
    return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  };

  for (const [key, prefix] of LISTS) {
    const vals = words(f[key]);
    if (vals.length > 0) parts.push(prefix + vals.slice(0, 3).join(', '));
  }

  for (const key of PLACES) {
    const vals = words(f[key]);
    if (vals.length > 0) {
      parts.push(vals[0]);
      break;
    }
  }

  for (const [lo, hi, unit, compact, shape] of SPANS) {
    const span = labelSpan(f, lo, hi, unit, compact);
    if (span) parts.push(shape.replace('%s', span));
  }

  if (parts.length === 0 && Array.isArray(f.organization_ids) && f.organization_ids.length > 0) {
    // A pinned company has no readable name in the filters, only its Apollo id,
    // so say what the search was scoped to rather than printing the id.
    parts.push('one specific company');
  }

  const label = parts.join(' · ').slice(0, 160);
  return label || (entity === 'companies' ? 'All companies' : 'All people');
}
