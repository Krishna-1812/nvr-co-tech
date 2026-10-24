import { describe, expect, it } from 'vitest';
import { ADVOCATE_QUESTIONS, BLANK, describeAsset, joinNames, longDate, shownIdentifier } from './clauses';
import { buildWill, plainText } from './document';
import { EXAMPLE_TODAY, exampleWill } from './example';
import { blankAsset, blankWill, type WillRecord } from './model';

const build = (edit: (w: WillRecord) => void = () => {}) => {
  const w = structuredClone(exampleWill());
  edit(w);
  return buildWill(w, EXAMPLE_TODAY);
};
const text = (edit?: (w: WillRecord) => void) => plainText(build(edit));
const section = (edit: ((w: WillRecord) => void) | undefined, id: string) => build(edit).sections.find((s) => s.id === id);

describe('the worked example', () => {
  it('reads as the golden copy a person has reviewed', async () => {
    // Update deliberately: `npx vitest run -u src/lib/will/document.test.ts`, then read the diff.
    await expect(text()).toMatchFileSnapshot('./example.golden.txt');
  });

  it('numbers its clauses 1, 2, 3… with no gaps, whatever is left out', () => {
    const doc = build((w) => {
      w.guardianIds = [];
      w.extras.payDebts = false;
    });
    expect(doc.sections.map((s) => s.number)).toEqual(doc.sections.map((_, i) => i + 1));
    expect(doc.sections.map((s) => s.id)).not.toContain('guardian');
    expect(doc.sections.map((s) => s.id)).not.toContain('debts');
  });

  it('is deterministic: the same record builds the same will', () => {
    expect(text()).toBe(text());
    expect(buildWill(exampleWill(), EXAMPLE_TODAY)).toEqual(buildWill(exampleWill(), EXAMPLE_TODAY));
  });

  it('never mutates the record', () => {
    const w = exampleWill();
    const before = JSON.stringify(w);
    buildWill(w, EXAMPLE_TODAY);
    expect(JSON.stringify(w)).toBe(before);
  });
});

describe('opening and revocation', () => {
  it('introduces the testator the way an Indian will does', () => {
    expect(build().opening[0]).toBe(
      'I, Rohan Mehta, son of Suresh Mehta, aged about 48 years, Hindu by religion, consultant, living at 14 Example Lane, Sample Nagar, Pune 411001, make this will of my own free will, while of sound mind and not under pressure from anyone.',
    );
  });

  it('leaves out what it was not told instead of printing a blank', () => {
    const o = build((w) => Object.assign(w.testator, { kinRelation: '', dob: '', religion: '', occupation: '' })).opening[0];
    expect(o).toBe('I, Rohan Mehta, living at 14 Example Lane, Sample Nagar, Pune 411001, make this will of my own free will, while of sound mind and not under pressure from anyone.');
  });

  it('always cancels earlier wills first (s.70)', () => {
    expect(build().sections[0]).toMatchObject({ id: 'revocation', number: 1 });
  });
});

describe('gifts', () => {
  it('gives each asset by its Schedule number, with its backup', () => {
    const g = section(undefined, 'gifts')!;
    expect(g.items[0]).toBe('I give item 1 of the Schedule (Flat in Pune) to Nisha Mehta (my spouse). If Nisha Mehta does not survive me, I give it to Aarav Mehta (my son).');
  });

  it('splits a gift in shares and gives each share its own backup', () => {
    const item = section(undefined, 'gifts')!.items[2];
    expect(item).toContain('to the following people, in these shares: Aarav Mehta (50%) and Anaya Mehta (50%).');
    expect(item).toContain('If Aarav Mehta does not survive me, that share goes to Anaya Mehta (my daughter).');
  });

  it('gives only a share of a shared asset, and only an interest in a joint one', () => {
    expect(section((w) => (w.assets[0].percent = 50), 'gifts')!.items[0]).toContain('I give my 50% share in item 1 of the Schedule (Flat in Pune) to');
    expect(section((w) => (w.assets[1].holding = 'joint'), 'gifts')!.items[1]).toContain('I give my interest in item 2 of the Schedule');
  });

  it('leaves the gifts clause out when nothing is given by name', () => {
    expect(section((w) => (w.gifts = []), 'gifts')).toBeUndefined();
  });

  it('skips a gift whose asset has gone, rather than printing a hole', () => {
    const g = section((w) => (w.assets = w.assets.filter((a) => a.id !== 'flat')), 'gifts')!;
    expect(g.items).toHaveLength(2);
  });
});

describe('everything else', () => {
  it('names who takes the rest, the backup, and the last resort', () => {
    const r = section(undefined, 'residue')!;
    expect(r.paragraphs[0]).toContain('including anything I get after I sign this will');
    expect(r.paragraphs[1]).toBe('If Nisha Mehta does not survive me, I give it to Kavita Rao (my sister).');
    expect(section(undefined, 'fallback')!.paragraphs[0]).toContain('my heirs');
  });

  it('prints neither when there is no residue', () => {
    const ids = build((w) => (w.residue = [])).sections.map((s) => s.id);
    expect(ids).not.toContain('residue');
    expect(ids).not.toContain('fallback');
  });
});

describe('executor and guardian', () => {
  it('puts the address where it helps find them, for each of them', () => {
    const e = section(undefined, 'executors')!.paragraphs;
    expect(e[0]).toBe('I appoint Nisha Mehta (my spouse) as executor of this will.');
    expect(e[1]).toBe('If Nisha Mehta dies before me, or cannot or will not act, I appoint Kavita Rao (my sister), of 9 Sample Road, Mumbai 400001, as executor in that person’s place.');
    expect(section(undefined, 'guardian')!.paragraphs[0]).toContain('I appoint Kavita Rao (my sister), of 9 Sample Road, Mumbai 400001, as the child’s guardian');
  });

  it('chains a third executor to the second', () => {
    const e = section((w) => (w.executorIds = ['nisha', 'kavita', 'dev']), 'executors')!.paragraphs;
    expect(e[2]).toContain('If Kavita Rao dies before me');
  });

  it('prints no executor clause when none is named', () => {
    expect(section((w) => (w.executorIds = []), 'executors')).toBeUndefined();
  });
});

describe('wishes', () => {
  it('prints each wish under its own heading and never inside a legal clause', () => {
    const doc = build((w) => {
      w.extras.funeral = 'A simple cremation.';
      w.extras.pets = 'Biscuit goes to Kavita.';
    });
    const funeral = doc.sections.find((s) => s.id === 'funeral')!;
    expect(funeral.heading).toBe('My wishes for my funeral');
    expect(funeral.paragraphs).toContain('A simple cremation.');
    expect(doc.sections.find((s) => s.id === 'pets')!.paragraphs).toContain('Biscuit goes to Kavita.');
    expect(doc.sections.find((s) => s.id === 'digital')).toBeUndefined();
    for (const s of doc.sections.filter((x) => !['funeral', 'pets', 'digital'].includes(x.id))) {
      expect(JSON.stringify(s)).not.toContain('A simple cremation');
    }
  });
});

describe('the Schedule', () => {
  it('shows an account by its last four digits unless the person prints it whole', () => {
    expect(build().schedule[1].description).toBe('State Bank of India, no. ending 8901, Sample Nagar branch');
    expect(build((w) => (w.assets[1].fullIdentifier = true)).schedule[1].description).toContain('no. 12345678901');
  });

  it('prints a short identifier whole, since there is nothing to hide', () => {
    expect(shownIdentifier({ ...blankAsset('bank'), identifier: '4821' })).toBe('4821');
    expect(shownIdentifier({ ...blankAsset('bank'), identifier: '12 34 56 78 90' })).toBe('ending 7890');
    expect(shownIdentifier(blankAsset('bank'))).toBe('');
  });

  it('describes what it was told, in the order a bank or registrar would look', () => {
    expect(describeAsset({ ...blankAsset('property'), location: 'Flat 4', details: '900 sq ft' })).toBe('Flat 4, 900 sq ft');
    expect(describeAsset(blankAsset('other'))).toBe('');
  });

  it('gives a blank line to write on for an asset with no description', () => {
    const doc = build((w) => w.assets.push(blankAsset('other')));
    expect(doc.schedule.at(-1)).toMatchObject({ no: 5, kind: 'Other asset', description: BLANK });
  });

  it('says how much of each asset is being given', () => {
    const doc = build((w) => {
      w.assets[0].percent = 50;
      w.assets[1].holding = 'joint';
    });
    expect(doc.schedule.map((r) => r.ownership)).toEqual(['My 50% share', 'My interest', 'The whole', 'The whole']);
  });
});

describe('signing and witnessing', () => {
  it('always leaves two witness lines, filling them from the people named', () => {
    expect(build().attestation.witnesses.map((w) => w.name)).toEqual(['Dev Kulkarni', 'Smita Joshi']);
    expect(build((w) => (w.witnessIds = [])).attestation.witnesses).toEqual([{ name: '', address: '' }, { name: '', address: '' }]);
    expect(build((w) => (w.witnessIds = ['dev'])).attestation.witnesses).toHaveLength(2);
  });

  it('writes the date in words, and leaves a line when it is blank', () => {
    expect(build().signing.text).toContain('at Pune on 24 October 2026');
    expect(build((w) => (w.signing = { place: '', date: '' })).signing.text).toContain(`at ${BLANK} on ${BLANK}`);
  });

  it('says the witnesses saw the signature or had it acknowledged (s.63(c))', () => {
    expect(build().attestation.text).toContain('saw Rohan Mehta sign this will, or received from that person a personal acknowledgement');
  });
});

describe('an unfinished record', () => {
  it('still builds, with lines to write on instead of failing', () => {
    const out = plainText(buildWill(blankWill(), EXAMPLE_TODAY));
    expect(out).toContain(`I, ${BLANK}, living at ${BLANK}`);
    expect(out).toContain('Witness 2');
  });
});

describe('helpers', () => {
  it('joins names the way a sentence does', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames(['A', 'B'])).toBe('A and B');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
  });

  it('writes dates in words and refuses anything else', () => {
    expect(longDate('2026-01-05')).toBe('5 January 2026');
    expect(longDate('2026-13-05')).toBe('');
    expect(longDate('5 Jan 2026')).toBe('');
  });

  it('keeps a question for the advocate against every clause that rests on judgement', () => {
    expect(ADVOCATE_QUESTIONS.length).toBeGreaterThan(0);
    const ids = new Set(build((w) => (w.extras.digital = 'x')).sections.map((s) => s.id));
    for (const q of ADVOCATE_QUESTIONS) {
      // Each question is about a clause that exists, or about wording shared by all of them.
      expect(['fallback', 'debts', 'guardian', 'digital', 'joint', 'attestation', 'identification']).toContain(q.clause);
      if (['fallback', 'debts', 'guardian', 'digital'].includes(q.clause)) expect(ids.has(q.clause)).toBe(true);
    }
  });
});
