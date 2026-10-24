import { describe, expect, it } from 'vitest';
import { checkWill } from './checks';
import { equalPercents, removeAsset, removePerson, setAsset, setGift, setPerson, setResidue, setRole, splitEqually, usesOf } from './edit';
import { EXAMPLE_TODAY, exampleWill } from './example';
import { blankAsset, blankPerson } from './model';

describe('removePerson', () => {
  it('takes a person out of every role, gift, share and backup that named them', () => {
    const w = removePerson(exampleWill(), 'kavita');
    expect(w.people.map((p) => p.id)).not.toContain('kavita');
    expect(w.executorIds).toEqual(['nisha']);
    expect(w.guardianIds).toEqual([]);
    // Kavita was the backup for the bank account and for everything else.
    expect(w.gifts.find((g) => g.id === 'g-sbi')!.shares[0].alternateId).toBe('');
    expect(w.residue[0].alternateId).toBe('');
    expect(JSON.stringify(w)).not.toContain('kavita');
  });

  it('drops a gift that would be left with nobody, so the asset reads as not given by name', () => {
    const w = removePerson(exampleWill(), 'nisha');
    expect(w.gifts.map((g) => g.id)).toEqual(['g-mf']);
    expect(w.residue).toEqual([]);
  });

  it('never leaves a reference to a person who is not on the list', () => {
    for (const p of exampleWill().people) {
      const w = removePerson(exampleWill(), p.id);
      const ids = new Set(w.people.map((x) => x.id));
      const refs = [
        ...w.executorIds, ...w.guardianIds, ...w.witnessIds,
        ...w.residue.flatMap((s) => [s.personId, s.alternateId]),
        ...w.gifts.flatMap((g) => g.shares.flatMap((s) => [s.personId, s.alternateId])),
      ].filter(Boolean);
      expect(refs.every((r) => ids.has(r)), p.id).toBe(true);
    }
  });

  it('does not change the record it was given', () => {
    const w = exampleWill();
    const before = JSON.stringify(w);
    removePerson(w, 'nisha');
    expect(JSON.stringify(w)).toBe(before);
  });
});

describe('assets and gifts', () => {
  it('adds an asset, and replaces one with the same id', () => {
    const a = blankAsset('bank');
    const once = setAsset(exampleWill(), a);
    expect(once.assets).toHaveLength(5);
    expect(setAsset(once, { ...a, title: 'Renamed' }).assets.at(-1)!.title).toBe('Renamed');
    expect(setAsset(once, { ...a, title: 'Renamed' }).assets).toHaveLength(5);
  });

  it('takes the gift of an asset away with the asset', () => {
    const w = removeAsset(exampleWill(), 'flat');
    expect(w.assets.map((a) => a.id)).not.toContain('flat');
    expect(w.gifts.map((g) => g.assetId)).not.toContain('flat');
  });

  it('sets a gift in place, adds a new one, and clears it with no shares', () => {
    const share = [{ personId: 'kavita', percent: 100, alternateId: '' }];
    const changed = setGift(exampleWill(), 'flat', share);
    expect(changed.gifts.map((g) => g.assetId)).toEqual(['flat', 'sbi', 'mf']);
    expect(changed.gifts[0].shares).toEqual(share);
    expect(changed.gifts[0].id).toBe('g-flat');

    const added = setGift(exampleWill(), 'policy', share);
    expect(added.gifts.at(-1)).toMatchObject({ assetId: 'policy', shares: share });

    expect(setGift(exampleWill(), 'flat', []).gifts.map((g) => g.assetId)).toEqual(['sbi', 'mf']);
  });

  it('sets the residue', () => {
    expect(setResidue(exampleWill(), []).residue).toEqual([]);
  });
});

describe('roles', () => {
  it('keeps the order given, once each, dropping blanks', () => {
    expect(setRole(exampleWill(), 'executorIds', ['kavita', '', 'nisha', 'kavita']).executorIds).toEqual(['kavita', 'nisha']);
  });

  it('adds and replaces a person', () => {
    const p = blankPerson('Friend');
    const w = setPerson(exampleWill(), p);
    expect(w.people).toHaveLength(7);
    expect(setPerson(w, { ...p, name: 'Ravi' }).people.at(-1)!.name).toBe('Ravi');
  });
});

describe('equal splits', () => {
  it('always add to exactly 100, with the odd paisa on the first share', () => {
    expect(equalPercents(2)).toEqual([50, 50]);
    expect(equalPercents(3)).toEqual([33.34, 33.33, 33.33]);
    expect(equalPercents(6)).toEqual([16.7, 16.66, 16.66, 16.66, 16.66, 16.66]);
    for (let n = 1; n <= 20; n++) {
      expect(Math.round(equalPercents(n).reduce((a, b) => a + b, 0) * 100) / 100, `n=${n}`).toBe(100);
    }
    expect(equalPercents(0)).toEqual([]);
  });

  it('gives no check anything to complain about', () => {
    const w = exampleWill();
    w.gifts[2].shares = splitEqually([
      { personId: 'aarav', percent: 0, alternateId: 'anaya' },
      { personId: 'anaya', percent: 0, alternateId: '' },
      { personId: 'kavita', percent: 0, alternateId: '' },
    ]);
    expect(w.gifts[2].shares.map((s) => s.alternateId)).toEqual(['anaya', '', '']);
    expect(checkWill(w, EXAMPLE_TODAY).some((f) => f.id.startsWith('gift-sum'))).toBe(false);
  });
});

describe('usesOf', () => {
  it('says where a person is named, so removing them is not a surprise', () => {
    expect(usesOf(exampleWill(), 'kavita')).toEqual(['executor', 'guardian', 'backup for State Bank of India savings account', 'backup for everything else']);
    expect(usesOf(exampleWill(), 'dev')).toEqual(['witness']);
    expect(usesOf(exampleWill(), 'nisha')).toEqual(['executor', 'gets Flat in Pune', 'gets State Bank of India savings account', 'gets everything else']);
  });

  it('is empty for a person who is only on the list', () => {
    const w = exampleWill();
    w.people.push({ ...blankPerson('Friend'), id: 'new', name: 'Ravi' });
    expect(usesOf(w, 'new')).toEqual([]);
  });
});
