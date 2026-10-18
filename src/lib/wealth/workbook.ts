import type * as XLSXType from 'xlsx';
import { GROUPS, HEADS, head } from './heads';
import { counted, isLiquid, summarise, takesNominee } from './calc';
import { checks } from './checks';
import { itemName, memberName, type Item, type WealthRecord } from './model';
import { ddmmyyyy, detailRows, nomineeLine } from './present';

/**
 * A wealth record as a workbook.
 *
 * Summary, then a sheet for what is owned and one for what is owed (one row
 * per entry, the same columns for every head so a filter or a pivot works),
 * Nominees (one row per nominee, so each person's shares can be totalled),
 * Checks, and the Method. Every detail typed into an entry is in a "Details"
 * column in the words the screen uses, because a head's fields differ and a
 * column per field would be a sheet of mostly empty cells.
 *
 * Amounts are numbers with Indian grouping and dates are real dates, so the
 * first things a reader does — total a column, sort by date — work. Account
 * numbers are in full: the workbook is the person's own copy of their own data.
 *
 * The xlsx module is passed in, so the screen loads it only when asked.
 */

const MONEY = '#,##,##0';
const DATE = 'dd/mm/yyyy';

type Cell = string | number | null;

function excelDate(iso: string): number | string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round(ms / 86_400_000) + 25569;
}

function format(sheet: XLSXType.WorkSheet, XLSX: typeof XLSXType, cols: number[], z: string, from = 1) {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  for (const c of cols) {
    for (let r = from; r <= range.e.r; r += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ c, r })];
      if (cell && typeof cell.v === 'number') cell.z = z;
    }
  }
}

function widths(sheet: XLSXType.WorkSheet, w: number[]) {
  sheet['!cols'] = w.map((wch) => ({ wch }));
}

function entryRows(items: Item[], record: WealthRecord): Cell[][] {
  return items.map((i) => {
    const spec = head(i.head);
    const counts = spec.counts(i.kind);
    return [
      spec.name,
      i.kind,
      itemName(i),
      memberName(record.profile, i.holder),
      counts ? i.value : null,
      counts ? i.share : null,
      counts ? counted(i) : null,
      counts && i.asOf ? excelDate(i.asOf) : null,
      spec.side === 'asset' ? (isLiquid(i) ? 'Yes' : 'No') : '',
      takesNominee(i) ? nomineeLine(i) : 'Not applicable',
      detailRows(i, record, false)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; '),
      i.notes.trim(),
    ];
  });
}

const ENTRY_HEADER = [
  'Head',
  'Type',
  'Entry',
  'Held by',
  'Value (₹)',
  'Share (%)',
  'Counted (₹)',
  'Value as on',
  'Liquid',
  'Nominee',
  'Details',
  'Notes',
];

export function buildWealthWorkbook(record: WealthRecord, today: string, XLSX: typeof XLSXType): XLSXType.WorkBook {
  const book = XLSX.utils.book_new();
  const sum = summarise(record);
  const p = record.profile;

  // ── Summary ──
  const summary: Cell[][] = [
    ['Wealth record', memberName(p, 'self')],
    ['Prepared on', excelDate(today)],
    [],
    ['Net worth (₹)', sum.net],
    ['Owned (₹)', sum.assets],
    ['Owed (₹)', sum.liabilities],
    ['Liquid (₹)', sum.liquid],
    ['Owed, as % of owned', sum.debtToAssets],
    ['EMIs a month (₹)', sum.monthlyEmi],
    ['Months liquid money would last', sum.monthsCovered],
    [],
    ['By class', 'Amount (₹)'],
    ...sum.groups.map((g) => [`${GROUPS[g.id].name} (${GROUPS[g.id].side === 'asset' ? 'owned' : 'owed'})`, g.total]),
    [],
    ['By head', 'Amount (₹)', 'Entries'],
    ...sum.heads.map((h) => [head(h.id).name, h.total, h.count]),
    [],
    ['Household', p.members.map((m) => `${memberName(p, m.id)}${m.id === 'self' ? '' : m.relation ? ` (${m.relation})` : ''}`).join(', ')],
    ['Will', p.will === 'yes' ? 'Yes, signed' : p.will === 'drafting' ? 'Being drafted' : p.will === 'no' ? 'No will' : 'Not recorded'],
    ['Will kept at', p.willKept],
    ['Executor', p.executor],
    ['Knows about this record', p.trusted],
    ['Emergency contact', p.emergency],
    ['Nominees in place', `${sum.nominees.yes} of ${sum.nominees.applicable} entries that take one`],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  format(summarySheet, XLSX, [1], MONEY, 3);
  const prepared = summarySheet['B2'];
  if (prepared && typeof prepared.v === 'number') prepared.z = DATE;
  for (const r of [7, 9]) {
    const cell = summarySheet[XLSX.utils.encode_cell({ c: 1, r })];
    if (cell && typeof cell.v === 'number') cell.z = '0.0';
  }
  widths(summarySheet, [34, 40, 10]);
  XLSX.utils.book_append_sheet(book, summarySheet, 'Summary');

  // ── Owned / owed ──
  for (const [side, title] of [
    ['asset', 'What you own'],
    ['liability', 'What you owe'],
  ] as const) {
    const order = new Map(HEADS.map((h, n) => [h.id, n]));
    const items = record.items.filter((i) => head(i.head).side === side).sort((a, b) => (order.get(a.head) ?? 0) - (order.get(b.head) ?? 0));
    const rows = entryRows(items, record);
    const total = rows.reduce((t, r) => t + (typeof r[6] === 'number' ? r[6] : 0), 0);
    const sheet = XLSX.utils.aoa_to_sheet([ENTRY_HEADER, ...rows, [], ['Total', '', '', '', null, null, total]]);
    format(sheet, XLSX, [4, 6], MONEY);
    format(sheet, XLSX, [7], DATE);
    widths(sheet, [26, 18, 34, 16, 14, 9, 14, 12, 8, 34, 80, 40]);
    XLSX.utils.book_append_sheet(book, sheet, title);
  }

  // ── Nominees ──
  const nomineeRows: Cell[][] = [];
  for (const i of record.items.filter(takesNominee)) {
    const people = i.nominee.status === 'yes' ? i.nominee.people.filter((n) => n.name.trim()) : [];
    if (people.length === 0) {
      nomineeRows.push([itemName(i), head(i.head).name, memberName(p, i.holder), nomineeLine(i), '', '', '', '', '']);
      continue;
    }
    for (const n of people) {
      nomineeRows.push([
        itemName(i),
        head(i.head).name,
        memberName(p, i.holder),
        n.name.trim(),
        n.relation,
        n.dob ? excelDate(n.dob) : null,
        people.length > 1 && n.share.trim() ? Number(n.share.replace('%', '')) || n.share : people.length === 1 ? 100 : null,
        n.guardian,
        n.phone,
      ]);
    }
  }
  const nomineeSheet = XLSX.utils.aoa_to_sheet([
    ['Entry', 'Head', 'Held by', 'Nominee', 'Relation', 'Date of birth', 'Share (%)', 'Guardian', 'Phone'],
    ...nomineeRows,
  ]);
  format(nomineeSheet, XLSX, [5], DATE);
  widths(nomineeSheet, [34, 26, 16, 24, 14, 13, 10, 20, 16]);
  XLSX.utils.book_append_sheet(book, nomineeSheet, 'Nominees');

  // ── Checks ──
  const findings = checks(record, today);
  const checkSheet = XLSX.utils.aoa_to_sheet([
    ['Level', 'Check', 'What to do'],
    ...findings.map((f) => [f.severity === 'act' ? 'Act on this' : f.severity === 'review' ? 'Review' : 'Good to know', f.title, f.detail]),
    ...(findings.length === 0 ? [['', 'Nothing to check on ' + ddmmyyyy(today), '']] : []),
  ]);
  widths(checkSheet, [12, 60, 100]);
  XLSX.utils.book_append_sheet(book, checkSheet, 'Checks');

  // ── Method ──
  const method = XLSX.utils.aoa_to_sheet([
    ['How the figures are worked out'],
    ['Net worth is what is owned less what is owed. Each entry counts at its value multiplied by the share in the Share column.'],
    ['An entry with no value adds nothing, and is listed under Checks.'],
    ['Term life and health policies add nothing to net worth: they pay out only on a claim.'],
    ['Liquid means it could be cash within days: bank balances, most deposits, listed shares, most mutual funds and cash at home.'],
    ['Values are as entered on the dates shown. Nothing is projected, converted or adjusted for tax. This is a record, not a valuation or advice.'],
  ]);
  widths(method, [120]);
  XLSX.utils.book_append_sheet(book, method, 'Method');

  return book;
}
