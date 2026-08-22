import { describe, expect, it } from 'vitest';
import {
  isLiveStatus,
  mcaMasterBatch,
  mcaMasterRow,
  normaliseHeader,
  normaliseRow,
  parseMcaDate,
  tallySkips,
} from './mcaMaster';

const ROW = {
  CORPORATE_IDENTIFICATION_NUMBER: 'U72200KA2013PTC097389',
  COMPANY_NAME: 'Example Software Private Limited',
  COMPANY_STATUS: 'ACTIVE',
  DATE_OF_REGISTRATION: '18-05-2013',
  REGISTERED_STATE: 'Karnataka',
  PRINCIPAL_BUSINESS_ACTIVITY: 'Computer programming, consultancy',
  COMPANY_CLASS: 'Private',
};

function company(raw: Record<string, unknown>) {
  const outcome = mcaMasterRow(raw, 'row 1');
  if (!('company' in outcome)) throw new Error(`expected a company, got: ${outcome.skip.reason}`);
  return outcome.company;
}

function skip(raw: Record<string, unknown>) {
  const outcome = mcaMasterRow(raw, 'row 1');
  if ('company' in outcome) throw new Error('expected a skip');
  return outcome.skip;
}

describe('normaliseHeader', () => {
  it('makes the header variants the same key', () => {
    expect(normaliseHeader('Corporate Identification Number')).toBe('CORPORATEIDENTIFICATIONNUMBER');
    expect(normaliseHeader('CORPORATE_IDENTIFICATION_NUMBER')).toBe('CORPORATEIDENTIFICATIONNUMBER');
    expect(normaliseHeader('corporate-identification-number')).toBe('CORPORATEIDENTIFICATIONNUMBER');
  });
});

describe('normaliseRow', () => {
  it('trims values and turns null into an empty string', () => {
    expect(normaliseRow({ 'Company Name': '  Acme  ', State: null })).toEqual({
      COMPANYNAME: 'Acme',
      STATE: '',
    });
  });
});

describe('mcaMasterRow', () => {
  it('maps a well-formed row', () => {
    expect(company(ROW)).toEqual({
      name: 'Example Software Private Limited',
      cin: 'U72200KA2013PTC097389',
      country: 'IN',
      listing_status: 'unlisted',
      incorporated_on: '2013-05-18',
      registered_state: 'Karnataka',
      nic_code: '72200',
      industry: 'Computer programming, consultancy',
      business_description: null,
      source: 'mca_master',
      source_url: 'https://www.data.gov.in/catalog/company-master-data',
    });
  });

  it('leaves business_description null even though there is an activity to put in it', () => {
    /*
     * The most important assertion in this file. Seeding the description with the
     * industry label would make every company in a category embed to nearly the
     * same vector, so nearest-neighbour search would hand back the industry code
     * with extra steps — and beating the industry code is the entire reason for
     * having embeddings.
     */
    expect(company(ROW).business_description).toBeNull();
  });

  it('takes the listing status from the CIN', () => {
    expect(company({ ...ROW, CORPORATE_IDENTIFICATION_NUMBER: 'L72200KA2013PLC097389' }).listing_status).toBe(
      'listed',
    );
  });

  it('accepts the alternative header spellings', () => {
    const alt = company({
      CIN: 'U72200KA2013PTC097389',
      'Name of Company': 'Example Software Private Limited',
      Status: 'ACTIVE',
      'Date of Incorporation': '18/05/2013',
      State: 'Karnataka',
    });
    expect(alt.cin).toBe('U72200KA2013PTC097389');
    expect(alt.incorporated_on).toBe('2013-05-18');
  });

  it('prefers the CIN state over the column', () => {
    // The column is the registered office and can move; the CIN records the
    // registrar the filings are actually with.
    const moved = company({ ...ROW, REGISTERED_STATE: 'Maharashtra' });
    expect(moved.registered_state).toBe('Karnataka');
  });

  it('falls back to the column when the CIN state code is unrecognised', () => {
    const odd = company({
      ...ROW,
      CORPORATE_IDENTIFICATION_NUMBER: 'U72200ZZ2013PTC097389',
      REGISTERED_STATE: 'Somewhere',
    });
    expect(odd.registered_state).toBe('Somewhere');
  });

  it('names the columns it looked for when the CIN column is missing', () => {
    // This is how a renamed column announces itself instead of a run loading
    // three million companies with no identifiers.
    const s = skip({ COMPANY_NAME: 'Acme' });
    expect(s.reason).toContain('No CIN column found');
    expect(s.reason).toContain('CORPORATEIDENTIFICATIONNUMBER');
  });

  it('skips a malformed CIN and quotes the offending value', () => {
    const s = skip({ ...ROW, CORPORATE_IDENTIFICATION_NUMBER: 'U722XX' });
    expect(s.reason).toBe('Not a well-formed CIN: "U722XX"');
    expect(s.at).toBe('row 1');
  });

  it('skips a row with no name, and identifies it by CIN', () => {
    const s = skip({ ...ROW, COMPANY_NAME: '' });
    expect(s.reason).toBe('No company name in the row');
    expect(s.at).toBe('U72200KA2013PTC097389');
  });

  it('skips a struck-off company, saying which status', () => {
    const s = skip({ ...ROW, COMPANY_STATUS: 'STRIKE OFF' });
    expect(s.reason).toBe('Company status is STRIKE OFF, so it cannot be a comparable');
  });

  it('skips the other dead statuses too', () => {
    for (const status of ['DISSOLVED', 'AMALGAMATED', 'UNDER LIQUIDATION', 'CONVERTED TO LLP']) {
      expect(skip({ ...ROW, COMPANY_STATUS: status }).reason).toContain(status);
    }
  });

  it('keeps a company that is merely not available for efiling', () => {
    // It means the portal cannot accept filings, usually for a record that
    // predates a migration. Excluding it would drop older, larger companies —
    // the ones most likely to be somebody's comparable.
    expect(company({ ...ROW, COMPANY_STATUS: 'NOT AVAILABLE FOR EFILING' }).cin).toBeTruthy();
  });

  it('keeps a row with no status column at all', () => {
    const noStatus: Record<string, unknown> = { ...ROW };
    delete noStatus.COMPANY_STATUS;
    expect(company(noStatus).cin).toBe('U72200KA2013PTC097389');
  });
});

describe('isLiveStatus', () => {
  it('treats an absent status as live rather than as a reason to drop a row', () => {
    expect(isLiveStatus(null)).toBe(true);
  });

  it('is insensitive to spacing and case, because these files are not tidy', () => {
    expect(isLiveStatus('active')).toBe(true);
    expect(isLiveStatus('  Active  ')).toBe(true);
    expect(isLiveStatus('Strike Off')).toBe(false);
  });
});

describe('parseMcaDate', () => {
  it('reads the shapes these files actually use', () => {
    expect(parseMcaDate('18-05-2013')).toBe('2013-05-18');
    expect(parseMcaDate('18/05/2013')).toBe('2013-05-18');
    expect(parseMcaDate('18-MAY-2013')).toBe('2013-05-18');
    expect(parseMcaDate('18 May 2013')).toBe('2013-05-18');
    expect(parseMcaDate('2013-05-18')).toBe('2013-05-18');
  });

  it('pads a single-digit day and month', () => {
    expect(parseMcaDate('1-5-2013')).toBe('2013-05-01');
  });

  it('reads day first, which is assumed rather than detected', () => {
    // 01-02-2005 is the first of February. There is no way to tell otherwise,
    // and guessing per row would put some companies a month out from their
    // neighbours in the same file.
    expect(parseMcaDate('01-02-2005')).toBe('2005-02-01');
  });

  it('refuses a date that is not a date', () => {
    expect(parseMcaDate('31-02-2005')).toBeNull(); // February the 31st
    expect(parseMcaDate('29-02-2005')).toBeNull(); // 2005 was not a leap year
    expect(parseMcaDate('18-XXX-2013')).toBeNull();
    expect(parseMcaDate('rubbish')).toBeNull();
    expect(parseMcaDate('')).toBeNull();
    expect(parseMcaDate(null)).toBeNull();
  });

  it('accepts a real leap day', () => {
    expect(parseMcaDate('29-02-2004')).toBe('2004-02-29');
  });
});

describe('mcaMasterBatch', () => {
  it('splits a batch into companies and skips, numbering the rows', () => {
    const harvest = mcaMasterBatch(
      [ROW, { ...ROW, CORPORATE_IDENTIFICATION_NUMBER: 'rubbish' }, { ...ROW, COMPANY_NAME: 'Second Co' }],
      { firstRowNumber: 100 },
    );
    expect(harvest.companies).toHaveLength(2);
    expect(harvest.skipped).toHaveLength(1);
    expect(harvest.skipped[0].at).toBe('row 101');
    expect(harvest.financials).toEqual([]);
    expect(harvest.quotes).toEqual([]);
  });
});

describe('tallySkips', () => {
  it('groups by reason and orders by how often each happened', () => {
    const tally = tallySkips([
      { at: 'a', reason: 'Company status is STRIKE OFF, so it cannot be a comparable' },
      { at: 'b', reason: 'Company status is STRIKE OFF, so it cannot be a comparable' },
      { at: 'c', reason: 'No company name in the row' },
    ]);
    expect(tally[0].count).toBe(2);
    expect(tally[0].reason).toContain('STRIKE OFF');
    expect(tally[1].count).toBe(1);
  });

  it('does not produce one bucket per malformed value', () => {
    // Eliding the quoted value is what makes this work. Truncating would not:
    // the reason is 29 characters, so any sane cut-off keeps the values apart
    // and the report is again as long as the problem.
    const tally = tallySkips([
      { at: 'a', reason: 'Not a well-formed CIN: "AAAA"' },
      { at: 'b', reason: 'Not a well-formed CIN: "BBBB"' },
    ]);
    expect(tally).toHaveLength(1);
    expect(tally[0].count).toBe(2);
    expect(tally[0].reason).toBe('Not a well-formed CIN: "…"');
  });

  it('keeps two different statuses apart, because they are different facts', () => {
    const tally = tallySkips([
      { at: 'a', reason: 'Company status is STRIKE OFF, so it cannot be a comparable' },
      { at: 'b', reason: 'Company status is AMALGAMATED, so it cannot be a comparable' },
    ]);
    expect(tally).toHaveLength(2);
  });
});
