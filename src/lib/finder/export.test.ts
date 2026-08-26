import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  COMPANY_COLUMNS,
  PERSON_COLUMNS,
  buildCsv,
  buildWorkbook,
  csvSafe,
  exportCell,
  exportPercent,
  filtersReadable,
} from './export';
import { historyLabel, labelSpan } from './label';

/**
 * The file, and the things a screen says that a file used not to.
 *
 * A spreadsheet is opened months later by somebody who was not there when it
 * was downloaded. Every qualification the screen carried in a badge or a
 * tooltip is gone by then, so the file has to state them in columns — and every
 * test here is one such statement that was once missing.
 */

describe('defusing a spreadsheet formula', () => {
  it('quotes text that would execute, including a DDE payload', () => {
    expect(csvSafe('=cmd|/c calc')).toBe("'=cmd|/c calc");
    expect(csvSafe('+HYPERLINK("http://x","click")')).toBe('\'+HYPERLINK("http://x","click")');
    expect(csvSafe('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  /*
   * Phone numbers legitimately start with "+" and negative figures with "-".
   * Quoting those put a stray apostrophe in every phone column, in every file.
   */
  it('leaves a phone number and a negative figure exactly as they are', () => {
    expect(csvSafe('+91 80 4718 1000')).toBe('+91 80 4718 1000');
    expect(csvSafe('-12.5')).toBe('-12.5');
  });

  it('flattens a list without losing the separator', () => {
    expect(csvSafe(['Sales', 'Marketing', ''])).toBe('Sales, Marketing');
  });
});

describe('the three columns derived rather than stored', () => {
  /*
   * On screen a masked surname sits beside a badge. In a file it was just the
   * name, under a header called Name, with nothing to say it is incomplete.
   */
  it('reads a masked surname off the name itself, not only off the flag', () => {
    // No `name_masked` on this row at all — as on a row saved to history before
    // the flag existed. The asterisk is proof on its own.
    expect(exportCell({ full_name: 'Vivek Sh***a' }, 'name_withheld')).toMatch(/^Yes/);
    expect(exportCell({ full_name: 'Vivek Sharma' }, 'name_withheld')).toBe('');
  });

  /*
   * An empty Email means one of two entirely different things: nobody spent a
   * credit on this person, or a credit was spent and Apollo holds no address.
   */
  it('tells an unrevealed row apart from a revealed one with no address', () => {
    expect(exportCell({ enriched: true }, 'contact_revealed')).toBe('Yes');
    expect(exportCell({}, 'contact_revealed')).toBe('No, not revealed');
  });

  it('prints growth as the percent its header promises', () => {
    expect(exportPercent(0.19)).toBe('19');
    expect(exportPercent(0.1934)).toBe('19.3');
    expect(exportPercent(0)).toBe('0');
  });

  it('leaves an unreadable growth value alone rather than dropping it', () => {
    expect(exportPercent('about a fifth')).toBe('about a fifth');
    expect(exportPercent(null)).toBe('');
  });
});

describe('the search details sheet', () => {
  it('never prints an Apollo organisation id, which answers nothing', () => {
    const pairs = filtersReadable({ organization_ids: ['5f3a1b2c3d4e5f6a7b8c9d0e'] });
    expect(pairs).toEqual([['Scoped to specific companies', '1 company, resolved by name']]);
  });

  it('leaves out the drawer bookkeeping that is not a filter', () => {
    const pairs = filtersReadable({ credits: 4, from_cache: 2, dedupe: 'x', panel: { a: 1 } });
    expect(pairs).toEqual([]);
  });

  /*
   * Not a filter either, but it is the reason one file has employer columns and
   * another has them blank, which a reader of an old spreadsheet really does ask.
   */
  it('keeps the employer-detail switch, labelled as the fetch it is', () => {
    expect(filtersReadable({ company_detail: true })).toEqual([
      ['Employer details fetched', 'Yes'],
    ]);
  });

  it('only exists on the workbook, never on the flat table', () => {
    const req = {
      entity: 'people' as const,
      rows: [{ full_name: 'Ada' }],
      filters: { titles: ['CMO'] },
      meta: { total: 40 },
    };
    const book = buildWorkbook(req);
    expect(book.SheetNames).toEqual(['People', 'Search details']);

    const csv = buildCsv(req);
    expect(csv).not.toContain('Search details');
    expect(csv.split('\r\n')).toHaveLength(3); // header, one row, trailing blank
  });

  it('says how many rows were removed on checking, and why', () => {
    const book = buildWorkbook({
      entity: 'people',
      rows: [{ full_name: 'Ada' }],
      filters: {},
      meta: { rejected: { industry: 7 } },
    });
    const text = XLSX.utils.sheet_to_csv(book.Sheets['Search details']);
    // The reason is spelled with the same words the on-screen banner uses, so
    // the file and the screen cannot describe one removal two ways.
    expect(text).toContain('Removed on checking: outside the industry,7');
  });
});

describe('the columns themselves', () => {
  it('labels both derived fields as read from the title', () => {
    const headers = Object.fromEntries(PERSON_COLUMNS);
    expect(headers.seniority_from_title).toBe('Seniority (from title)');
    expect(headers.functions_from_title).toBe('Function (from title)');
    // Apollo's own seniority keeps the unqualified header, because Apollo did
    // assert it.
    expect(headers.seniority).toBe('Seniority');
  });

  it('names the unit on every percentage column', () => {
    for (const [key, header] of [...PERSON_COLUMNS, ...COMPANY_COLUMNS]) {
      if (key.includes('growth')) expect(header).toMatch(/%$/);
    }
  });

  it('writes a byte-order mark, so Excel reads a name with an accent correctly', () => {
    const csv = buildCsv({
      entity: 'people',
      rows: [{ full_name: 'Renée Dubois' }],
      filters: {},
      meta: {},
    });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Renée Dubois');
  });
});

describe('naming a saved search', () => {
  /*
   * The version this replaces read nine keys out of fifty, so a search by NAICS
   * code, technology, revenue band or funding was labelled "All people" — a
   * drawer of entries all claiming to be the same unfiltered search.
   */
  it('names a search the old label would have called "All people"', () => {
    expect(historyLabel('people', { technologies: ['Salesforce'] })).toBe('uses Salesforce');
    expect(historyLabel('people', { revenue_min: 1_000_000 })).toBe('1M+ revenue');
    expect(historyLabel('people', { naics_codes: ['5415'] })).toBe('NAICS 5415');
  });

  it('names one place, not three', () => {
    const label = historyLabel('people', {
      company_domains: ['acme.com'],
      person_locations: ['India'],
      company_locations: ['United States'],
    });
    expect(label).toBe('acme.com');
  });

  /*
   * The employee filter's top bucket is open-ended and carries a sentinel, so it
   * has to read as "no upper bound" rather than as 999999999.
   */
  it('reads the open-ended top band as having no ceiling', () => {
    expect(labelSpan({ employee_min: 10_001, employee_max: 999_999_999 }, 'employee_min', 'employee_max')).toBe(
      '10K+',
    );
  });

  it('does not compact a year into 2K', () => {
    expect(historyLabel('people', { founded_min: 2015, founded_max: 2020 })).toBe(
      'founded 2015-2020',
    );
  });

  it('says what a pinned company search was scoped to rather than printing the id', () => {
    expect(historyLabel('people', { organization_ids: ['5f3a1b'] })).toBe('one specific company');
  });
});
