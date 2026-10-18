import { describe, expect, it } from 'vitest';
import { compact, inWords, parseMoney, rupees } from './money';
import * as v from './validate';
import { HEADS, fieldsFor, head } from './heads';
import { blankItem, blankRecord, itemName, mask, readRecord, type Item, type WealthRecord } from './model';
import { counted, summarise } from './calc';
import { ageOn, checks, daysUntil } from './checks';
import { isSealed, newLock, open, passcodeStrength, seal } from './lock';

const TODAY = '2026-10-18';

function item(headId: Item['head'], patch: Partial<Item> = {}): Item {
  return { ...blankItem(headId), asOf: TODAY, ...patch };
}

function record(items: Item[], patch: Partial<WealthRecord> = {}): WealthRecord {
  const r = blankRecord('Asha');
  return {
    ...r,
    items,
    lastBackupAt: `${TODAY}T08:00:00.000Z`,
    profile: { ...r.profile, will: 'yes', willKept: 'Locker', trusted: 'Ravi' },
    ...patch,
  };
}

describe('parseMoney', () => {
  it('reads amounts the way they are said in India', () => {
    expect(parseMoney('85 lakh')).toBe(8_500_000);
    expect(parseMoney('85L')).toBe(8_500_000);
    expect(parseMoney('1.2 cr')).toBe(12_000_000);
    expect(parseMoney('2.5 Crore')).toBe(25_000_000);
    expect(parseMoney('45k')).toBe(45_000);
    expect(parseMoney('₹ 12,50,000')).toBe(1_250_000);
    expect(parseMoney('Rs. 1,250,000.50')).toBe(1_250_000.5);
    expect(parseMoney('3 lacs')).toBe(300_000);
  });

  it('never guesses a unit, and refuses what it cannot read', () => {
    expect(parseMoney('85')).toBe(85);
    expect(parseMoney('')).toBeUndefined();
    expect(parseMoney('  ')).toBeUndefined();
    expect(parseMoney('about 5 lakh')).toBeNull();
    expect(parseMoney('5 million')).toBeNull();
    expect(parseMoney('-500')).toBeNull();
    expect(parseMoney('12abc')).toBeNull();
  });

  it('says amounts back in words and in short', () => {
    expect(inWords(8_500_000)).toBe('85 lakh');
    expect(inWords(12_000_000)).toBe('1.2 crore');
    expect(inWords(45_000)).toBe('45 thousand');
    expect(rupees(1_250_000)).toBe('₹12,50,000');
    expect(rupees(1_250_000.5)).toBe('₹12,50,000.50');
    expect(compact(8_500_000)).toBe('₹85 L');
    expect(compact(123_400_000)).toBe('₹12.3 Cr');
  });
});

describe('validators', () => {
  it('checks the shape of an IFSC and says what is wrong', () => {
    expect(v.ifsc('SBIN0001234')).toBeNull();
    expect(v.ifsc('sbin0001234')).toBeNull();
    expect(v.ifsc('SBINO001234')).toMatch(/fifth character/);
    expect(v.ifsc('SBIN000123')).toMatch(/11 characters/);
  });

  it('checks PIN codes, UANs and registrations', () => {
    expect(v.pin('560 001')).toBeNull();
    expect(v.pin('56001')).toMatch(/six digits/);
    expect(v.pin('060001')).toMatch(/does not start with 0/);
    expect(v.twelveDigits('UAN')('1001 2345 6789')).toBeNull();
    expect(v.twelveDigits('UAN')('10012345678')).toMatch(/12 digits; this has 11/);
    expect(v.vehicleReg('MH 12 AB 1234')).toBeNull();
    expect(v.vehicleReg('22 BH 1234 AA')).toBeNull();
    expect(v.vehicleReg('hello')).toMatch(/registration number/);
  });

  it('keeps only the last four digits of a card, whatever is pasted', () => {
    expect(v.keepLastFour('4111 1111 1111 1234')).toBe('1234');
    expect(v.keepLastFour('12')).toBe('12');
    expect(v.lastFour('12')).toMatch(/last four/);
    expect(v.lastFour('1234')).toBeNull();
  });

  it('warns about passwords, PINs and full card numbers in free text', () => {
    expect(v.looksSecret('net banking password is tiger')).toMatch(/password/);
    expect(v.looksSecret('UPI PIN 4321')).toMatch(/PIN/);
    expect(v.looksSecret('card 4111 1111 1111 1111')).toMatch(/full card number/);
    // An account number in the notes is not a card: it fails the Luhn check.
    expect(v.looksSecret('old account 1234567890123456')).toBeNull();
    expect(v.looksSecret('Flat 4B, PIN 560001')).toBeNull();
    expect(v.looksSecret('Kept in the locker at the Jayanagar branch')).toBeNull();
  });
});

describe('heads', () => {
  it('has unique ids and field keys, and every kind list is non-empty', () => {
    const ids = HEADS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const h of HEADS) {
      expect(h.kinds.length).toBeGreaterThan(0);
      const keys = h.fields.map((f) => f.key);
      expect(new Set(keys).size, h.id).toBe(keys.length);
      if (h.number) expect(keys, `${h.id}.number`).toContain(h.number);
    }
  });

  it('asks about a nominee where one can be registered, and not on a loan', () => {
    for (const id of ['bank', 'deposit', 'mutual_fund', 'retirement', 'insurance', 'bonds'] as const) {
      expect(head(id).nominee(head(id).kinds[0], {}), id).toBe(true);
    }
    expect(head('demat').nominee('Demat account', {})).toBe(true);
    expect(head('property').nominee('Flat / apartment', {})).toBe(false);
    expect(head('home_loan').nominee('Home loan', {})).toBe(false);
    // Gold in a bank locker: the locker itself takes a nominee.
    expect(head('gold').nominee('Jewellery', { kept: 'Home' })).toBe(false);
    expect(head('gold').nominee('Jewellery', { kept: 'Bank locker' })).toBe(true);
  });

  it('shows joint-holder questions only on a joint account', () => {
    const keys = (f: Record<string, string>) => fieldsFor(head('bank'), 'Savings', f).map((x) => x.key);
    expect(keys({ holding: 'Single' })).not.toContain('jointHolders');
    expect(keys({ holding: 'Joint' })).toEqual(expect.arrayContaining(['jointHolders', 'mode']));
  });
});

describe('summarise', () => {
  it('adds assets, takes off liabilities, and counts only your share', () => {
    const r = record([
      item('bank', { value: 200_000 }),
      item('property', { value: 10_000_000, share: 50 }),
      item('home_loan', { value: 3_000_000, share: 50, fields: { emi: '40,000' } }),
      item('credit_card', { value: 25_000 }),
    ]);
    const s = summarise(r);
    expect(s.assets).toBe(5_200_000);
    expect(s.liabilities).toBe(1_525_000);
    expect(s.net).toBe(3_675_000);
    expect(s.liquid).toBe(200_000);
    expect(s.secured).toBe(1_500_000);
    expect(s.unsecured).toBe(25_000);
    expect(s.monthlyEmi).toBe(20_000);
    expect(s.debtToAssets).toBeCloseTo(29.33, 2);
  });

  it('keeps term and health cover out of the total, and lists entries with no value', () => {
    const term = item('insurance', { kind: 'Term life', value: 0, fields: { cover: '1 cr' } });
    const blank = item('mutual_fund', { value: null });
    const s = summarise(record([term, blank, item('bank', { value: 1000 })]));
    expect(s.assets).toBe(1000);
    expect(s.cover.map((i) => i.id)).toEqual([term.id]);
    expect(s.unvalued.map((i) => i.id)).toEqual([blank.id]);
    expect(counted(term)).toBe(0);
  });

  it('narrows to one member of the household', () => {
    const r = record([item('bank', { value: 100 }), item('bank', { value: 900, holder: 'spouse' })]);
    r.profile.members.push({ id: 'spouse', name: 'Ravi', relation: 'Spouse' });
    expect(summarise(r).assets).toBe(1000);
    expect(summarise(r, 'spouse').assets).toBe(900);
  });

  it('counts nominee coverage over the entries that take one', () => {
    const r = record([
      item('bank', { value: 1, nominee: { status: 'yes', people: [] } }),
      item('bank', { value: 1, nominee: { status: 'no', people: [] } }),
      item('mutual_fund', { value: 1 }),
      item('property', { value: 1 }),
    ]);
    expect(summarise(r).nominees).toEqual({ applicable: 3, yes: 1, no: 1, unsure: 0, unanswered: 1 });
  });

  it('works out months of spending the liquid assets cover', () => {
    const r = record([item('bank', { value: 300_000 })]);
    r.profile.monthlyExpenses = 50_000;
    expect(summarise(r).monthsCovered).toBe(6);
  });
});

describe('checks', () => {
  const titles = (r: WealthRecord) => checks(r, TODAY).map((f) => `${f.severity}: ${f.title}`);

  it('flags a missing nominee as something to act on, and an unanswered one to review', () => {
    const r = record([
      item('bank', { label: 'SBI savings', value: 1, nominee: { status: 'no', people: [] } }),
      item('mutual_fund', { label: 'Index fund', value: 1 }),
    ]);
    expect(titles(r)).toEqual(
      expect.arrayContaining(['act: No nominee on SBI savings', 'review: Is there a nominee on Index fund?']),
    );
  });

  it('wants nominee shares to add up to 100 and a guardian for a minor', () => {
    const r = record([
      item('bank', {
        label: 'Joint FD',
        value: 1,
        nominee: {
          status: 'yes',
          people: [
            { id: 'a', name: 'Meera', relation: 'Daughter', dob: '2015-04-01', share: '60', guardian: '', phone: '' },
            { id: 'b', name: 'Ravi', relation: 'Spouse', dob: '', share: '30', guardian: '', phone: '' },
          ],
        },
      }),
    ]);
    const t = titles(r);
    expect(t).toContain('act: Nominee shares on Joint FD add up to 90%');
    expect(t).toContain('act: Meera is a minor with no guardian named');
  });

  it('raises dates that are coming up and that have passed', () => {
    const r = record([
      item('deposit', { label: 'FD 1', value: 1, nominee: { status: 'yes', people: [] }, fields: { maturityDate: '2026-11-01' } }),
      item('deposit', { label: 'FD 2', value: 1, nominee: { status: 'yes', people: [] }, fields: { maturityDate: '2026-01-01' } }),
    ]);
    const t = titles(r);
    expect(t).toContain('note: FD 1: matures in 14 days');
    expect(t).toContain('review: FD 2: the maturity date has passed (1 Jan 2026)');
  });

  it('notices an old value, a missing value and a possible duplicate', () => {
    const r = record([
      item('demat', { label: 'Zerodha', value: 1, asOf: '2025-10-01', fields: { boId: '1208 1600 1234 5678' }, nominee: { status: 'yes', people: [] } }),
      item('demat', { label: 'Old entry', value: 1, fields: { boId: '1208160012345678' }, nominee: { status: 'yes', people: [] } }),
      item('vehicle', { label: 'Car', value: null }),
    ]);
    const t = titles(r);
    expect(t).toContain('note: Zerodha: value is 12 months old');
    expect(t).toContain('review: No value for Car');
    expect(t).toContain('review: Old entry may be entered twice');
  });

  it('warns about a password in the notes and a co-owned property counted in full', () => {
    const r = record([
      item('bank', { label: 'HDFC', value: 1, notes: 'netbanking password: tiger', nominee: { status: 'yes', people: [] } }),
      item('property', { label: 'Flat', value: 1, fields: { coOwners: 'Ravi', documents: 'Locker' } }),
    ]);
    const t = titles(r);
    expect(t).toContain('act: HDFC: remove what looks like a password or card number');
    expect(t).toContain('review: Flat: co-owners named, but your share is 100%');
  });

  it('asks about the will, a trusted person and a backup once there is anything in the record', () => {
    const r = record([item('bank', { value: 1, nominee: { status: 'yes', people: [] } })], {
      lastBackupAt: null,
    });
    r.profile.will = '';
    r.profile.trusted = '';
    const t = titles(r);
    expect(t).toEqual(
      expect.arrayContaining([
        'review: Is there a will?',
        'review: Does anyone know this record exists?',
        'review: This record has never been backed up',
      ]),
    );
    expect(checks(blankRecord(), TODAY)).toEqual([]);
  });

  it('puts what to act on first', () => {
    const r = record([
      item('bank', { label: 'A', value: null, nominee: { status: 'no', people: [] } }),
    ]);
    const severities = checks(r, TODAY).map((f) => f.severity);
    expect(severities).toEqual([...severities].sort((a, b) => ['act', 'review', 'note'].indexOf(a) - ['act', 'review', 'note'].indexOf(b)));
  });

  it('counts days and ages by the calendar', () => {
    expect(daysUntil('2026-10-18', '2026-11-01')).toBe(14);
    expect(ageOn('2008-10-19', TODAY)).toBe(17);
    expect(ageOn('2008-10-18', TODAY)).toBe(18);
  });
});

describe('model', () => {
  it('names an entry from its details until the person names it', () => {
    const i = item('bank', { kind: 'Savings', fields: { bank: 'Canara Bank' } });
    expect(itemName(i)).toBe('Canara Bank · Savings account');
    expect(itemName({ ...i, label: 'Salary account' })).toBe('Salary account');
    expect(itemName(item('vehicle'))).toBe('Car');
  });

  it('masks identifying numbers to their last four', () => {
    expect(mask('12345678901')).toBe('••••8901');
    expect(mask('123')).toBe('123');
  });

  it('reads a record back without trusting it', () => {
    const good = record([item('bank', { value: 5 })]);
    const raw = JSON.parse(JSON.stringify(good));
    raw.items.push({ head: 'spaceship', id: 'x' });
    raw.items.push({ head: 'bank', id: 'y', value: 'lots', share: 500, kind: 'Treasure', fields: { bank: 'X', n: 4 } });
    const back = readRecord(raw)!;
    expect(back.items).toHaveLength(2);
    const y = back.items[1];
    expect(y.value).toBeNull();
    expect(y.share).toBe(100);
    expect(y.kind).toBe('Savings');
    expect(y.fields).toEqual({ bank: 'X', n: '4' });
    expect(back.profile.members[0]).toMatchObject({ id: 'self', name: 'Asha' });
    expect(readRecord({ hello: 1 })).toBeNull();
  });
});

describe('lock', () => {
  it('seals and opens a record with the right passcode only', async () => {
    const lock = await newLock('a long passcode');
    const blob = await seal('{"secret":true}', lock);
    expect(isSealed(blob)).toBe(true);
    expect(blob.data).not.toContain('secret');
    const opened = await open(blob, 'a long passcode');
    expect(opened?.plain).toBe('{"secret":true}');
    expect(await open(blob, 'a long passcodf')).toBeNull();
  }, 20_000);

  it('asks for a passcode of some length', () => {
    expect(passcodeStrength('short').ok).toBe(false);
    expect(passcodeStrength('longer one').ok).toBe(true);
  });
});
