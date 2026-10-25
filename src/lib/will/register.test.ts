import { describe, expect, it } from 'vitest';
import { blankItem, blankNominee, blankRecord, type WealthRecord } from '../wealth/model';
import { EXAMPLE_TODAY, exampleWill } from './example';
import { importFromWealth } from './fromWealth';
import { blankPerson, blankWill, type WillRecord } from './model';
import { afterPrompts, applyWriteBack, registerPrompts, reviewPrompts, writeBackPlan } from './register';

const TODAY = EXAMPLE_TODAY; // 2026-10-24

const ids = (ps: { id: string }[]) => ps.map((p) => p.id);

/** A signed will with everything filled in: the register has nothing to say. */
function signed(): WillRecord {
  const w = structuredClone(exampleWill());
  w.register = {
    signedOn: '2026-09-01',
    originalKept: 'Bank locker, Pune',
    executorTold: true,
    alsoKnows: 'Kavita',
    registered: false,
    registeredAt: '',
    reviewBy: '2027-09-01',
    signingChecks: [],
  };
  return w;
}

function household(): WealthRecord {
  const w = blankRecord('Rohan Mehta');
  w.profile.members.push({ id: 'm1', name: 'Nisha Mehta', relation: 'Spouse' }, { id: 'm2', name: 'Aarav Mehta', relation: 'Son' });
  const bank = { ...blankItem('bank'), id: 'i-bank', kind: 'Savings', value: 420000, fields: { bank: 'State Bank of India', account: '12345678901' } };
  bank.nominee = { status: 'yes', people: [{ ...blankNominee(), id: 'n1', name: 'Nisha Mehta', relation: 'Spouse' }] };
  const flat = { ...blankItem('property'), id: 'i-flat', kind: 'Flat / apartment', value: 8500000, fields: { address: 'Flat 4', city: 'Pune' } };
  const loan = { ...blankItem('home_loan'), id: 'i-loan', value: 3800000 };
  w.items = [bank, flat, loan];
  return w;
}

/** A will drafted from that household, with its people, so there is nothing missing to begin with. */
function drafted(): { will: WillRecord; wealth: WealthRecord } {
  const wealth = household();
  const will = importFromWealth(blankWill('Rohan Mehta'), wealth).record;
  return { will, wealth };
}

describe('registerPrompts', () => {
  it('says only that it is not signed, until it is', () => {
    expect(ids(registerPrompts(exampleWill(), TODAY))).toEqual(['unsigned']);
  });

  it('asks where the original is, whether the executor knows, and for a review date', () => {
    const w = structuredClone(exampleWill());
    w.register.signedOn = '2026-09-01';
    expect(ids(registerPrompts(w, TODAY))).toEqual(['where-kept', 'tell-executor', 'review-date']);
  });

  it('has nothing to say about a signed will that is fully recorded', () => {
    expect(registerPrompts(signed(), TODAY)).toEqual([]);
  });

  it('does not ask an executor to be told when none is named', () => {
    const w = signed();
    w.executorIds = [];
    w.register.executorTold = false;
    expect(ids(registerPrompts(w, TODAY))).not.toContain('tell-executor');
  });

  it('flags a signed date that is not a date, or is in the future', () => {
    const w = signed();
    w.register.signedOn = '01/09/2026';
    expect(ids(registerPrompts(w, TODAY))).toContain('signed-date');
    w.register.signedOn = '2027-01-01';
    expect(ids(registerPrompts(w, TODAY))).toContain('signed-future');
  });

  it('warns when the will is recorded as signed but the draft still has things to fix', () => {
    const w = signed();
    w.gifts[0].shares[0].percent = 40;
    const p = registerPrompts(w, TODAY).find((x) => x.id === 'signed-with-open-fixes');
    expect(p?.severity).toBe('review');
    expect(p?.detail).toContain('The signed paper is the will');
  });

  it('notes a registration with no office or number', () => {
    const w = signed();
    w.register.registered = true;
    expect(ids(registerPrompts(w, TODAY))).toContain('registered-where');
    w.register.registeredAt = 'Sub-Registrar, Haveli 4, no. 1234/2026';
    expect(ids(registerPrompts(w, TODAY))).not.toContain('registered-where');
  });
});

describe('reviewPrompts without Wealth Tracker', () => {
  it('says when the date to read it again has come, or is close', () => {
    const w = signed();
    w.register.reviewBy = '2026-10-24';
    expect(reviewPrompts(w, null, TODAY)[0]).toMatchObject({ id: 'review-due', severity: 'review' });
    w.register.reviewBy = '2026-11-10';
    expect(reviewPrompts(w, null, TODAY)[0]).toMatchObject({ id: 'review-soon', title: 'Your review date is in 17 days' });
    w.register.reviewBy = '2027-01-01';
    expect(reviewPrompts(w, null, TODAY)).toEqual([]);
  });

  it('notes a guardian clause left over after the children grew up', () => {
    const w = signed();
    w.people.forEach((p) => (p.dob = p.relation === 'Son' || p.relation === 'Daughter' ? '2000-01-01' : p.dob));
    expect(ids(reviewPrompts(w, null, TODAY))).toContain('guardian-stale');
    expect(ids(reviewPrompts(exampleWill(), null, TODAY))).not.toContain('guardian-stale');
  });
});

describe('reviewPrompts against Wealth Tracker', () => {
  it('has nothing to say when the will and the record agree', () => {
    const { will, wealth } = drafted();
    expect(reviewPrompts(will, wealth, TODAY)).toEqual([]);
  });

  it('says what is in Wealth Tracker and not in the will, naming a few', () => {
    const { will, wealth } = drafted();
    wealth.items.push({ ...blankItem('gold'), id: 'i-gold', value: 300000 });
    const p = reviewPrompts(will, wealth, TODAY).find((x) => x.id === 'wealth-new')!;
    expect(p).toMatchObject({ severity: 'review', title: '1 thing in Wealth Tracker is not in your will' });
    expect(p.detail).toContain('everything else');
  });

  it('says what the will gives that Wealth Tracker no longer has', () => {
    const { will, wealth } = drafted();
    wealth.items = wealth.items.filter((i) => i.id !== 'i-flat');
    const p = reviewPrompts(will, wealth, TODAY).find((x) => x.id === 'wealth-gone')!;
    expect(p.title).toBe('1 thing in your will is no longer in Wealth Tracker');
    expect(p.detail).toContain('does nothing');
  });

  it('does not count loans as things missing from the will', () => {
    const { will, wealth } = drafted();
    wealth.items.push({ ...blankItem('credit_card'), id: 'i-card' });
    expect(ids(reviewPrompts(will, wealth, TODAY))).not.toContain('wealth-new');
  });

  it('names household members who are not in the will, and only family', () => {
    const { will, wealth } = drafted();
    wealth.profile.members.push({ id: 'm3', name: 'Anaya Mehta', relation: 'Daughter' }, { id: 'm4', name: 'Raju', relation: 'Friend' });
    const out = reviewPrompts(will, wealth, TODAY).filter((x) => x.id.startsWith('member:'));
    expect(out.map((x) => x.title)).toEqual(['Anaya Mehta (daughter) is in your household but not in your will']);
  });

  it('matches a household member to the will by name, ignoring case and spacing', () => {
    const { will, wealth } = drafted();
    will.people.push({ ...blankPerson('Daughter'), name: ' anaya  MEHTA ' });
    wealth.profile.members.push({ id: 'm3', name: 'Anaya Mehta', relation: 'Daughter' });
    expect(ids(reviewPrompts(will, wealth, TODAY))).not.toContain('member:m3');
  });

  it('catches a nominee that changed since the will was drafted', () => {
    const { will, wealth } = drafted();
    wealth.items[0].nominee = { status: 'yes', people: [{ ...blankNominee(), id: 'n2', name: 'Aarav Mehta', relation: 'Son' }] };
    const p = reviewPrompts(will, wealth, TODAY).find((x) => x.id.startsWith('nominee-drift'))!;
    expect(p.title).toBe('The nominee on State Bank of India savings account changed in Wealth Tracker');
  });

  it('catches a nominee removed, and ignores the order and spelling of the same nominees', () => {
    const { will, wealth } = drafted();
    wealth.items[0].nominee = { status: 'no', people: [] };
    expect(ids(reviewPrompts(will, wealth, TODAY))).toContain(`nominee-drift:${will.assets[0].id}`);

    const again = drafted();
    again.wealth.items[0].nominee.people[0].name = '  NISHA  mehta ';
    expect(ids(reviewPrompts(again.will, again.wealth, TODAY))).not.toContain(`nominee-drift:${again.will.assets[0].id}`);
  });

  it('ignores a will asset the person typed themselves, since Wealth Tracker never heard of it', () => {
    const { will, wealth } = drafted();
    will.assets.push({ ...structuredClone(will.assets[0]), id: 'typed', source: 'typed', sourceId: '' });
    expect(ids(reviewPrompts(will, wealth, TODAY))).not.toContain('wealth-gone');
  });

  it('lists the worst first, register and review together', () => {
    const { will, wealth } = drafted();
    will.register.signedOn = '2026-09-01';
    wealth.items.push({ ...blankItem('gold'), id: 'i-gold', value: 1 });
    const out = afterPrompts(will, wealth, TODAY);
    const sev = out.map((p) => p.severity);
    expect(sev).toEqual([...sev].sort((a, b) => ['act', 'review', 'note'].indexOf(a) - ['act', 'review', 'note'].indexOf(b)));
    expect(ids(out)).toEqual(expect.arrayContaining(['wealth-new', 'where-kept', 'review-date']));
  });
});

describe('writing back to Wealth Tracker', () => {
  it('says it is drafting while there is something drafted, and yes once signed, with where and who', () => {
    const w = blankRecord('Rohan');
    const draft = exampleWill();
    expect(writeBackPlan(w, draft).map((c) => [c.field, c.to])).toEqual([['will', 'I am drafting one'], ['executor', 'Nisha Mehta']]);

    const s = signed();
    expect(writeBackPlan(w, s).map((c) => [c.field, c.to])).toEqual([
      ['will', 'Yes, I have a will'],
      ['willKept', 'Bank locker, Pune'],
      ['executor', 'Nisha Mehta'],
    ]);
  });

  it('changes only what differs', () => {
    const w = blankRecord('Rohan');
    w.profile.will = 'yes';
    w.profile.willKept = 'Bank locker, Pune';
    w.profile.executor = 'Nisha Mehta';
    expect(writeBackPlan(w, signed())).toEqual([]);
  });

  it('never downgrades “I have a will”, and never replaces something with a blank', () => {
    const w = blankRecord('Rohan');
    w.profile.will = 'yes';
    w.profile.willKept = 'The steel almirah';
    w.profile.executor = 'My brother';
    const draft = exampleWill();
    draft.executorIds = [];
    expect(writeBackPlan(w, draft)).toEqual([]);
  });

  it('does nothing for an empty will', () => {
    expect(writeBackPlan(blankRecord('Rohan'), blankWill())).toEqual([]);
  });

  it('applies the plan to the profile and nothing else', () => {
    const w = household();
    const before = JSON.stringify(w);
    const profile = applyWriteBack(w, signed(), writeBackPlan(w, signed()));
    expect(profile).toMatchObject({ will: 'yes', willKept: 'Bank locker, Pune', executor: 'Nisha Mehta' });
    expect(profile.members).toEqual(w.profile.members);
    expect(JSON.stringify(w)).toBe(before);
  });
});
