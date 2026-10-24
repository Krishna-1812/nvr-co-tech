import { describe, expect, it } from 'vitest';
import { exampleWill } from './example';
import { blankAsset, blankWill, isMinor, nameKey, personName, readWill, blankPerson } from './model';

describe('readWill', () => {
  it('reads back exactly what was saved', () => {
    const w = exampleWill();
    expect(readWill(JSON.parse(JSON.stringify(w)))).toEqual(w);
  });

  it('refuses anything that is not a will record, so a restore cannot load an empty one over a real one', () => {
    for (const junk of [null, undefined, 3, 'x', [], {}, { version: 2, people: [], assets: [] }, { version: 1 }]) {
      expect(readWill(junk)).toBeNull();
    }
  });

  it('loads a record that lost fields, with the fields empty', () => {
    const w = readWill({ version: 1, people: [{ id: 'p' }], assets: [{ id: 'a' }] })!;
    expect(w.people[0]).toMatchObject({ id: 'p', name: '', relation: 'Other', dob: '' });
    expect(w.assets[0]).toMatchObject({ id: 'a', kind: 'other', percent: 100, holding: 'sole', fullIdentifier: false });
    expect(w.testator.soundMind).toBe(false);
    expect(w.extras.payDebts).toBe(true);
  });

  it('falls back on unknown enum values instead of keeping them', () => {
    const w = readWill({
      version: 1,
      testator: { religion: 'Klingon', maritalStatus: '??', kinRelation: 'cousin', circumstances: ['assets_abroad', 'nonsense'] },
      people: [{ id: 'p', relation: 'Overlord' }],
      assets: [{ id: 'a', kind: 'spaceship', holding: 'orbital', nominee: { status: 'maybe', names: ['A', 3] } }],
    })!;
    expect(w.testator).toMatchObject({ religion: '', maritalStatus: '', kinRelation: '', circumstances: ['assets_abroad'] });
    expect(w.people[0].relation).toBe('Other');
    expect(w.assets[0]).toMatchObject({ kind: 'other', holding: 'sole', nominee: { status: '', names: ['A'] } });
  });

  it('drops entries without an id, and keeps references that point at nothing', () => {
    const w = readWill({
      version: 1,
      people: [{ name: 'no id' }, { id: 'p' }],
      assets: [],
      gifts: [{ assetId: '' }, { assetId: 'gone', shares: [{ personId: 'nobody', percent: 100 }] }],
    })!;
    expect(w.people.map((p) => p.id)).toEqual(['p']);
    expect(w.gifts).toHaveLength(1);
    expect(w.gifts[0].shares[0].personId).toBe('nobody');
  });

  it('keeps percentages in range and never lets an asset be owned at zero per cent', () => {
    const w = readWill({
      version: 1,
      people: [],
      assets: [{ id: 'a', percent: 0 }, { id: 'b', percent: 250 }, { id: 'c', percent: 40 }],
      residue: [{ personId: 'x', percent: -5 }, { personId: 'y', percent: 50 }],
    })!;
    expect(w.assets.map((a) => a.percent)).toEqual([100, 100, 40]);
    expect(w.residue.map((s) => s.percent)).toEqual([0, 50]);
  });
});

describe('helpers', () => {
  it('names a person, or says what is missing', () => {
    expect(personName({ ...blankPerson('Son'), name: ' Aarav ' })).toBe('Aarav');
    expect(personName(blankPerson('Son'))).toBe('Unnamed son');
    expect(personName(blankPerson('Other'))).toBe('Unnamed person');
    expect(personName(undefined)).toBe('Someone removed from the list');
  });

  it('tells a minor, and does not guess without a date of birth', () => {
    const p = { ...blankPerson('Son'), dob: '2012-06-20' };
    expect(isMinor(p, '2026-10-24')).toBe(true);
    expect(isMinor({ ...p, dob: '2000-01-01' }, '2026-10-24')).toBe(false);
    expect(isMinor({ ...p, dob: '' }, '2026-10-24')).toBe(false);
  });

  it('compares names without caring about case, dots or spacing', () => {
    expect(nameKey('  Dr. Nisha  MEHTA ')).toBe(nameKey('dr nisha mehta'));
    expect(nameKey('Nisha')).not.toBe(nameKey('Nishant'));
  });

  it('starts blank and valid', () => {
    const w = blankWill('Asha');
    expect(readWill(JSON.parse(JSON.stringify(w)))).toEqual(w);
    expect(blankAsset('bank').percent).toBe(100);
  });
});
