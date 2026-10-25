import { describe, expect, it } from 'vitest';
import { checkWill, readiness } from './checks';
import { CIRCUMSTANCE_LABELS } from './law';
import { readWill } from './model';
import { setAsset, setPerson, setRole } from './edit';
import { EXAMPLE_TODAY } from './example';
import {
  applyResiduePreset,
  currentResiduePreset,
  giveTo,
  isAnswered,
  questionsFor,
  recipientOf,
  residueDone,
  residueOptions,
  resumeAt,
  reasonsForAdvice,
  setSoleBackup,
  SIGNING_STEPS,
  signingProgress,
  toggleSigningStep,
} from './guided';
import { blankAsset, blankPerson, blankWill, type Person, type WillRecord } from './model';

const TODAY = EXAMPLE_TODAY;

const person = (name: string, relation: Person['relation'], dob = ''): Person => ({ ...blankPerson(relation), name, dob });

/** What the guided flow would have collected for a family of four. */
function answered(): WillRecord {
  let r = blankWill('Rohan Mehta');
  r.testator = { ...r.testator, dob: '1978-04-12', religion: 'Hindu', address: '14 Example Lane, Pune', state: 'Maharashtra' };
  for (const p of [person('Nisha Mehta', 'Spouse'), person('Aarav Mehta', 'Son', '2018-05-01'), person('Diya Mehta', 'Daughter', '2012-02-02')]) r = setPerson(r, p);
  return r;
}

describe('which questions are asked', () => {
  it('asks the same ten-ish questions of everybody, plus a guardian question only when a child is under 18', () => {
    const none = blankWill();
    expect(questionsFor(none, TODAY)).toEqual(['name', 'born', 'home', 'unusual', 'family', 'everything', 'gifts', 'executor', 'witnesses', 'confirm']);

    const adults = setPerson(none, person('Aarav', 'Son', '1995-01-01'));
    expect(questionsFor(adults, TODAY)).not.toContain('guardian');

    const minor = setPerson(none, person('Aarav', 'Son', '2018-05-01'));
    expect(questionsFor(minor, TODAY)).toEqual(['name', 'born', 'home', 'unusual', 'family', 'everything', 'gifts', 'executor', 'guardian', 'witnesses', 'confirm']);
  });

  it('knows what each question needs, and treats the optional ones as done', () => {
    const r = blankWill();
    expect(isAnswered('name', r)).toBe(false);
    expect(isAnswered('born', r)).toBe(false);
    expect(isAnswered('home', r)).toBe(false);
    expect(isAnswered('everything', r)).toBe(false);
    expect(isAnswered('confirm', r)).toBe(false);
    for (const q of ['unusual', 'family', 'gifts', 'executor', 'guardian', 'witnesses'] as const) expect(isAnswered(q, r), q).toBe(true);

    const a = answered();
    expect(isAnswered('born', a)).toBe(true);
    expect(isAnswered('home', a)).toBe(true);
  });

  it('picks up at the first required question that is still open', () => {
    expect(resumeAt(blankWill('Rohan'), TODAY)).toBe('born');
    expect(resumeAt(blankWill(), TODAY)).toBe('name');
    expect(resumeAt(answered(), TODAY)).toBe('everything');
    const done = applyResiduePreset(answered(), 'spouse');
    expect(resumeAt(done, TODAY)).toBe('confirm');
  });
});

describe('who gets everything', () => {
  it('offers only what this family allows, with a custom split always last', () => {
    expect(residueOptions(blankWill()).map((o) => o.id)).toEqual(['custom']);
    expect(residueOptions(setPerson(blankWill(), person('Nisha', 'Spouse'))).map((o) => o.id)).toEqual(['spouse', 'custom']);
    expect(residueOptions(answered()).map((o) => o.id)).toEqual(['spouse', 'spouse-children', 'children', 'custom']);
    expect(residueOptions(setPerson(blankWill(), person('Aarav', 'Son'))).map((o) => o.id)).toEqual(['children', 'custom']);
  });

  it('turns each ready-made answer into shares that add to exactly 100', () => {
    const r = answered();
    const spouse = applyResiduePreset(r, 'spouse');
    expect(spouse.residue).toHaveLength(1);
    expect(spouse.residue[0]).toMatchObject({ percent: 100, alternateId: '' });
    expect(residueDone(spouse)).toBe(true);

    const all = applyResiduePreset(r, 'spouse-children');
    expect(all.residue).toHaveLength(3);
    expect(all.residue.reduce((n, s) => n + s.percent, 0)).toBeCloseTo(100, 5);
    expect(residueDone(all)).toBe(true);

    const kids = applyResiduePreset(r, 'children');
    expect(kids.residue.map((s) => s.personId)).toEqual(r.people.filter((p) => p.relation !== 'Spouse').map((p) => p.id));
    expect(residueDone(kids)).toBe(true);
  });

  it('recognises the preset it set, ignoring backups, and calls anything else custom', () => {
    const r = answered();
    expect(currentResiduePreset(r)).toBe('');
    expect(currentResiduePreset(applyResiduePreset(r, 'spouse'))).toBe('spouse');
    expect(currentResiduePreset(applyResiduePreset(r, 'spouse-children'))).toBe('spouse-children');
    const withBackup = setSoleBackup(applyResiduePreset(r, 'spouse'), r.people[1].id);
    expect(withBackup.residue[0].alternateId).toBe(r.people[1].id);
    expect(currentResiduePreset(withBackup)).toBe('spouse');
    const odd = { ...applyResiduePreset(r, 'spouse-children') };
    odd.residue = odd.residue.map((s, i) => ({ ...s, percent: i === 0 ? 50 : 25 }));
    expect(currentResiduePreset(odd)).toBe('custom');
  });

  it('does not set a backup on a split, where there is no one person to back up', () => {
    const r = applyResiduePreset(answered(), 'spouse-children');
    expect(setSoleBackup(r, r.people[1].id)).toBe(r);
  });

  it('is not done until the shares add to 100 and name somebody on the list', () => {
    const r = applyResiduePreset(answered(), 'spouse');
    expect(residueDone({ ...r, residue: [{ ...r.residue[0], percent: 60 }] })).toBe(false);
    expect(residueDone({ ...r, residue: [{ ...r.residue[0], personId: 'gone' }] })).toBe(false);
    expect(residueDone({ ...r, residue: [] })).toBe(false);
  });
});

describe('a particular thing for a particular person', () => {
  it('gives an asset to one person in full, and stops when told to', () => {
    let r = answered();
    const flat = { ...blankAsset('property'), id: 'flat', title: 'Flat', details: 'Flat 4, Pune' };
    r = setAsset(r, flat);
    expect(recipientOf(r, 'flat')).toBe('');
    r = giveTo(r, 'flat', r.people[1].id);
    expect(recipientOf(r, 'flat')).toBe(r.people[1].id);
    r = giveTo(r, 'flat', r.people[2].id);
    expect(r.gifts).toHaveLength(1);
    expect(recipientOf(r, 'flat')).toBe(r.people[2].id);
    r = giveTo(r, 'flat', '');
    expect(r.gifts).toHaveLength(0);
    expect(recipientOf(r, 'flat')).toBe('');
  });

  it('reports a split gift as many, and ignores an asset that is not there', () => {
    let r = answered();
    r = setAsset(r, { ...blankAsset('property'), id: 'flat', title: 'Flat', details: 'x' });
    r = { ...r, gifts: [{ id: 'g', assetId: 'flat', shares: [{ personId: r.people[1].id, percent: 50, alternateId: '' }, { personId: r.people[2].id, percent: 50, alternateId: '' }] }] };
    expect(recipientOf(r, 'flat')).toBe('many');
    expect(giveTo(r, 'nothing', r.people[0].id)).toBe(r);
  });
});

describe('the whole flow', () => {
  it('produces a will with nothing left to fix, from ten answers', () => {
    let r = answered();
    r = applyResiduePreset(r, 'spouse-children');
    r = setRole(r, 'executorIds', [r.people[0].id]);
    r = setRole(r, 'guardianIds', [r.people[0].id]);
    r = setPerson(r, person('Kavita Rao', 'Friend'));
    r = setPerson(r, person('Suresh Rao', 'Friend'));
    r = setRole(r, 'witnessIds', [r.people[3].id, r.people[4].id]);
    r.testator = { ...r.testator, soundMind: true, voluntary: true };
    expect(questionsFor(r, TODAY).every((q) => isAnswered(q, r))).toBe(true);
    const fs = checkWill(r, TODAY);
    expect(fs.filter((f) => f.severity === 'act')).toEqual([]);
    expect(readiness(fs).ready).toBe(true);
  });

  it('is held back, as it should be, if a witness is also given something', () => {
    let r = answered();
    r = applyResiduePreset(r, 'spouse-children');
    r = setRole(r, 'witnessIds', [r.people[1].id, r.people[2].id]);
    r.testator = { ...r.testator, soundMind: true, voluntary: true };
    expect(readiness(checkWill(r, TODAY)).ready).toBe(false);
  });
});

describe('signing day', () => {
  it('lists every step of the signing guide once, rules and good practice both', () => {
    expect(SIGNING_STEPS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(SIGNING_STEPS.map((s) => s.key)).size).toBe(SIGNING_STEPS.length);
    expect(SIGNING_STEPS.some((s) => s.kind === 'rule')).toBe(true);
    expect(SIGNING_STEPS.some((s) => s.kind === 'tip')).toBe(true);
  });

  it('ticks and unticks a step, and counts them', () => {
    let r = blankWill();
    expect(signingProgress(r)).toEqual({ done: 0, total: SIGNING_STEPS.length });
    r = toggleSigningStep(r, SIGNING_STEPS[0].key);
    r = toggleSigningStep(r, SIGNING_STEPS[3].key);
    expect(signingProgress(r).done).toBe(2);
    r = toggleSigningStep(r, SIGNING_STEPS[0].key);
    expect(signingProgress(r).done).toBe(1);
    expect(r.register.signingChecks).toEqual([SIGNING_STEPS[3].key]);
  });

  it('drops a tick for a step the guide no longer has', () => {
    const r = { ...blankWill(), register: { ...blankWill().register, signingChecks: ['a step that was removed'] } };
    expect(toggleSigningStep(r, SIGNING_STEPS[0].key).register.signingChecks).toEqual([SIGNING_STEPS[0].key]);
  });

  it('keeps the ticks through a save and reload, and reads an older draft as nothing ticked', () => {
    const r = toggleSigningStep(blankWill('Rohan'), SIGNING_STEPS[1].key);
    expect(readWill(JSON.parse(JSON.stringify(r)))?.register.signingChecks).toEqual([SIGNING_STEPS[1].key]);
    const old = JSON.parse(JSON.stringify(r));
    delete old.register.signingChecks;
    expect(readWill(old)?.register.signingChecks).toEqual([]);
  });
});

describe('when an advocate is worth having', () => {
  it('says what the person told us, in their own words', () => {
    const r = blankWill();
    expect(reasonsForAdvice(r)).toEqual([]);
    r.testator.circumstances = ['second_marriage', 'assets_abroad'];
    expect(reasonsForAdvice(r)).toEqual([CIRCUMSTANCE_LABELS.second_marriage, CIRCUMSTANCE_LABELS.assets_abroad]);
  });
});
