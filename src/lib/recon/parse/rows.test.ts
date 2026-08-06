import { describe, expect, it } from 'vitest';
import { detectColumns, findHeader, parseStatus } from './columns';
import { LedgerParseError, parseRowsToLedger } from './rows';

/** Rows plus the flat text a real reader also hands over. */
const asFile = (rows: string[][]) => ({ rows, text: rows.map((r) => r.join(' ')).join('\n') });

const parse = (rows: string[][], name = 'Ledger A') => {
  const file = asFile(rows);
  return parseRowsToLedger(file.rows, file.text, { name, filename: 'test.csv' });
};

const SIMPLE = [
  ['Opening Balance (as on 01-Apr-2026): 10,00,000', '', '', ''],
  ['Date', 'Particular', 'Debit', 'Credit'],
  ['05-Apr-2026', 'Sales receipt - INV001', '50,000', '-'],
  ['15-Apr-2026', 'Cheque payment - rent', '-', '5,000'],
  ['Closing Balance (as on 30-Apr-2026): 10,45,000', '', '', ''],
];

describe('finding the header', () => {
  it('takes the row that names a date and a narration', () => {
    expect(findHeader(SIMPLE).index).toBe(1);
  });

  it('maps the four required columns wherever they sit', () => {
    const { mapping } = findHeader([['Narration', 'Credit', 'Txn Date', 'Debit']]);
    expect(mapping).toMatchObject({ particular: 0, credit: 1, date: 2, debit: 3 });
  });

  it('claims Clearing Date before Date, so timing is not read off it', () => {
    const { mapping } = findHeader([['Date', 'Particular', 'Clearing Date', 'Debit', 'Credit']]);
    expect(mapping.date).toBe(0);
    expect(mapping.clearingDate).toBe(2);
  });

  it('never lets an optional column take one a required column holds', () => {
    // "Cheque No" would otherwise be a candidate for both reference and nothing
    // else, but "Debit" must not be reachable as a reference.
    const { mapping } = findHeader([['Date', 'Narration', 'Cheque No', 'Debit', 'Credit']]);
    expect(mapping.reference).toBe(2);
    expect(mapping.debit).toBe(3);
  });

  it('reports no header when there is none', () => {
    const detected = detectColumns([['01-Apr-2026', 'Sales', '100', '']]);
    expect(detected.headerDetected).toBe(false);
    expect(detected.autoMapping.date).toBeNull();
  });
});

describe('reading balances', () => {
  it('takes the opening from a sentence above the table', () => {
    const ledger = parse(SIMPLE);
    expect(ledger.openingBalance).toBe(1_000_000);
    expect(ledger.openingDate).toBe('2026-04-01');
    expect(ledger.openingBalanceDetected).toBe(true);
  });

  it('does not mistake the digits inside the date for the amount', () => {
    const rows = [
      ['Opening Balance (as on 01/04/2026): 10,00,000', '', '', ''],
      ['Date', 'Particular', 'Debit', 'Credit'],
      ['05-Apr-2026', 'Sales', '100', ''],
    ];
    expect(parse(rows).openingBalance).toBe(1_000_000);
  });

  it('takes the closing too, and its date', () => {
    const ledger = parse(SIMPLE);
    expect(ledger.closingBalance).toBe(1_045_000);
    expect(ledger.closingDate).toBe('2026-04-30');
  });

  it('reads a credit opening as negative', () => {
    const rows = [
      ['Opening Balance (as on 01-Apr-2026): 15,000 Cr', '', '', ''],
      ['Date', 'Particular', 'Debit', 'Credit'],
      ['05-Apr-2026', 'Sales', '100', ''],
    ];
    expect(parse(rows).openingBalance).toBe(-15_000);
  });

  it('reads an opening row inside the table, and takes its sign from the column', () => {
    // Free text carries no Dr/Cr marker and would default positive, so the
    // inline row is the one that knows a credit opening is a credit.
    const rows = [
      ['Date', 'Particular', 'Debit', 'Credit'],
      ['01-Apr-2026', 'Opening Balance', '', '15,000'],
      ['05-Apr-2026', 'Sales', '100', ''],
    ];
    const ledger = parse(rows);
    expect(ledger.openingBalance).toBe(-15_000);
    expect(ledger.openingDate).toBe('2026-04-01');
    // And it is a balance, not a transaction.
    expect(ledger.transactions).toHaveLength(1);
  });

  it('lets a stated closing outrank an inline closing row', () => {
    /*
     * Tally prints the closing in the BALANCING column, so its column sign is
     * inverted and only the printed label knows the truth. The opening is the
     * other way round, which is why only this one defers.
     */
    const rows = [
      ['Closing Balance (as on 30-Apr-2026): 20,650 Cr', '', '', ''],
      ['Date', 'Particular', 'Debit', 'Credit'],
      ['05-Apr-2026', 'Sales', '100', ''],
      ['30-Apr-2026', 'Closing Balance', '20,650', ''],
    ];
    expect(parse(rows).closingBalance).toBe(-20_650);
  });

  it('says so when it found no opening line at all', () => {
    const rows = [
      ['Date', 'Particular', 'Debit', 'Credit'],
      ['05-Apr-2026', 'Sales', '100', ''],
    ];
    expect(parse(rows).openingBalanceDetected).toBe(false);
  });
});

describe('reading transactions', () => {
  it('reads the lines and their sides', () => {
    const [receipt, rent] = parse(SIMPLE).transactions;
    expect(receipt).toMatchObject({
      date: '2026-04-05',
      particular: 'Sales receipt - INV001',
      debit: 50_000,
      credit: 0,
    });
    expect(rent).toMatchObject({ date: '2026-04-15', debit: 0, credit: 5_000 });
  });

  it('records the source row, so a difference can be traced back to a line', () => {
    expect(parse(SIMPLE).transactions[0].row).toBe(3);
  });

  it('reads columns by position when the file has no header', () => {
    const rows = [
      ['01-Apr-2026', 'Sales', '100', ''],
      ['02-Apr-2026', 'Rent', '', '40'],
    ];
    const ledger = parse(rows);
    expect(ledger.transactions.map((t) => t.particular)).toEqual(['Sales', 'Rent']);
  });

  it('skips a total row, which has figures and no narration', () => {
    // Taken as a transaction, a grand total would double the whole ledger.
    const rows = [
      ['Date', 'Particular', 'Debit', 'Credit'],
      ['05-Apr-2026', 'Sales', '100', ''],
      ['', '', '2,33,388.08', '2,07,684.08'],
    ];
    expect(parse(rows).transactions).toHaveLength(1);
  });

  it('drops one malformed row rather than the whole file', () => {
    const rows = [
      ['Date', 'Particular', 'Debit', 'Credit'],
      ['05-Apr-2026', 'Sales', '100', ''],
      ['06-Apr-2026', 'Broken', 'see attached', ''],
      ['07-Apr-2026', 'Rent', '', '40'],
    ];
    expect(parse(rows).transactions.map((t) => t.particular)).toEqual(['Sales', 'Rent']);
  });

  it('takes a bare day-month from the opening balance year', () => {
    const rows = [
      ['Opening Balance (as on 01-Apr-2026): 1,000', '', '', ''],
      ['Date', 'Particular', 'Debit', 'Credit'],
      ['15-Apr', 'Sales', '100', ''],
    ];
    expect(parse(rows).transactions[0].date).toBe('2026-04-15');
  });
});

describe('the optional columns', () => {
  const rows = [
    ['Date', 'Particular', 'Cheque No', 'Clearing Date', 'Debit', 'Credit', 'Status', 'Notes'],
    ['05-Apr-2026', 'Rent', 'CHQ-4471', '12-Apr-2026', '', '5,000', 'Pending', 'Chased twice'],
  ];

  it('reads all of them when they are there', () => {
    expect(parse(rows).transactions[0]).toMatchObject({
      reference: 'CHQ-4471',
      clearingDate: '2026-04-12',
      status: 'PENDING',
      notes: 'Chased twice',
      credit: 5_000,
    });
  });

  it('leaves them empty when they are not', () => {
    expect(parse(SIMPLE).transactions[0]).toMatchObject({
      reference: null,
      clearingDate: null,
      status: null,
      notes: null,
    });
  });

  it('understands the words people actually type in a status column', () => {
    expect(parseStatus('Cleared')).toBe('CLEARED');
    expect(parseStatus('  in transit ')).toBe('PENDING');
    expect(parseStatus('Bounced')).toBe('REVERSED');
    expect(parseStatus('On Hold')).toBe('HOLD');
    expect(parseStatus('something else')).toBeNull();
    expect(parseStatus('')).toBeNull();
  });
});

describe('a file that is not a ledger', () => {
  it('refuses it rather than returning an empty one', () => {
    expect(() => parse([['Invoice'], ['Thank you for your business']])).toThrow(LedgerParseError);
  });
});
