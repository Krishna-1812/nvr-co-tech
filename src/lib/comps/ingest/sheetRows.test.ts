import { describe, expect, it } from 'vitest';
import { batch, sheetRowsToRecords } from './sheetRows';

describe('sheetRowsToRecords', () => {
  it('keys each row by the header row', () => {
    const records = sheetRowsToRecords({
      rows: [
        ['CIN', 'COMPANY_NAME'],
        ['U12345MH2001PTC000001', 'Example Ltd'],
      ],
      text: '',
    });
    expect(records).toEqual([{ CIN: 'U12345MH2001PTC000001', COMPANY_NAME: 'Example Ltd' }]);
  });

  it('drops a row with nothing in any column', () => {
    const records = sheetRowsToRecords({
      rows: [
        ['CIN', 'COMPANY_NAME'],
        ['', ''],
        ['U1', 'Real Ltd'],
      ],
      text: '',
    });
    expect(records).toEqual([{ CIN: 'U1', COMPANY_NAME: 'Real Ltd' }]);
  });

  it('fills a short row with blanks rather than dropping it', () => {
    // A trailing column MCA's export left off should cost that one column,
    // not the whole row — pick() in mcaMaster.ts already treats '' as absent.
    const records = sheetRowsToRecords({
      rows: [
        ['CIN', 'COMPANY_NAME', 'STATE'],
        ['U1', 'Real Ltd'],
      ],
      text: '',
    });
    expect(records).toEqual([{ CIN: 'U1', COMPANY_NAME: 'Real Ltd', STATE: '' }]);
  });

  it('skips a blank header cell rather than keying a column ""', () => {
    const records = sheetRowsToRecords({
      rows: [
        ['CIN', ''],
        ['U1', 'stray'],
      ],
      text: '',
    });
    expect(records).toEqual([{ CIN: 'U1' }]);
  });

  it('is empty for a sheet with no header row', () => {
    expect(sheetRowsToRecords({ rows: [], text: '' })).toEqual([]);
  });

  it('is empty for a header with nothing under it', () => {
    expect(sheetRowsToRecords({ rows: [['CIN', 'COMPANY_NAME']], text: '' })).toEqual([]);
  });
});

describe('batch', () => {
  it('splits into fixed-size chunks', () => {
    expect(batch([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('is one chunk when everything fits', () => {
    expect(batch([1, 2], 10)).toEqual([[1, 2]]);
  });

  it('is empty for no items', () => {
    expect(batch([], 5)).toEqual([]);
  });
});
