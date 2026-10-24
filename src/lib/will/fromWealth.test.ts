import { describe, expect, it } from 'vitest';
import { blankItem, blankNominee, blankRecord, SELF, type Item, type WealthRecord } from '../wealth/model';
import { checkWill } from './checks';
import { fromWealth, importFromWealth, relationOf } from './fromWealth';
import { blankWill, readWill } from './model';
import { buildWill, plainText } from './document';

/*
 * Wealth Tracker records are built with its own blank*() helpers so these tests
 * move with that module's shapes instead of freezing a copy of them.
 */

function household(): WealthRecord {
  const w = blankRecord('Rohan Mehta');
  w.profile.members.push({ id: 'm1', name: 'Nisha Mehta', relation: 'Wife' }, { id: 'm2', name: 'Aarav', relation: 'Son' });
  w.profile.executor = 'Nisha';

  const bank: Item = { ...blankItem('bank'), id: 'i-bank', kind: 'Savings', value: 420000, fields: { bank: 'State Bank of India', account: '12345678901', branch: 'Sample Nagar', holding: 'Joint', jointHolders: 'Nisha Mehta' } };
  bank.nominee = { status: 'yes', people: [{ ...blankNominee(), id: 'n1', name: 'Nisha Mehta', relation: 'Spouse', dob: '1980-09-03' }] };

  const flat: Item = { ...blankItem('property'), id: 'i-flat', kind: 'Flat / apartment', share: 50, value: 8500000, fields: { address: 'Flat 4,\nExample Heights', city: 'Pune', pin: '411001', coOwners: 'Nisha Mehta', area: '1,050 sq ft', surveyNo: '17/2' } };

  const mf: Item = { ...blankItem('mutual_fund'), id: 'i-mf', fields: { amc: 'Sample AMC', folio: '9988776' } };
  const loan: Item = { ...blankItem('home_loan'), id: 'i-loan', value: 3800000 };
  const card: Item = { ...blankItem('credit_card'), id: 'i-card' };
  w.items = [bank, flat, mf, loan, card];
  return w;
}

describe('fromWealth', () => {
  const imp = fromWealth(household());

  it('takes assets only, and says how many loans it left behind', () => {
    expect(imp.assets.map((a) => a.sourceId)).toEqual(['i-bank', 'i-flat', 'i-mf']);
    expect(imp.liabilitiesLeft).toBe(2);
  });

  it('maps the heads onto will kinds and keeps where each came from', () => {
    expect(imp.assets.map((a) => a.kind)).toEqual(['bank', 'property', 'investment']);
    expect(imp.assets.every((a) => a.source === 'wealth')).toBe(true);
  });

  it('describes a bank account by bank, number and branch, and marks a joint one', () => {
    const bank = imp.assets[0];
    expect(bank).toMatchObject({ institution: 'State Bank of India', identifier: '12345678901', location: 'Sample Nagar', holding: 'joint', coOwners: 'Nisha Mehta', fullIdentifier: false });
    expect(bank.title).toBe('State Bank of India savings account');
    expect(imp.assets[2].title).toBe('Sample AMC mutual fund folio');
  });

  it('describes a property by address, area and survey number, and carries the household share', () => {
    const flat = imp.assets[1];
    expect(flat.location).toBe('Flat 4, Example Heights, Pune, 411001');
    expect(flat.details).toBe('area 1,050 sq ft, survey or plot no. 17/2');
    expect(flat).toMatchObject({ percent: 50, holding: 'joint', coOwners: 'Nisha Mehta', title: 'Flat / apartment' });
  });

  it('brings the nominee across as text on the asset', () => {
    expect(imp.assets[0].nominee).toEqual({ status: 'yes', names: ['Nisha Mehta'] });
  });

  it('makes people from household members and nominees, once each, and not the person themselves', () => {
    expect(imp.people.map((p) => [p.name, p.relation])).toEqual([['Nisha Mehta', 'Spouse'], ['Aarav', 'Son']]);
    expect(imp.selfName).toBe('Rohan Mehta');
    expect(imp.executorHint).toBe('Nisha');
  });

  it('reads Wealth Tracker relations in the will’s words', () => {
    expect(relationOf('Wife')).toBe('Spouse');
    expect(relationOf('husband')).toBe('Spouse');
    expect(relationOf('Other relative')).toBe('Other relative');
    expect(relationOf('Guru')).toBe('Other');
  });

  it('never takes the person’s own entry as a person', () => {
    expect(imp.people.some((p) => p.id.includes(SELF))).toBe(false);
  });
});

describe('importFromWealth', () => {
  it('adds assets and people to a will and names the testator when blank', () => {
    const { record, added, liabilitiesLeft } = importFromWealth(blankWill(), household());
    expect(added).toEqual({ assets: 3, people: 2 });
    expect(liabilitiesLeft).toBe(2);
    expect(record.testator.name).toBe('Rohan Mehta');
    expect(readWill(JSON.parse(JSON.stringify(record)))).toEqual(record);
  });

  it('can be run again without doubling anything up', () => {
    const once = importFromWealth(blankWill(), household()).record;
    const twice = importFromWealth(once, household());
    expect(twice.added).toEqual({ assets: 0, people: 0 });
    expect(twice.record.assets).toHaveLength(3);
  });

  it('leaves what the person already changed exactly as they left it', () => {
    const once = importFromWealth(blankWill('Rohan Mehta'), household()).record;
    once.assets[0].title = 'My salary account';
    once.assets[0].fullIdentifier = true;
    once.testator.name = 'Rohan K. Mehta';
    const twice = importFromWealth(once, household()).record;
    expect(twice.assets[0]).toMatchObject({ title: 'My salary account', fullIdentifier: true });
    expect(twice.testator.name).toBe('Rohan K. Mehta');
  });

  it('matches a person already listed by name, whatever the case', () => {
    const w = blankWill();
    const first = importFromWealth(w, household()).record;
    first.people[0].name = 'NISHA  mehta';
    expect(importFromWealth(first, household()).added.people).toBe(0);
  });

  it('feeds the checks and the builder: an imported will gives its own gaps and still builds', () => {
    const { record } = importFromWealth(blankWill(), household());
    const ids = checkWill(record, '2026-10-24').map((f) => f.id);
    expect(ids).toContain('residue-none');
    expect(ids).toContain('asset-shared:w-i-flat');
    const text = plainText(buildWill(record, '2026-10-24'));
    expect(text).toContain('Flat 4, Example Heights, Pune, 411001');
    expect(text).toContain('no. ending 8901');
    expect(text).not.toContain('12345678901');
  });
});
