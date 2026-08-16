import { describe, it, expect } from 'vitest';
import {
  calcTax,
  calcNetTotal,
  calcGrandTotal,
  fmtAmount,
  fmtDate,
  financialYear,
  gstMode,
  isValidPan,
  isValidGstin,
  gstinMatchesPan,
  lettersOnly,
  alphaNumeric,
  paidByChapterOptions,
  voucherDateIssue,
  PAYMENT_RULES,
  type Chapter,
} from './voucher';

// The formulas are the heart of the product. If these drift, vouchers are wrong
// and nobody finds out until an audit.
describe('amount formulas', () => {
  const base = {
    basic_value: 10000,
    cgst: 900,
    sgst: 900,
    igst: 0,
    vat: 200,
    tds: 1000,
    advance: 2000,
    tips: 500,
    discount: 300,
  };

  it('total tax is CGST + SGST + IGST', () => {
    expect(calcTax(base)).toBe(1800);
    expect(calcTax({ cgst: 0, sgst: 0, igst: 1800 })).toBe(1800);
  });

  it('net total is A + B + C', () => {
    // 10000 + 1800 + 200
    expect(calcNetTotal(base)).toBe(12000);
  });

  it('grand total subtracts TDS, advance and discount but ADDS tips', () => {
    // 12000 - 1000 - 2000 + 500 - 300
    expect(calcGrandTotal(base)).toBe(9200);
  });

  it('treats blanks, nulls and junk as zero', () => {
    expect(calcGrandTotal({ basic_value: '5000', cgst: '', sgst: null, vat: undefined })).toBe(5000);
    expect(calcGrandTotal({ basic_value: 'abc' })).toBe(0);
  });

  it('tips increase what is payable, advance reduces it', () => {
    const withoutTips = calcGrandTotal({ basic_value: 1000 });
    expect(calcGrandTotal({ basic_value: 1000, tips: 100 })).toBe(withoutTips + 100);
    expect(calcGrandTotal({ basic_value: 1000, advance: 100 })).toBe(withoutTips - 100);
  });
});

describe('formatting', () => {
  it('uses Indian digit grouping with two decimals', () => {
    expect(fmtAmount(123456.5)).toBe('1,23,456.50');
    expect(fmtAmount(1000)).toBe('1,000.00');
    expect(fmtAmount(10000000)).toBe('1,00,00,000.00');
  });

  it('renders ISO dates as dd/mm/yyyy', () => {
    expect(fmtDate('2026-03-09')).toBe('09/03/2026');
    expect(fmtDate('2026-03-09T10:00:00Z')).toBe('09/03/2026');
    expect(fmtDate('')).toBe('');
    expect(fmtDate(null)).toBe('');
  });

  it('computes the Indian financial year (April–March)', () => {
    expect(financialYear(new Date('2025-04-01'))).toBe('25-26');
    expect(financialYear(new Date('2026-03-31'))).toBe('25-26');
    expect(financialYear(new Date('2026-04-01'))).toBe('26-27');
    expect(financialYear(new Date('2026-01-15'))).toBe('25-26');
  });
});

describe('GST mode is exclusive', () => {
  it('detects intra-state vs inter-state', () => {
    expect(gstMode({ cgst: '900', sgst: '900', igst: '' })).toEqual({
      usingCgstSgst: true,
      usingIgst: false,
    });
    expect(gstMode({ cgst: '', sgst: '', igst: '1800' })).toEqual({
      usingCgstSgst: false,
      usingIgst: true,
    });
  });

  it('treats an explicit zero as not-in-use, so the user can switch sides', () => {
    expect(gstMode({ cgst: '0', sgst: '0', igst: '' }).usingCgstSgst).toBe(false);
  });
});

describe('PAN and GSTIN validation', () => {
  it('accepts a well-formed PAN and rejects malformed ones', () => {
    expect(isValidPan('ABCDE1234F')).toBe(true);
    expect(isValidPan('ABCD1234F')).toBe(false);
    expect(isValidPan('abcde1234f')).toBe(false);
    expect(isValidPan('ABCDE12345')).toBe(false);
  });

  it('validates a real GSTIN including its checksum digit', () => {
    expect(isValidGstin('27AAPFU0939F1ZV')).toBe(true);
  });

  it('rejects a GSTIN whose checksum does not match', () => {
    // Same as above with the final check character altered.
    expect(isValidGstin('27AAPFU0939F1ZX')).toBe(false);
  });

  it('rejects structurally wrong GSTINs', () => {
    expect(isValidGstin('27AAPFU0939F1Z')).toBe(false); // too short
    expect(isValidGstin('')).toBe(false);
  });

  it('cross-checks the PAN embedded in a GSTIN', () => {
    expect(gstinMatchesPan('27AAPFU0939F1ZV', 'AAPFU0939F')).toBe(true);
    expect(gstinMatchesPan('27AAPFU0939F1ZV', 'ABCDE1234F')).toBe(false);
  });
});

describe('input sanitisers', () => {
  it('strips digits and symbols from name fields', () => {
    expect(lettersOnly('R. Sharma 123!')).toBe('R. Sharma ');
  });

  it('keeps alphanumerics, hyphen and slash in reference fields', () => {
    expect(alphaNumeric('UTR-2024/09#x')).toBe('UTR-2024/09x');
  });
});

describe('payment rules', () => {
  it('auto-selects for every supporting type except Invoice', () => {
    expect(PAYMENT_RULES['Invoice'].auto).toBeNull();
    expect(PAYMENT_RULES['Proforma Invoice'].auto).toBe('Advance');
    expect(PAYMENT_RULES['Reimbursement'].auto).toBe('Full Payment');
    expect(PAYMENT_RULES['Contract'].auto).toBe('Advance');
  });

  it('only offers Advance and Full Payment on an Invoice', () => {
    expect(PAYMENT_RULES['Invoice'].options).toEqual(['Advance', 'Full Payment']);
    expect(PAYMENT_RULES['Reimbursement'].options).toEqual(['Full Payment']);
  });
});

describe('voucher date bounds', () => {
  const today = '2026-08-16'; // FY 26-27

  it('accepts today and earlier dates in the current financial year', () => {
    expect(voucherDateIssue(today, today)).toBeNull();
    expect(voucherDateIssue('2026-04-01', today)).toBeNull();
  });

  it('rejects a date in the future', () => {
    expect(voucherDateIssue('2026-08-17', today)).toMatch(/future/);
  });

  it('accepts a date in the immediately preceding financial year', () => {
    expect(voucherDateIssue('2026-03-31', today)).toBeNull(); // FY 25-26
    expect(voucherDateIssue('2025-04-01', today)).toBeNull(); // FY 25-26
  });

  it('rejects a date two financial years back — almost always a typo', () => {
    expect(voucherDateIssue('2025-03-31', today)).toMatch(/financial year/); // FY 24-25
    expect(voucherDateIssue('2024-01-01', today)).toMatch(/financial year/);
  });

  it('leaves an empty date alone — required-ness is checked elsewhere', () => {
    expect(voucherDateIssue('', today)).toBeNull();
  });
});

describe('paid-by-chapter constraint', () => {
  const chapters: Chapter[] = [
    { id: 'ho', name: 'CIO Association HO', code: 'HO', is_head_office: true, is_active: true },
    { id: 'pnq', name: 'CIO Association Pune', code: 'PNQ', is_head_office: false, is_active: true },
    { id: 'blr', name: 'CIO Association Bangalore', code: 'BLR', is_head_office: false, is_active: true },
  ];

  it('offers head office plus the voucher chapter only', () => {
    expect(paidByChapterOptions(chapters, 'pnq').map((c) => c.id)).toEqual(['ho', 'pnq']);
  });

  it('does not duplicate head office when the voucher is HO', () => {
    expect(paidByChapterOptions(chapters, 'ho').map((c) => c.id)).toEqual(['ho']);
  });

  it('offers head office alone when no chapter is chosen yet', () => {
    expect(paidByChapterOptions(chapters, null).map((c) => c.id)).toEqual(['ho']);
  });
});
