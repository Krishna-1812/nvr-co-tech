import { describe, expect, it } from 'vitest';
import { ageOn, isGoa, scopeOf, type ScopeInput } from './law';

const TODAY = '2026-10-24';

const adult: ScopeInput = { dob: '1978-04-12', religion: 'Hindu', state: 'Maharashtra', circumstances: [] };
const ids = (i: ScopeInput) => scopeOf(i, TODAY).reasons.map((r) => r.id);

describe('ageOn', () => {
  it('counts whole years and respects the birthday', () => {
    expect(ageOn('1978-04-12', '2026-10-24')).toBe(48);
    expect(ageOn('2008-10-24', '2026-10-24')).toBe(18); // turns 18 today
    expect(ageOn('2008-10-25', '2026-10-24')).toBe(17); // tomorrow
  });

  it('is null for anything that is not a real past date', () => {
    expect(ageOn('', TODAY)).toBeNull();
    expect(ageOn('12/04/1978', TODAY)).toBeNull();
    expect(ageOn('1978-13-01', TODAY)).toBeNull();
    expect(ageOn('2030-01-01', TODAY)).toBeNull();
  });
});

describe('scopeOf', () => {
  it('passes an adult Hindu in Maharashtra with nothing unusual', () => {
    expect(scopeOf(adult, TODAY)).toEqual({ level: 'ok', reasons: [] });
  });

  it('does not make a will for a minor (s.59)', () => {
    const s = scopeOf({ ...adult, dob: '2012-01-01' }, TODAY);
    expect(s.level).toBe('out');
    expect(s.reasons[0]).toMatchObject({ id: 'minor', cite: expect.stringContaining('s.59') });
  });

  it('asks for a date of birth rather than assuming an adult', () => {
    const s = scopeOf({ ...adult, dob: '' }, TODAY);
    expect(s.level).toBe('caution');
    expect(ids({ ...adult, dob: '' })).toEqual(['age-unknown']);
  });

  it('stops at a Muslim testator and says why (s.58(1))', () => {
    const s = scopeOf({ ...adult, religion: 'Muslim' }, TODAY);
    expect(s.level).toBe('out');
    expect(s.reasons[0].cite).toContain('s.58(1)');
    expect(s.reasons[0].detail).toContain('one-third');
  });

  it('stops at Goa, however the state is typed', () => {
    for (const state of ['Goa', ' goa ', 'GOA']) expect(scopeOf({ ...adult, state }, TODAY).level).toBe('out');
    expect(isGoa('Gujarat')).toBe(false);
  });

  it('treats an unanswered religion as a caution, never a pass', () => {
    expect(ids({ ...adult, religion: '' })).toEqual(['religion']);
    expect(scopeOf({ ...adult, religion: '' }, TODAY).level).toBe('caution');
  });

  it('lets every non-Muslim religion in the Succession Act through', () => {
    for (const religion of ['Hindu', 'Buddhist', 'Jain', 'Sikh', 'Christian', 'Parsi'] as const) {
      expect(scopeOf({ ...adult, religion }, TODAY).level).toBe('ok');
    }
  });

  it('turns each circumstance into a caution, not a refusal', () => {
    const all = ['special_needs_dependant', 'business_interest', 'second_marriage', 'excluding_an_heir', 'expecting_a_dispute', 'assets_abroad'] as const;
    for (const c of all) {
      const s = scopeOf({ ...adult, circumstances: [c] }, TODAY);
      expect(s.level, c).toBe('caution');
      expect(s.reasons).toHaveLength(1);
    }
  });

  it('lists refusals before cautions, and the worst level wins', () => {
    const s = scopeOf({ ...adult, religion: 'Muslim', circumstances: ['assets_abroad'] }, TODAY);
    expect(s.level).toBe('out');
    expect(s.reasons.map((r) => r.level)).toEqual(['out', 'caution']);
  });
});
