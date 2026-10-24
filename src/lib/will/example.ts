import {
  blankAsset,
  blankPerson,
  blankWill,
  type Asset,
  type AssetKind,
  type Person,
  type Relation,
  type WillRecord,
} from './model';

/**
 * A worked example: one complete, valid will for an invented family.
 *
 * SAMPLE DATA. Every name, address, account number and date below is made up
 * for illustration; nobody by these names is meant. Anywhere the product shows
 * it, it is labelled a sample (HANDOFF §2: never present invented data as
 * real). It is what the tests read, what the public page's demo will show, and
 * the "sample will" people can download to see what they are making.
 *
 * It is also the baseline the tests bend: each check's test changes one thing
 * in a copy of this record and expects exactly one finding to appear.
 */

/** The day the example is "today" for, so ages and the minors in it never drift. */
export const EXAMPLE_TODAY = '2026-10-24';

const person = (id: string, name: string, relation: Relation, dob = '', address = ''): Person => ({
  ...blankPerson(relation),
  id,
  name,
  dob,
  address,
});

const asset = (id: string, kind: AssetKind, rest: Partial<Asset>): Asset => ({ ...blankAsset(kind), id, ...rest });

export function exampleWill(): WillRecord {
  const w = blankWill('Rohan Mehta');
  w.testator = {
    ...w.testator,
    kinRelation: 'son',
    kinName: 'Suresh Mehta',
    dob: '1978-04-12',
    religion: 'Hindu',
    maritalStatus: 'married',
    occupation: 'consultant',
    address: '14 Example Lane, Sample Nagar, Pune 411001',
    state: 'Maharashtra',
    soundMind: true,
    voluntary: true,
  };

  w.people = [
    person('nisha', 'Nisha Mehta', 'Spouse', '1980-09-03'),
    person('aarav', 'Aarav Mehta', 'Son', '2012-06-20'),
    person('anaya', 'Anaya Mehta', 'Daughter', '2015-02-11'),
    person('kavita', 'Kavita Rao', 'Sister', '1982-01-30', '9 Sample Road, Mumbai 400001'),
    person('dev', 'Dev Kulkarni', 'Friend', '1984-07-07', '21 Example Society, Pune 411002'),
    person('smita', 'Smita Joshi', 'Friend', '1986-11-19', '5 Sample Colony, Pune 411003'),
  ];

  w.assets = [
    asset('flat', 'property', {
      title: 'Flat in Pune',
      location: 'Flat 402, Example Heights, Sample Road, Pune 411001',
      details: 'area 1,050 sq ft carpet, sale deed no. 1234/2019',
    }),
    asset('sbi', 'bank', {
      title: 'State Bank of India savings account',
      institution: 'State Bank of India',
      identifier: '12345678901',
      location: 'Sample Nagar branch',
    }),
    asset('mf', 'investment', {
      title: 'Mutual fund folio',
      institution: 'Sample Asset Management',
      identifier: '9988776',
      nominee: { status: 'yes', names: ['Nisha Mehta'] },
    }),
    asset('policy', 'insurance', {
      title: 'Life policy',
      institution: 'Sample Life Insurance',
      identifier: '5551230987',
      nominee: { status: 'yes', names: ['Nisha Mehta'] },
    }),
  ];

  w.gifts = [
    { id: 'g-flat', assetId: 'flat', shares: [{ personId: 'nisha', percent: 100, alternateId: 'aarav' }] },
    { id: 'g-sbi', assetId: 'sbi', shares: [{ personId: 'nisha', percent: 100, alternateId: 'kavita' }] },
    {
      id: 'g-mf',
      assetId: 'mf',
      shares: [
        { personId: 'aarav', percent: 50, alternateId: 'anaya' },
        { personId: 'anaya', percent: 50, alternateId: 'aarav' },
      ],
    },
  ];
  w.residue = [{ personId: 'nisha', percent: 100, alternateId: 'kavita' }];

  w.executorIds = ['nisha', 'kavita'];
  w.guardianIds = ['kavita'];
  w.witnessIds = ['dev', 'smita'];
  w.signing = { place: 'Pune', date: '2026-10-24' };
  w.updatedAt = '2026-10-24T00:00:00.000Z';
  return w;
}
