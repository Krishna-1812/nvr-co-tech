import { describe, expect, it } from 'vitest';
import { cinDisqualifies, isCin, parseCin } from './cin';

describe('parseCin', () => {
  it('reads every group out of a real-shaped CIN', () => {
    const cin = parseCin('U72200KA2013PTC097389');
    expect(cin).toEqual({
      cin: 'U72200KA2013PTC097389',
      listed: false,
      industryCode: '72200',
      stateCode: 'KA',
      state: 'Karnataka',
      year: 2013,
      ownershipCode: 'PTC',
      ownership: 'Private limited company',
      registrationNumber: '097389',
    });
  });

  it('reads the listing letter', () => {
    expect(parseCin('L72200KA2013PLC097389')?.listed).toBe(true);
    expect(parseCin('U72200KA2013PLC097389')?.listed).toBe(false);
  });

  it('forgives whitespace and case, because a CSV cell is a CSV cell', () => {
    expect(parseCin('  u72200ka2013ptc097389  ')?.cin).toBe('U72200KA2013PTC097389');
    expect(parseCin('U72200 KA2013 PTC097389')?.cin).toBe('U72200KA2013PTC097389');
  });

  it('keeps an unrecognised state code and refuses to name it', () => {
    // Naming it would put a wrong state on a company profile. The code is still
    // information, so it survives.
    const cin = parseCin('U72200ZZ2013PTC097389');
    expect(cin?.stateCode).toBe('ZZ');
    expect(cin?.state).toBeNull();
  });

  it('keeps an unrecognised ownership code and refuses to name it', () => {
    const cin = parseCin('U72200KA2013ZZZ097389');
    expect(cin?.ownershipCode).toBe('ZZZ');
    expect(cin?.ownership).toBeNull();
  });

  it('refuses anything that is not the whole grammar', () => {
    expect(parseCin('')).toBeNull();
    expect(parseCin('NOT A CIN')).toBeNull();
    expect(parseCin('X72200KA2013PTC097389')).toBeNull(); // first letter
    expect(parseCin('U7220KA2013PTC097389')).toBeNull(); //  four industry digits
    expect(parseCin('U722001KA2013PTC097389')).toBeNull(); // six
    expect(parseCin('U72200K12013PTC097389')).toBeNull(); //  digit in the state
    expect(parseCin('U72200KA201PTC097389')).toBeNull(); //   three year digits
    expect(parseCin('U72200KA2013PT097389')).toBeNull(); //   two ownership letters
    expect(parseCin('U72200KA2013PTC09738')).toBeNull(); //   five registration digits
  });

  it('refuses a 22-character string rather than matching its first 21', () => {
    // The anchor at the end. Without it, a trailing character would import a
    // company under a truncated identifier that never matches anything again.
    expect(parseCin('U72200KA2013PTC0973891')).toBeNull();
  });

  it('refuses a transposed year, which is the error an eye slides past', () => {
    // 2031 for 2013. Four digits either way, and only the sanity check catches it.
    expect(parseCin('U72200KA2031PTC097389')).toBeNull();
    expect(parseCin('U72200KA1700PTC097389')).toBeNull();
  });

  it('accepts next year, because a company incorporated in December is real', () => {
    const next = new Date().getUTCFullYear() + 1;
    expect(parseCin(`U72200KA${next}PTC097389`)?.year).toBe(next);
  });

  it('is null for anything that is not a string', () => {
    expect(parseCin(null)).toBeNull();
    expect(parseCin(undefined)).toBeNull();
    expect(parseCin(72200)).toBeNull();
    expect(parseCin({})).toBeNull();
  });
});

describe('isCin', () => {
  it('is the same judgement as parseCin', () => {
    expect(isCin('U72200KA2013PTC097389')).toBe(true);
    expect(isCin('nope')).toBe(false);
  });
});

describe('cinDisqualifies', () => {
  it('keeps a section 8 not-for-profit out of a peer set, with a reason', () => {
    const npl = parseCin('U72200KA2013NPL097389');
    expect(npl).not.toBeNull();
    if (!npl) return;
    expect(cinDisqualifies(npl)).toBe('A section 8 not-for-profit has no equity value to compare');
  });

  it('says nothing about an ordinary private company', () => {
    const ptc = parseCin('U72200KA2013PTC097389');
    if (!ptc) throw new Error('fixture should parse');
    expect(cinDisqualifies(ptc)).toBeNull();
  });

  it('says nothing about an unrecognised ownership code', () => {
    // Silence here means "nothing in the identifier disqualifies it", which is
    // not the same as saying it belongs. The screen decides that.
    const odd = parseCin('U72200KA2013ZZZ097389');
    if (!odd) throw new Error('fixture should parse');
    expect(cinDisqualifies(odd)).toBeNull();
  });
});
