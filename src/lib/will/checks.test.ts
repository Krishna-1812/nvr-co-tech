import { describe, expect, it } from 'vitest';
import { checkWill, readiness, type Finding } from './checks';
import { EXAMPLE_TODAY, exampleWill } from './example';
import { blankPerson, blankWill, type WillRecord } from './model';

/*
 * Each test bends one thing in a copy of the worked example and expects the
 * one finding that thing should raise. The example itself must be clean of
 * anything that stops an export, or none of these would mean anything.
 */

const run = (edit: (w: WillRecord) => void): Finding[] => {
  const w = structuredClone(exampleWill());
  edit(w);
  return checkWill(w, EXAMPLE_TODAY);
};
const ids = (fs: Finding[]) => fs.map((f) => f.id);
const has = (fs: Finding[], prefix: string) => fs.some((f) => f.id.startsWith(prefix));
const get = (fs: Finding[], prefix: string) => fs.find((f) => f.id.startsWith(prefix));

describe('the worked example', () => {
  it('is ready to sign, with only notes', () => {
    const fs = checkWill(exampleWill(), EXAMPLE_TODAY);
    expect(readiness(fs)).toEqual({ act: 0, review: 0, note: fs.length, ready: true });
    expect(ids(fs).sort()).toEqual(['asset-nominated:policy', 'gift-nominee:g-mf', 'minor-gift', 'ungifted']);
  });
});

describe('a blank will', () => {
  it('is not ready, and says what to do first', () => {
    const fs = checkWill(blankWill(), EXAMPLE_TODAY);
    expect(readiness(fs).ready).toBe(false);
    expect(ids(fs)).toEqual(expect.arrayContaining(['testator-name', 'declare-mind', 'declare-free', 'residue-none']));
  });
});

describe('you', () => {
  it('needs a name, the two declarations, and holds the export until they are given', () => {
    const fs = run((w) => {
      w.testator.name = ' ';
      w.testator.soundMind = false;
      w.testator.voluntary = false;
    });
    expect(ids(fs.filter((f) => f.severity === 'act'))).toEqual(['testator-name', 'declare-mind', 'declare-free']);
    expect(readiness(fs).ready).toBe(false);
  });

  it('asks for the two declarations on the last step, where the person is about to sign, not before the first question', () => {
    const fs = checkWill(blankWill(), EXAMPLE_TODAY);
    expect(get(fs, 'declare-mind')?.step).toBe('sign');
    expect(get(fs, 'declare-free')?.step).toBe('sign');
    expect(get(fs, 'testator-name')?.step).toBe('you');
  });

  it('turns a refusal from the scope verdict into something that holds the export', () => {
    const fs = run((w) => (w.testator.religion = 'Muslim'));
    expect(get(fs, 'scope-muslim')).toMatchObject({ severity: 'act', cite: expect.stringContaining('s.58(1)') });
    expect(readiness(fs).ready).toBe(false);
  });

  it('turns a caution into a review, which does not hold it', () => {
    const fs = run((w) => w.testator.circumstances.push('business_interest'));
    expect(get(fs, 'scope-business')?.severity).toBe('review');
    expect(readiness(fs).ready).toBe(true);
  });

  it('holds the export for a testator under 18 (s.59)', () => {
    const fs = run((w) => (w.testator.dob = '2012-01-01'));
    expect(get(fs, 'scope-minor')).toMatchObject({ severity: 'act', cite: expect.stringContaining('s.59') });
  });

  it('asks for an address without blocking', () => {
    const fs = run((w) => (w.testator.address = ''));
    expect(get(fs, 'testator-address')?.severity).toBe('review');
  });
});

describe('people', () => {
  it('flags a person with no name, and two people with the same one', () => {
    const fs = run((w) => {
      w.people.push(blankPerson('Brother'));
      w.people.push({ ...w.people[0], id: 'twin', name: 'nisha  mehta' });
    });
    expect(has(fs, 'person-unnamed')).toBe(true);
    expect(get(fs, 'person-double:twin')?.severity).toBe('review');
  });
});

describe('assets', () => {
  it('asks for something to identify an asset by', () => {
    const fs = run((w) => w.assets.push({ ...w.assets[1], id: 'vague', title: 'Some account', institution: '', identifier: '', location: '', details: '' }));
    expect(get(fs, 'asset-vague:vague')?.severity).toBe('review');
  });

  it('notes that a shared asset passes only your share', () => {
    expect(has(run((w) => (w.assets[1].holding = 'joint')), 'asset-shared:sbi')).toBe(true);
    expect(has(run((w) => (w.assets[0].percent = 50)), 'asset-shared:flat')).toBe(true);
    expect(has(run((w) => (w.assets[0].coOwners = 'Nisha Mehta')), 'asset-shared:flat')).toBe(true);
  });

  it('notes that insurance and provident funds follow their nomination', () => {
    expect(has(run(() => {}), 'asset-nominated:policy')).toBe(true);
    expect(has(run((w) => (w.assets[1].kind = 'retirement')), 'asset-nominated:sbi')).toBe(true);
  });
});

describe('gifts', () => {
  it('holds the export when shares of one gift do not add up to 100', () => {
    const fs = run((w) => (w.gifts[2].shares[0].percent = 40));
    expect(get(fs, 'gift-sum:g-mf')).toMatchObject({ severity: 'act', title: expect.stringContaining('90%') });
  });

  it('tolerates the rounding of three thirds', () => {
    const fs = run((w) => {
      w.gifts[2].shares = [
        { personId: 'aarav', percent: 33.33, alternateId: '' },
        { personId: 'anaya', percent: 33.33, alternateId: '' },
        { personId: 'kavita', percent: 33.34, alternateId: '' },
      ];
    });
    expect(has(fs, 'gift-sum')).toBe(false);
  });

  it('holds the export for a gift with nobody to receive it, or to someone not on the list', () => {
    expect(get(run((w) => (w.gifts[0].shares = [])), 'gift-nobody:g-flat')?.severity).toBe('act');
    expect(get(run((w) => (w.gifts[0].shares[0].personId = 'ghost')), 'gift-person:g-flat')?.severity).toBe('act');
    expect(get(run((w) => (w.gifts[0].shares[0].alternateId = 'ghost')), 'gift-alt:g-flat')?.severity).toBe('act');
  });

  it('holds the export for a gift of an asset that was removed', () => {
    expect(has(run((w) => (w.assets = w.assets.filter((a) => a.id !== 'flat'))), 'gift-orphan:g-flat')).toBe(true);
  });

  it('holds the export when an asset is given twice', () => {
    const fs = run((w) => w.gifts.push({ id: 'again', assetId: 'flat', shares: [{ personId: 'kavita', percent: 100, alternateId: '' }] }));
    expect(get(fs, 'gift-twice:flat')?.severity).toBe('act');
  });

  it('reviews a backup that is the same person', () => {
    const fs = run((w) => (w.gifts[0].shares[0].alternateId = 'nisha'));
    expect(get(fs, 'gift-alt-same:g-flat')?.severity).toBe('review');
  });

  it('notes when the nominee on an asset is not who it is given to, and not when they match', () => {
    expect(has(checkWill(exampleWill(), EXAMPLE_TODAY), 'gift-nominee:g-mf')).toBe(true);
    expect(has(run((w) => (w.assets[2].nominee.names = ['Aarav Mehta'])), 'gift-nominee')).toBe(false);
  });

  it('counts the assets nobody is given by name', () => {
    expect(get(checkWill(exampleWill(), EXAMPLE_TODAY), 'ungifted')?.title).toBe('1 of 4 assets are not given by name');
  });
});

describe('everything else (the residue)', () => {
  it('holds the export with no residue, and when its shares do not add up', () => {
    expect(get(run((w) => (w.residue = [])), 'residue-none')?.severity).toBe('act');
    const fs = run((w) => w.residue.push({ personId: 'kavita', percent: 10, alternateId: '' }));
    expect(get(fs, 'residue-sum')).toMatchObject({ severity: 'act', title: expect.stringContaining('110%') });
  });

  it('catches shares that are only a point short, which is the slip people actually make', () => {
    const split = (w: WillRecord, a: number, b: number) =>
      (w.residue = [
        { personId: 'nisha', percent: a, alternateId: '' },
        { personId: 'kavita', percent: b, alternateId: '' },
      ]);
    expect(get(run((w) => split(w, 60, 39)), 'residue-sum')?.title).toContain('99%');
    expect(has(run((w) => split(w, 60, 40)), 'residue-sum')).toBe(false);
    expect(has(run((w) => (w.gifts[2].shares[0].percent = 49)), 'gift-sum:g-mf')).toBe(true);
  });

  it('holds the export for a residue share to someone not on the list', () => {
    expect(has(run((w) => (w.residue[0].personId = 'ghost')), 'residue-person')).toBe(true);
  });
});

describe('if someone dies first (s.105)', () => {
  it('counts shares with no backup, once', () => {
    const fs = run((w) => {
      w.gifts[0].shares[0].alternateId = '';
      w.residue[0].alternateId = '';
    });
    expect(get(fs, 'no-backup')).toMatchObject({ severity: 'note', title: '2 shares have no backup', cite: expect.stringContaining('s.105') });
  });

  it('says nothing when every share has a backup', () => {
    expect(has(checkWill(exampleWill(), EXAMPLE_TODAY), 'no-backup')).toBe(false);
  });
});

describe('spouse and children', () => {
  it('reviews a spouse who receives nothing', () => {
    const fs = run((w) => {
      w.gifts = [];
      w.residue = [{ personId: 'kavita', percent: 100, alternateId: '' }];
    });
    expect(get(fs, 'spouse-unnamed')?.severity).toBe('review');
  });
});

describe('minors', () => {
  it('reviews a minor child with no guardian named', () => {
    const fs = run((w) => (w.guardianIds = []));
    expect(get(fs, 'minor-no-guardian')).toMatchObject({ severity: 'review' });
    expect(get(fs, 'minor-no-guardian')?.detail).toContain('Aarav Mehta');
  });

  it('does not need a guardian when nobody is under 18', () => {
    const fs = run((w) => {
      w.guardianIds = [];
      w.people.forEach((p) => (p.dob = p.relation === 'Son' || p.relation === 'Daughter' ? '2000-01-01' : p.dob));
    });
    expect(has(fs, 'minor-no-guardian')).toBe(false);
    expect(has(fs, 'minor-gift')).toBe(false);
  });

  it('notes a gift to a minor', () => {
    expect(has(checkWill(exampleWill(), EXAMPLE_TODAY), 'minor-gift')).toBe(true);
  });
});

describe('executors and guardians', () => {
  it('reviews no executor, notes a single one, holds the export for one not on the list', () => {
    expect(get(run((w) => (w.executorIds = [])), 'executor-none')?.severity).toBe('review');
    expect(get(run((w) => (w.executorIds = ['nisha'])), 'executor-one')?.severity).toBe('note');
    expect(get(run((w) => (w.executorIds = ['ghost'])), 'executor-missing:ghost')?.severity).toBe('act');
    expect(get(run((w) => (w.guardianIds = ['ghost'])), 'guardian-missing:ghost')?.severity).toBe('act');
  });
});

describe('witnesses (s.63(c), s.67)', () => {
  it('holds the export when a witness also receives a gift', () => {
    const fs = run((w) => (w.gifts[1].shares[0].personId = 'dev'));
    expect(get(fs, 'witness-beneficiary:dev')).toMatchObject({ severity: 'act', cite: expect.stringContaining('s.67') });
    expect(readiness(fs).ready).toBe(false);
  });

  it('holds the export when a witness is only a backup beneficiary, because they can still take', () => {
    const fs = run((w) => (w.residue[0].alternateId = 'smita'));
    expect(has(fs, 'witness-beneficiary:smita')).toBe(true);
  });

  it('notes that witnesses can be named at signing, and reviews having only one', () => {
    expect(get(run((w) => (w.witnessIds = [])), 'witness-later')?.severity).toBe('note');
    expect(get(run((w) => (w.witnessIds = ['dev'])), 'witness-short')?.severity).toBe('review');
    expect(has(checkWill(exampleWill(), EXAMPLE_TODAY), 'witness-')).toBe(false);
  });
});

describe('ordering and readiness', () => {
  it('lists what must be fixed first, then reviews, then notes, each in interview order', () => {
    const fs = run((w) => {
      w.testator.name = '';
      w.residue = [];
      w.testator.address = '';
    });
    const order = fs.map((f) => f.severity);
    expect(order).toEqual([...order].sort((a, b) => ['act', 'review', 'note'].indexOf(a) - ['act', 'review', 'note'].indexOf(b)));
    expect(fs[0].id).toBe('testator-name');
  });

  it('gives every finding a stable, unique id', () => {
    const fs = run((w) => {
      w.testator.name = '';
      w.gifts[2].shares[0].percent = 10;
      w.executorIds = [];
    });
    expect(new Set(ids(fs)).size).toBe(fs.length);
  });

  it('counts each level', () => {
    expect(readiness([{ id: 'a', severity: 'act', step: 'you', title: '', detail: '' }, { id: 'b', severity: 'note', step: 'you', title: '', detail: '' }])).toEqual({ act: 1, review: 0, note: 1, ready: false });
  });
});
