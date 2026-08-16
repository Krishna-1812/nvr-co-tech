import { describe, it, expect } from 'vitest';
import { draftSchema, crossFieldIssues, submitReadiness } from './schema';

const paths = (issues: { path: string }[]) => issues.map((i) => i.path).sort();

describe('draft schema is permissive', () => {
  // Autosave runs on every keystroke. If it rejected half-typed input, the user
  // would silently stop being saved — worse than v1, which at least lost
  // everything visibly.
  it('accepts a completely empty draft', () => {
    expect(draftSchema.safeParse({}).success).toBe(true);
  });

  it('turns empty dates into null rather than failing', () => {
    const res = draftSchema.safeParse({ date: '', invoice_date: '2026-01-05' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.date).toBeNull();
      expect(res.data.invoice_date).toBe('2026-01-05');
    }
  });

  it('coerces blank money fields to zero', () => {
    const res = draftSchema.safeParse({ basic_value: '', cgst: '900' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.basic_value).toBe(0);
      expect(res.data.cgst).toBe(900);
    }
  });

  it('trims text and nulls it when empty', () => {
    const res = draftSchema.safeParse({ paid_to: '  Acme Ltd  ', invoice_no: '   ' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.paid_to).toBe('Acme Ltd');
      expect(res.data.invoice_no).toBeNull();
    }
  });

  it('still rejects a negative amount', () => {
    expect(draftSchema.safeParse({ basic_value: '-5' }).success).toBe(false);
  });

  it('rejects a malformed date', () => {
    expect(draftSchema.safeParse({ date: '05/01/2026' }).success).toBe(false);
  });
});

describe('cross-field rules', () => {
  it('rejects CGST/SGST and IGST together', () => {
    expect(paths(crossFieldIssues({ cgst: 900, sgst: 900, igst: 1800 }))).toContain('igst');
  });

  it('requires CGST and SGST to travel together', () => {
    expect(paths(crossFieldIssues({ cgst: 900, sgst: 0 }))).toContain('sgst');
    expect(paths(crossFieldIssues({ cgst: 0, sgst: 900 }))).toContain('cgst');
    expect(crossFieldIssues({ cgst: 900, sgst: 900 })).toHaveLength(0);
  });

  it('accepts IGST alone', () => {
    expect(crossFieldIssues({ igst: 1800 })).toHaveLength(0);
  });

  it('flags a bad PAN and a bad GSTIN checksum', () => {
    expect(paths(crossFieldIssues({ pan_number: 'ABC123' }))).toContain('pan_number');
    expect(paths(crossFieldIssues({ gst_number: '27AAPFU0939F1ZX' }))).toContain('gst_number');
  });

  it('accepts a valid PAN and GSTIN that agree', () => {
    expect(
      crossFieldIssues({ pan_number: 'AAPFU0939F', gst_number: '27AAPFU0939F1ZV' }),
    ).toHaveLength(0);
  });

  it('flags a GSTIN that does not contain the stated PAN', () => {
    expect(
      paths(crossFieldIssues({ pan_number: 'ABCDE1234F', gst_number: '27AAPFU0939F1ZV' })),
    ).toContain('gst_number');
  });

  it('rejects a payment dated before its invoice', () => {
    expect(
      paths(crossFieldIssues({ invoice_date: '2026-02-10', payment_date: '2026-02-01' })),
    ).toContain('payment_date');
    expect(
      crossFieldIssues({ invoice_date: '2026-02-01', payment_date: '2026-02-10' }),
    ).toHaveLength(0);
  });
});

describe('submit readiness mirrors submit_voucher()', () => {
  const complete = {
    chapter_id: 'c1',
    paid_to: 'Acme Ltd',
    type_of_supporting: 'Invoice',
    type_of_payment: 'Full Payment',
    basic_value: 10000,
  };

  it('passes a complete voucher', () => {
    expect(submitReadiness(complete)).toHaveLength(0);
  });

  it('names every missing requirement at once', () => {
    expect(paths(submitReadiness({}))).toEqual(
      ['basic_value', 'chapter_id', 'paid_to', 'type_of_payment', 'type_of_supporting'].sort(),
    );
  });

  it('requires a grand total above zero', () => {
    // Advance cancels the whole amount, leaving nothing payable.
    expect(paths(submitReadiness({ ...complete, advance: 10000 }))).toContain('basic_value');
  });

  it('still applies the cross-field rules', () => {
    expect(paths(submitReadiness({ ...complete, cgst: 900, sgst: 900, igst: 900 }))).toContain(
      'igst',
    );
  });

  it('flags a voucher date in the future, against an explicit "today"', () => {
    const today = '2026-08-16';
    expect(paths(submitReadiness({ ...complete, date: '2026-08-17' }, today))).toContain('date');
    expect(submitReadiness({ ...complete, date: today }, today)).toHaveLength(0);
  });
});
