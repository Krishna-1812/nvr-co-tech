import * as v from './validate';

/**
 * What can go into a wealth record, head by head.
 *
 * Each head is a kind of thing an Indian household actually owns or owes, with
 * the details that identify it on paper: the ones a family member would need to
 * find it, and to claim it, if they had to. Fields are split in two. The first
 * few (`more` unset) are what most people know offhand and are always shown;
 * the rest sit under "More details", so the form a person meets first is short
 * and nobody is made to feel they have failed it by leaving a box empty.
 *
 * Nothing here is required except a value, and even that can wait: an entry
 * with no value is kept and listed under the checks rather than refused.
 *
 * The heads are deliberately the plain names people use ("Gold, silver &
 * jewellery", not "Precious metals"), and each carries examples so a person
 * looking for where their Sukanya account goes finds "Provident fund, PPF &
 * NPS" without having to know that is the right shelf.
 *
 * ── Adding a head ──────────────────────────────────────────────────────────
 * Add it to HEADS with a new id, give it a group, and add an icon for it in
 * components/wealth/icons.ts. Field keys are stored in people's records and in
 * their backups, so never rename a key: add a new one and leave the old one.
 */

export type Side = 'asset' | 'liability';

export type HeadId =
  | 'bank'
  | 'deposit'
  | 'demat'
  | 'mutual_fund'
  | 'retirement'
  | 'insurance'
  | 'property'
  | 'gold'
  | 'vehicle'
  | 'bonds'
  | 'business'
  | 'receivable'
  | 'other_asset'
  | 'home_loan'
  | 'vehicle_loan'
  | 'personal_loan'
  | 'education_loan'
  | 'secured_loan'
  | 'credit_card'
  | 'informal_loan'
  | 'other_liability';

/** The broad classes the overview and the allocation bar group heads into. */
export type GroupId =
  | 'cash'
  | 'market'
  | 'retirement'
  | 'property'
  | 'gold'
  | 'other'
  | 'secured'
  | 'unsecured';

export const GROUPS: Record<GroupId, { name: string; side: Side; tone: string }> = {
  cash: { name: 'Cash & deposits', side: 'asset', tone: 'var(--h-cyan)' },
  market: { name: 'Shares, funds & bonds', side: 'asset', tone: 'var(--h-indigo)' },
  retirement: { name: 'Retirement & insurance', side: 'asset', tone: 'var(--h-emerald)' },
  property: { name: 'Property', side: 'asset', tone: 'var(--h-violet)' },
  gold: { name: 'Gold & jewellery', side: 'asset', tone: 'var(--h-amber)' },
  other: { name: 'Vehicles, business & other', side: 'asset', tone: 'var(--h-lime)' },
  secured: { name: 'Secured loans', side: 'liability', tone: 'var(--h-rose)' },
  unsecured: { name: 'Cards & other loans', side: 'liability', tone: 'var(--h-magenta)' },
};

export type Fields = Record<string, string>;

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'money'
  | 'percent'
  | 'date'
  | 'select'
  | 'number'
  /** An identifying number, masked in lists and on screen until revealed. */
  | 'secret'
  /** Exactly four digits; anything longer is cut to its last four as it is typed. */
  | 'lastFour'
  /** Another entry in the record, chosen from a list (a loan's property). */
  | 'link';

export type FieldSpec = {
  key: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  placeholder?: string;
  hint?: string;
  /** Under "More details" rather than always shown. */
  more?: boolean;
  check?: v.Check;
  /** Stored in capitals (IFSC, registration numbers). */
  upper?: boolean;
  /** Shown only when this holds, e.g. joint-holder names only for a joint account. */
  showIf?: (fields: Fields, kind: string) => boolean;
  inputMode?: 'numeric' | 'decimal' | 'text' | 'email' | 'tel';
  /** For `link`: which heads it may point at. */
  linkHeads?: readonly HeadId[];
  /** Takes a whole row on wide screens. */
  wide?: boolean;
};

/** A date on an entry that the checks keep an eye on. */
export type Watch = {
  key: string;
  /** How it reads in a check: "Matures", "Premium due", "Insurance renews". */
  verb: string;
  /** The date, named: "maturity date", "premium date". */
  noun: string;
  /** Raise it this many days ahead. */
  ahead: number;
  /** What to say once it has passed. */
  passed: string;
  /** Only when this holds (e.g. a premium date only while premiums are being paid). */
  when?: (fields: Fields, kind: string) => boolean;
};

export type HeadSpec = {
  id: HeadId;
  side: Side;
  group: GroupId;
  /** The shelf's name: "Bank accounts". */
  name: string;
  /** One of them: "bank account". */
  one: string;
  /** Where things go, said with examples. */
  examples: string;
  kinds: readonly string[];
  /** What the one figure on the entry means. */
  valueLabel: string;
  valueHint?: string;
  /** Whether to ask about a nominee, given the kind and details. */
  nominee: (kind: string, fields: Fields) => boolean;
  /** Turned into cash within a few days without a penalty worth worrying about. */
  liquid: (kind: string) => boolean;
  /** Whether the value adds to net worth at all (term and health cover do not). */
  counts: (kind: string) => boolean;
  /** Asks for "your share" — joint accounts, co-owned property, shared loans. */
  shared: boolean;
  /** The field naming the institution or counterparty, shown under the label in lists. */
  who: string;
  /** The identifying number, shown masked in lists. */
  number?: string;
  /** Builds a name for the entry from what has been typed, until the person names it. */
  suggest: (kind: string, fields: Fields) => string;
  fields: readonly FieldSpec[];
  watch?: readonly Watch[];
  /** Months after which the value is called out as needing a refresh. */
  staleAfter: number;
};

const YES_NO = ['Yes', 'No'] as const;
const always = () => true;
const never = () => false;
const isJoint = (f: Fields) => f.holding === 'Joint';
const join = (...parts: (string | undefined)[]) =>
  parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' · ');

/*
 * The fields every loan shares. Written once so a home loan and a car loan ask
 * for the same things in the same order and with the same words.
 */
function loanFields({
  lender = 'Lender',
  account = 'Loan account number',
  link,
  extra = [],
}: {
  lender?: string;
  account?: string;
  link?: { label: string; heads: readonly HeadId[] };
  extra?: readonly FieldSpec[];
} = {}): FieldSpec[] {
  return [
    { key: 'lender', label: lender, kind: 'text', placeholder: 'e.g. the bank or company' },
    { key: 'account', label: account, kind: 'secret', check: v.accountNumber, inputMode: 'text' },
    { key: 'emi', label: 'EMI', kind: 'money', hint: 'What goes out every month' },
    { key: 'rate', label: 'Interest rate', kind: 'percent', check: v.percent, hint: 'A year, e.g. 8.5' },
    { key: 'endDate', label: 'Last EMI on', kind: 'date' },
    ...(link
      ? [{ key: 'linked', label: link.label, kind: 'link' as const, linkHeads: link.heads, hint: 'So the record shows what this loan paid for' }]
      : []),
    { key: 'sanctioned', label: 'Amount borrowed', kind: 'money', more: true, hint: 'The sanctioned amount' },
    { key: 'rateType', label: 'Rate type', kind: 'select', options: ['Floating', 'Fixed'], more: true },
    { key: 'emiDay', label: 'EMI date', kind: 'number', check: v.dayOfMonth, inputMode: 'numeric', more: true, hint: 'Day of the month, 1 to 31' },
    { key: 'startDate', label: 'Loan taken on', kind: 'date', more: true },
    { key: 'coBorrower', label: 'Co-borrower', kind: 'text', more: true, placeholder: 'Name, if anyone shares the loan' },
    {
      key: 'protected',
      label: 'Covered by loan insurance?',
      kind: 'select',
      options: ['Yes', 'No', 'Not sure'],
      more: true,
      hint: 'A policy that pays off the loan if the borrower dies',
    },
    ...extra,
  ];
}

const LOAN_WATCH: readonly Watch[] = [
  { key: 'endDate', verb: 'Last EMI', noun: 'last EMI date', ahead: 45, passed: 'The last EMI date has passed. If it is paid off, get the closure letter and the NOC, then mark this zero or delete it.' },
];

export const HEADS: readonly HeadSpec[] = [
  // ── Assets ────────────────────────────────────────────────────────────────
  {
    id: 'bank',
    side: 'asset',
    group: 'cash',
    name: 'Bank accounts',
    one: 'bank account',
    examples: 'Savings, current, salary, NRE and NRO accounts',
    kinds: ['Savings', 'Current', 'Salary', 'NRE', 'NRO', 'Other'],
    valueLabel: 'Balance',
    valueHint: 'Roughly what is in it today',
    nominee: always,
    liquid: always,
    counts: always,
    shared: true,
    who: 'bank',
    number: 'account',
    suggest: (kind, f) => join(f.bank, kind && `${kind} account`),
    fields: [
      { key: 'bank', label: 'Bank', kind: 'text', placeholder: 'e.g. State Bank of India' },
      { key: 'account', label: 'Account number', kind: 'secret', check: v.accountNumber, inputMode: 'numeric' },
      { key: 'holding', label: 'Held', kind: 'select', options: ['Single', 'Joint'] },
      { key: 'jointHolders', label: 'Joint holder(s)', kind: 'text', showIf: isJoint, placeholder: 'Names, in the order on the account' },
      {
        key: 'mode',
        label: 'Mode of operation',
        kind: 'select',
        options: ['Either or survivor', 'Former or survivor', 'Jointly'],
        showIf: isJoint,
        hint: 'It decides who can use the account if one holder dies',
      },
      { key: 'branch', label: 'Branch', kind: 'text', more: true },
      { key: 'ifsc', label: 'IFSC', kind: 'text', check: v.ifsc, upper: true, more: true, placeholder: 'e.g. SBIN0001234' },
      { key: 'customerId', label: 'Customer ID / CIF', kind: 'secret', more: true },
    ],
    staleAfter: 3,
  },
  {
    id: 'deposit',
    side: 'asset',
    group: 'cash',
    name: 'Fixed & recurring deposits',
    one: 'deposit',
    examples: 'Bank FDs, RDs, company deposits, post office time deposits',
    kinds: ['Fixed deposit', 'Recurring deposit', 'Company deposit', 'Post office deposit', 'Other'],
    valueLabel: 'Value today',
    valueHint: 'The amount put in plus interest so far. If unsure, the amount put in.',
    nominee: always,
    liquid: (k) => k !== 'Company deposit',
    counts: always,
    shared: true,
    who: 'institution',
    number: 'number',
    suggest: (kind, f) => join(f.institution, kind),
    fields: [
      { key: 'institution', label: 'Bank or company', kind: 'text' },
      { key: 'number', label: 'Deposit / receipt number', kind: 'secret', check: v.accountNumber },
      { key: 'principal', label: 'Amount put in', kind: 'money', hint: 'For an RD, the monthly instalment' },
      { key: 'rate', label: 'Interest rate', kind: 'percent', check: v.percent, hint: 'A year, e.g. 7.1' },
      { key: 'maturityDate', label: 'Matures on', kind: 'date' },
      { key: 'maturityAmount', label: 'Maturity amount', kind: 'money', more: true },
      { key: 'startDate', label: 'Opened on', kind: 'date', more: true },
      { key: 'payout', label: 'Interest paid', kind: 'select', options: ['At maturity', 'Monthly', 'Quarterly', 'Yearly'], more: true },
      { key: 'renewal', label: 'Renews by itself?', kind: 'select', options: YES_NO, more: true },
      { key: 'creditTo', label: 'Paid into account', kind: 'text', more: true, placeholder: 'Where the money goes at maturity' },
    ],
    watch: [
      { key: 'maturityDate', verb: 'Matures', noun: 'maturity date', ahead: 45, passed: 'This has matured. If it was renewed, update the date; if paid out, move the money to where it went.' },
    ],
    staleAfter: 12,
  },
  {
    id: 'demat',
    side: 'asset',
    group: 'market',
    name: 'Shares & demat',
    one: 'demat account or shareholding',
    examples: 'Demat accounts, unlisted shares, ESOPs and RSUs',
    kinds: ['Demat account', 'Unlisted shares', 'ESOPs / RSUs', 'Physical share certificates'],
    valueLabel: 'Market value',
    valueHint: 'The holdings value in your broker’s app, or your best estimate',
    nominee: (k) => k === 'Demat account' || k === 'Physical share certificates',
    liquid: (k) => k === 'Demat account',
    counts: always,
    shared: true,
    who: 'broker',
    number: 'boId',
    suggest: (kind, f) => join(f.broker || f.company, kind),
    fields: [
      { key: 'broker', label: 'Broker / depository participant', kind: 'text', showIf: (_f, k) => k === 'Demat account', placeholder: 'e.g. the broker’s name' },
      { key: 'depository', label: 'Depository', kind: 'select', options: ['CDSL', 'NSDL'], showIf: (_f, k) => k === 'Demat account' },
      { key: 'boId', label: 'BO ID / DP ID + Client ID', kind: 'secret', showIf: (_f, k) => k === 'Demat account', hint: '16 characters, on your demat statement' },
      { key: 'company', label: 'Company', kind: 'text', showIf: (_f, k) => k !== 'Demat account' },
      { key: 'quantity', label: 'Number of shares / units', kind: 'number', inputMode: 'decimal', showIf: (_f, k) => k !== 'Demat account' },
      { key: 'folio', label: 'Folio / certificate numbers', kind: 'secret', showIf: (_f, k) => k === 'Physical share certificates', more: true },
      { key: 'vesting', label: 'Vesting dates', kind: 'text', showIf: (_f, k) => k === 'ESOPs / RSUs', more: true, placeholder: 'e.g. 25% each June till 2028' },
      { key: 'tradingAccount', label: 'Trading account / client code', kind: 'secret', showIf: (_f, k) => k === 'Demat account', more: true },
      { key: 'holdings', label: 'Main holdings', kind: 'textarea', more: true, wide: true, placeholder: 'Optional. The few that matter, with quantities.' },
    ],
    staleAfter: 6,
  },
  {
    id: 'mutual_fund',
    side: 'asset',
    group: 'market',
    name: 'Mutual funds',
    one: 'mutual fund folio',
    examples: 'Equity, debt and hybrid funds, SIPs, ELSS, index funds',
    kinds: ['Equity', 'Debt', 'Hybrid', 'ELSS (tax saver)', 'Index / ETF', 'Other'],
    valueLabel: 'Current value',
    valueHint: 'From your fund statement or app',
    nominee: always,
    liquid: (k) => k !== 'ELSS (tax saver)',
    counts: always,
    shared: true,
    who: 'amc',
    number: 'folio',
    suggest: (kind, f) => join(f.scheme || f.amc, f.scheme ? '' : kind && `${kind} fund`),
    fields: [
      { key: 'amc', label: 'Fund house or platform', kind: 'text', placeholder: 'e.g. the AMC, or the app you invest through' },
      { key: 'folio', label: 'Folio number', kind: 'secret', check: v.accountNumber },
      { key: 'scheme', label: 'Scheme(s)', kind: 'text', placeholder: 'One folio can hold several' },
      { key: 'mode', label: 'Invested by', kind: 'select', options: ['SIP', 'Lump sum', 'Both'] },
      { key: 'sip', label: 'SIP amount', kind: 'money', showIf: (f) => f.mode === 'SIP' || f.mode === 'Both', hint: 'Every month' },
      { key: 'invested', label: 'Amount invested so far', kind: 'money', more: true },
      { key: 'plan', label: 'Plan', kind: 'select', options: ['Direct', 'Regular'], more: true },
      { key: 'option', label: 'Option', kind: 'select', options: ['Growth', 'IDCW (dividend)'], more: true },
      { key: 'sipDay', label: 'SIP date', kind: 'number', check: v.dayOfMonth, inputMode: 'numeric', showIf: (f) => f.mode === 'SIP' || f.mode === 'Both', more: true },
      { key: 'lockIn', label: 'Lock-in ends', kind: 'date', showIf: (_f, k) => k === 'ELSS (tax saver)', more: true },
    ],
    staleAfter: 6,
  },
  {
    id: 'retirement',
    side: 'asset',
    group: 'retirement',
    name: 'Provident fund, PPF & NPS',
    one: 'retirement or long-term savings account',
    examples: 'EPF, VPF, PPF, NPS, Sukanya Samriddhi, superannuation',
    kinds: ['EPF', 'PPF', 'NPS', 'Sukanya Samriddhi', 'Superannuation / gratuity', 'Other'],
    valueLabel: 'Balance',
    valueHint: 'From the passbook or the latest statement',
    nominee: always,
    liquid: never,
    counts: always,
    shared: false,
    who: 'institution',
    number: 'number',
    suggest: (kind, f) => join(kind, f.employer || f.institution),
    fields: [
      { key: 'uan', label: 'UAN', kind: 'secret', check: v.twelveDigits('UAN'), inputMode: 'numeric', showIf: (_f, k) => k === 'EPF', hint: '12 digits, on your salary slip' },
      { key: 'employer', label: 'Employer', kind: 'text', showIf: (_f, k) => k === 'EPF' || k === 'Superannuation / gratuity' },
      { key: 'pran', label: 'PRAN', kind: 'secret', check: v.twelveDigits('PRAN'), inputMode: 'numeric', showIf: (_f, k) => k === 'NPS', hint: '12 digits, on your NPS card' },
      { key: 'tier', label: 'Tier', kind: 'select', options: ['Tier I', 'Tier II', 'Both'], showIf: (_f, k) => k === 'NPS' },
      { key: 'institution', label: 'Bank or post office', kind: 'text', showIf: (_f, k) => k === 'PPF' || k === 'Sukanya Samriddhi' || k === 'Other' },
      { key: 'number', label: 'Account number', kind: 'secret', check: v.accountNumber, showIf: (_f, k) => k !== 'EPF' && k !== 'NPS' },
      { key: 'beneficiary', label: 'Account is for', kind: 'text', showIf: (_f, k) => k === 'Sukanya Samriddhi', placeholder: 'Your daughter’s name' },
      { key: 'yearly', label: 'Yearly contribution', kind: 'money', more: true },
      { key: 'openedOn', label: 'Opened on', kind: 'date', more: true },
      { key: 'maturityDate', label: 'Matures on', kind: 'date', showIf: (_f, k) => k === 'PPF' || k === 'Sukanya Samriddhi', more: true, hint: 'PPF runs 15 full years and can be extended in blocks of 5' },
      { key: 'memberId', label: 'PF member ID', kind: 'secret', showIf: (_f, k) => k === 'EPF', more: true },
    ],
    watch: [
      { key: 'maturityDate', verb: 'Matures', noun: 'maturity date', ahead: 90, passed: 'The maturity date has passed. Decide whether to extend it or withdraw, and update the record.' },
    ],
    staleAfter: 12,
  },
  {
    id: 'insurance',
    side: 'asset',
    group: 'retirement',
    name: 'Insurance policies',
    one: 'insurance policy',
    examples: 'Term, endowment, money-back, ULIP, whole life, health',
    kinds: ['Term life', 'Endowment / money-back', 'ULIP', 'Whole life', 'Health', 'Other'],
    valueLabel: 'Surrender or fund value',
    valueHint: 'What the policy would pay if surrendered today. Term and health cover have none.',
    nominee: always,
    liquid: never,
    counts: (k) => k !== 'Term life' && k !== 'Health',
    shared: false,
    who: 'insurer',
    number: 'policy',
    suggest: (kind, f) => join(f.insurer, f.plan || kind),
    fields: [
      { key: 'insurer', label: 'Insurer', kind: 'text' },
      { key: 'policy', label: 'Policy number', kind: 'secret', check: v.accountNumber },
      { key: 'cover', label: 'Sum assured / cover', kind: 'money' },
      { key: 'premium', label: 'Premium', kind: 'money' },
      { key: 'frequency', label: 'Paid', kind: 'select', options: ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'Single premium', 'Fully paid'] },
      { key: 'nextDue', label: 'Next premium due', kind: 'date', showIf: (f) => f.frequency !== 'Single premium' && f.frequency !== 'Fully paid' },
      { key: 'insured', label: 'Life / person insured', kind: 'text', more: true },
      { key: 'plan', label: 'Plan name', kind: 'text', more: true },
      { key: 'startDate', label: 'Policy started', kind: 'date', more: true },
      { key: 'maturityDate', label: 'Matures / cover ends', kind: 'date', more: true },
      { key: 'advisor', label: 'Agent or advisor', kind: 'text', more: true, placeholder: 'Name and phone' },
    ],
    watch: [
      { key: 'nextDue', verb: 'Premium due', noun: 'premium date', ahead: 30, passed: 'The premium date has passed. If it was paid, move the date on; an unpaid premium can let the policy lapse.', when: (f) => f.frequency !== 'Single premium' && f.frequency !== 'Fully paid' },
      { key: 'maturityDate', verb: 'Matures', noun: 'maturity date', ahead: 60, passed: 'The policy has matured or the cover has ended. Update the record.' },
    ],
    staleAfter: 12,
  },
  {
    id: 'property',
    side: 'asset',
    group: 'property',
    name: 'Land & buildings',
    one: 'property',
    examples: 'Flats, houses, plots, farm land, shops and offices',
    kinds: ['Flat / apartment', 'House / villa', 'Plot', 'Agricultural land', 'Shop / office', 'Under construction'],
    valueLabel: 'Market value today',
    valueHint: 'Your best estimate of what it would sell for. Your share is worked out below.',
    nominee: never,
    liquid: never,
    counts: always,
    shared: true,
    who: 'city',
    suggest: (kind, f) => join(kind, f.city || f.address?.split(/[,\n]/)[0]),
    fields: [
      { key: 'address', label: 'Address', kind: 'textarea', wide: true, placeholder: 'Flat or house number, building, street, area' },
      { key: 'city', label: 'City / town', kind: 'text' },
      { key: 'pin', label: 'PIN code', kind: 'text', check: v.pin, inputMode: 'numeric' },
      { key: 'use', label: 'Used as', kind: 'select', options: ['Self-occupied', 'Let out', 'Vacant', 'Under construction'] },
      { key: 'rent', label: 'Monthly rent', kind: 'money', showIf: (f) => f.use === 'Let out' },
      { key: 'coOwners', label: 'Co-owner(s)', kind: 'text', placeholder: 'Names on the title, if anyone else' },
      { key: 'state', label: 'State', kind: 'text', more: true },
      { key: 'purchaseDate', label: 'Bought on', kind: 'date', more: true },
      { key: 'purchasePrice', label: 'Bought for', kind: 'money', more: true },
      { key: 'area', label: 'Area', kind: 'text', more: true, placeholder: 'e.g. 1,050 sq ft carpet, or 2 acres' },
      { key: 'deedNo', label: 'Sale deed / registration number', kind: 'secret', more: true },
      { key: 'surveyNo', label: 'Survey / khasra / plot number', kind: 'text', more: true },
      { key: 'taxId', label: 'Property tax ID', kind: 'text', more: true },
      { key: 'documents', label: 'Original papers kept at', kind: 'text', more: true, wide: true, placeholder: 'e.g. bank locker, the steel almirah at home' },
    ],
    staleAfter: 12,
  },
  {
    id: 'gold',
    side: 'asset',
    group: 'gold',
    name: 'Gold, silver & jewellery',
    one: 'holding of gold, silver or jewellery',
    examples: 'Jewellery, coins and bars, Sovereign Gold Bonds, digital gold, silver',
    kinds: ['Jewellery', 'Coins / bars', 'Sovereign Gold Bonds', 'Digital gold', 'Silver', 'Other'],
    valueLabel: 'Estimated value',
    valueHint: 'Weight × today’s rate is the usual estimate. Use “Work it out” below if you have both.',
    nominee: (k, f) => k === 'Sovereign Gold Bonds' || k === 'Digital gold' || f.kept === 'Bank locker',
    liquid: never,
    counts: always,
    shared: true,
    who: 'kept',
    number: 'lockerNo',
    suggest: (kind, f) => join(f.description || kind, f.kept && f.kept !== 'Digital' ? `kept at ${f.kept.toLowerCase()}` : ''),
    fields: [
      { key: 'description', label: 'What it is', kind: 'text', placeholder: 'e.g. two bangles and a chain' },
      { key: 'grams', label: 'Weight (grams)', kind: 'number', inputMode: 'decimal', showIf: (_f, k) => k !== 'Sovereign Gold Bonds' },
      { key: 'purity', label: 'Purity', kind: 'select', options: ['24K (999)', '22K (916)', '18K (750)', '14K (585)', 'Silver 999', 'Silver 925'], showIf: (_f, k) => k !== 'Sovereign Gold Bonds' },
      { key: 'rate', label: 'Rate per gram today', kind: 'money', showIf: (_f, k) => k !== 'Sovereign Gold Bonds', hint: 'For that purity. Optional; it lets the value be worked out.' },
      { key: 'units', label: 'Units (grams)', kind: 'number', inputMode: 'decimal', showIf: (_f, k) => k === 'Sovereign Gold Bonds' },
      { key: 'kept', label: 'Kept at', kind: 'select', options: ['Home', 'Bank locker', 'With family', 'Digital / demat'] },
      { key: 'lockerBank', label: 'Locker at (bank, branch)', kind: 'text', showIf: (f) => f.kept === 'Bank locker' },
      { key: 'lockerNo', label: 'Locker number', kind: 'secret', showIf: (f) => f.kept === 'Bank locker' },
      { key: 'platform', label: 'Held through', kind: 'text', showIf: (_f, k) => k === 'Sovereign Gold Bonds' || k === 'Digital gold', placeholder: 'Bank, demat or app' },
      { key: 'maturityDate', label: 'SGB matures on', kind: 'date', showIf: (_f, k) => k === 'Sovereign Gold Bonds', more: true },
      { key: 'bill', label: 'Bills / certificates kept at', kind: 'text', more: true },
    ],
    watch: [
      { key: 'maturityDate', verb: 'SGB matures', noun: 'maturity date', ahead: 60, passed: 'These bonds have matured. Check the proceeds reached your bank account.' },
    ],
    staleAfter: 12,
  },
  {
    id: 'vehicle',
    side: 'asset',
    group: 'other',
    name: 'Vehicles',
    one: 'vehicle',
    examples: 'Cars, two-wheelers and others',
    kinds: ['Car', 'Two-wheeler', 'Other'],
    valueLabel: 'Resale value',
    valueHint: 'What it would fetch today, not what was paid',
    nominee: never,
    liquid: never,
    counts: always,
    shared: false,
    who: 'model',
    number: 'reg',
    suggest: (kind, f) => join(f.model || kind, f.reg),
    fields: [
      { key: 'model', label: 'Make and model', kind: 'text', placeholder: 'e.g. Maruti Swift VXi' },
      { key: 'reg', label: 'Registration number', kind: 'text', check: v.vehicleReg, upper: true },
      { key: 'insuranceDue', label: 'Insurance renews on', kind: 'date' },
      { key: 'year', label: 'Year bought', kind: 'number', check: v.year, inputMode: 'numeric', more: true },
      { key: 'price', label: 'Bought for', kind: 'money', more: true },
      { key: 'insurer', label: 'Insurer and policy number', kind: 'text', more: true },
      { key: 'pucDue', label: 'PUC valid till', kind: 'date', more: true },
    ],
    watch: [
      { key: 'insuranceDue', verb: 'Insurance renews', noun: 'insurance renewal date', ahead: 30, passed: 'The motor insurance date has passed. Driving uninsured is an offence; renew it and update the date.' },
      { key: 'pucDue', verb: 'PUC expires', noun: 'PUC expiry date', ahead: 15, passed: 'The PUC certificate has expired.' },
    ],
    staleAfter: 12,
  },
  {
    id: 'bonds',
    side: 'asset',
    group: 'market',
    name: 'Bonds & small savings',
    one: 'bond or small-savings certificate',
    examples: 'NSC, KVP, SCSS, post office MIS, RBI and government bonds, NCDs',
    kinds: ['NSC', 'KVP', 'Senior Citizens Savings Scheme', 'Post office MIS', 'RBI / government bonds', 'Corporate bonds / NCDs', 'Other'],
    valueLabel: 'Value today',
    valueHint: 'The amount invested plus interest so far, if you know it',
    nominee: always,
    liquid: never,
    counts: always,
    shared: true,
    who: 'issuer',
    number: 'number',
    suggest: (kind, f) => join(kind, f.issuer),
    fields: [
      { key: 'issuer', label: 'Issued by / held at', kind: 'text', placeholder: 'e.g. post office, bank, or the company' },
      { key: 'number', label: 'Certificate / account number', kind: 'secret', check: v.accountNumber },
      { key: 'invested', label: 'Amount invested', kind: 'money' },
      { key: 'rate', label: 'Interest rate', kind: 'percent', check: v.percent },
      { key: 'maturityDate', label: 'Matures on', kind: 'date' },
      { key: 'startDate', label: 'Bought on', kind: 'date', more: true },
      { key: 'payout', label: 'Interest paid', kind: 'select', options: ['At maturity', 'Monthly', 'Quarterly', 'Half-yearly', 'Yearly'], more: true },
    ],
    watch: [
      { key: 'maturityDate', verb: 'Matures', noun: 'maturity date', ahead: 45, passed: 'This has matured. Check the money came through, and update the record.' },
    ],
    staleAfter: 12,
  },
  {
    id: 'business',
    side: 'asset',
    group: 'other',
    name: 'Business interests',
    one: 'business interest',
    examples: 'Your proprietorship, a share in a partnership or LLP, shares in a private company',
    kinds: ['Proprietorship', 'Partnership / LLP', 'Private company shares', 'Other'],
    valueLabel: 'Value of your stake',
    valueHint: 'Your capital account, or a fair estimate of your share',
    nominee: never,
    liquid: never,
    counts: always,
    shared: false,
    who: 'entity',
    suggest: (kind, f) => join(f.entity, kind),
    fields: [
      { key: 'entity', label: 'Name of the business', kind: 'text' },
      { key: 'stake', label: 'Your share', kind: 'percent', check: v.percent, hint: 'Per cent of the business' },
      { key: 'role', label: 'Your role', kind: 'text', placeholder: 'e.g. partner, director' },
      { key: 'papers', label: 'Partnership deed / share certificates kept at', kind: 'text', more: true, wide: true },
      { key: 'contact', label: 'Who to contact about it', kind: 'text', more: true, placeholder: 'e.g. the other partner, or the CA' },
    ],
    staleAfter: 12,
  },
  {
    id: 'receivable',
    side: 'asset',
    group: 'cash',
    name: 'Cash & money owed to you',
    one: 'amount of cash or money owed to you',
    examples: 'Cash at home, money lent to someone, a rent security deposit',
    kinds: ['Cash at home', 'Money lent', 'Security deposit', 'Other'],
    valueLabel: 'Amount',
    nominee: never,
    liquid: (k) => k === 'Cash at home',
    counts: always,
    shared: false,
    who: 'party',
    suggest: (kind, f) => join(kind, f.party),
    fields: [
      { key: 'party', label: 'Owed by', kind: 'text', showIf: (_f, k) => k !== 'Cash at home', placeholder: 'Who has the money' },
      { key: 'given', label: 'Given on', kind: 'date', showIf: (_f, k) => k !== 'Cash at home' },
      { key: 'due', label: 'Due back by', kind: 'date', showIf: (_f, k) => k !== 'Cash at home' },
      { key: 'written', label: 'Is it written down?', kind: 'select', options: ['Yes, signed agreement', 'Yes, informally', 'No'], showIf: (_f, k) => k !== 'Cash at home', hint: 'Your family can only recover what they can show' },
      { key: 'terms', label: 'Terms', kind: 'text', more: true, placeholder: 'e.g. interest-free, or 9% a year' },
    ],
    watch: [
      { key: 'due', verb: 'Due back', noun: 'date it was due back', ahead: 30, passed: 'This was due back. If it has been repaid, mark it zero or delete it.' },
    ],
    staleAfter: 12,
  },
  {
    id: 'other_asset',
    side: 'asset',
    group: 'other',
    name: 'Other assets',
    one: 'other asset',
    examples: 'Crypto, art, collectibles, anything else of value',
    kinds: ['Crypto', 'Art & collectibles', 'Other'],
    valueLabel: 'Estimated value',
    nominee: never,
    liquid: never,
    counts: always,
    shared: false,
    who: 'where',
    suggest: (kind, f) => join(f.description || kind),
    fields: [
      { key: 'description', label: 'What it is', kind: 'text' },
      { key: 'where', label: 'Held at / kept at', kind: 'text', placeholder: 'An exchange, a wallet, at home' },
      { key: 'quantity', label: 'Quantity', kind: 'text', more: true },
      {
        key: 'access',
        label: 'How your family would get to it',
        kind: 'textarea',
        more: true,
        wide: true,
        hint: 'Where the instructions are kept, not the keys themselves',
      },
    ],
    staleAfter: 6,
  },

  // ── Liabilities ───────────────────────────────────────────────────────────
  {
    id: 'home_loan',
    side: 'liability',
    group: 'secured',
    name: 'Home loans',
    one: 'home loan',
    examples: 'Home loans, top-up loans, plot and construction loans',
    kinds: ['Home loan', 'Top-up loan', 'Plot / construction loan'],
    valueLabel: 'Outstanding',
    valueHint: 'The principal still owed, from the loan statement',
    nominee: never,
    liquid: never,
    counts: always,
    shared: true,
    who: 'lender',
    number: 'account',
    suggest: (kind, f) => join(f.lender, kind),
    fields: loanFields({ link: { label: 'For the property', heads: ['property'] } }),
    watch: LOAN_WATCH,
    staleAfter: 6,
  },
  {
    id: 'vehicle_loan',
    side: 'liability',
    group: 'secured',
    name: 'Vehicle loans',
    one: 'vehicle loan',
    examples: 'Car and two-wheeler loans',
    kinds: ['Car loan', 'Two-wheeler loan'],
    valueLabel: 'Outstanding',
    nominee: never,
    liquid: never,
    counts: always,
    shared: false,
    who: 'lender',
    number: 'account',
    suggest: (kind, f) => join(f.lender, kind),
    fields: loanFields({ link: { label: 'For the vehicle', heads: ['vehicle'] } }),
    watch: LOAN_WATCH,
    staleAfter: 6,
  },
  {
    id: 'personal_loan',
    side: 'liability',
    group: 'unsecured',
    name: 'Personal loans',
    one: 'personal loan',
    examples: 'Personal loans, consumer-durable EMIs, buy-now-pay-later',
    kinds: ['Personal loan', 'Consumer EMI', 'Buy now, pay later'],
    valueLabel: 'Outstanding',
    nominee: never,
    liquid: never,
    counts: always,
    shared: false,
    who: 'lender',
    number: 'account',
    suggest: (kind, f) => join(f.lender, kind),
    fields: loanFields(),
    watch: LOAN_WATCH,
    staleAfter: 6,
  },
  {
    id: 'education_loan',
    side: 'liability',
    group: 'unsecured',
    name: 'Education loans',
    one: 'education loan',
    examples: 'Loans for your or your children’s studies',
    kinds: ['Education loan'],
    valueLabel: 'Outstanding',
    nominee: never,
    liquid: never,
    counts: always,
    shared: false,
    who: 'lender',
    number: 'account',
    suggest: (_kind, f) => join(f.lender, f.student ? `for ${f.student}` : 'Education loan'),
    fields: loanFields({
      extra: [
        { key: 'student', label: 'Student', kind: 'text', more: true },
        { key: 'course', label: 'Course and institution', kind: 'text', more: true },
        { key: 'moratoriumEnd', label: 'Repayment starts', kind: 'date', more: true },
      ],
    }),
    watch: [
      ...LOAN_WATCH,
      { key: 'moratoriumEnd', verb: 'Repayment starts', noun: 'repayment start date', ahead: 60, passed: 'Repayment should have started. Check the EMI is set up.' },
    ],
    staleAfter: 6,
  },
  {
    id: 'secured_loan',
    side: 'liability',
    group: 'secured',
    name: 'Loans against gold, property or investments',
    one: 'secured loan',
    examples: 'Gold loans, loan against property, against shares, funds, FDs or a policy',
    kinds: ['Gold loan', 'Loan against property', 'Loan against shares / funds', 'Loan against FD / policy', 'Overdraft'],
    valueLabel: 'Outstanding',
    nominee: never,
    liquid: never,
    counts: always,
    shared: true,
    who: 'lender',
    number: 'account',
    suggest: (kind, f) => join(f.lender, kind),
    fields: loanFields({
      link: { label: 'Pledged against', heads: ['property', 'gold', 'demat', 'mutual_fund', 'deposit', 'insurance'] },
    }),
    watch: LOAN_WATCH,
    staleAfter: 6,
  },
  {
    id: 'credit_card',
    side: 'liability',
    group: 'unsecured',
    name: 'Credit cards',
    one: 'credit card',
    examples: 'Every card you hold, even the ones you clear each month',
    kinds: ['Credit card'],
    valueLabel: 'Amount due',
    valueHint: 'The outstanding on the last statement, or 0 if you clear it in full',
    nominee: never,
    liquid: never,
    counts: always,
    shared: false,
    who: 'issuer',
    number: 'last4',
    suggest: (_kind, f) => join(f.issuer, f.last4 ? `card ending ${f.last4}` : 'Credit card'),
    fields: [
      { key: 'issuer', label: 'Card issuer', kind: 'text', placeholder: 'The bank on the card' },
      {
        key: 'last4',
        label: 'Last 4 digits',
        kind: 'lastFour',
        check: v.lastFour,
        inputMode: 'numeric',
        hint: 'Only the last four. The full number, expiry and CVV never belong here.',
      },
      { key: 'dueDay', label: 'Payment due on', kind: 'number', check: v.dayOfMonth, inputMode: 'numeric', hint: 'Day of the month' },
      { key: 'autopay', label: 'Paid automatically?', kind: 'select', options: ['Full amount', 'Minimum due', 'No'] },
      { key: 'limit', label: 'Credit limit', kind: 'money', more: true },
      { key: 'addOn', label: 'Add-on cards with', kind: 'text', more: true },
    ],
    staleAfter: 2,
  },
  {
    id: 'informal_loan',
    side: 'liability',
    group: 'unsecured',
    name: 'Money borrowed from people',
    one: 'personal borrowing',
    examples: 'Loans from family, friends or an employer',
    kinds: ['From family', 'From a friend', 'From an employer', 'Other'],
    valueLabel: 'Outstanding',
    nominee: never,
    liquid: never,
    counts: always,
    shared: false,
    who: 'party',
    suggest: (kind, f) => join(f.party ? `Owed to ${f.party}` : kind),
    fields: [
      { key: 'party', label: 'Owed to', kind: 'text' },
      { key: 'taken', label: 'Borrowed on', kind: 'date' },
      { key: 'due', label: 'To be repaid by', kind: 'date' },
      { key: 'written', label: 'Is it written down?', kind: 'select', options: ['Yes, signed agreement', 'Yes, informally', 'No'] },
      { key: 'terms', label: 'Terms', kind: 'text', more: true, placeholder: 'e.g. interest-free, repay when possible' },
    ],
    watch: [{ key: 'due', verb: 'Repayment due', noun: 'repayment date', ahead: 30, passed: 'The repayment date has passed. If it is settled, mark it zero or delete it.' }],
    staleAfter: 12,
  },
  {
    id: 'other_liability',
    side: 'liability',
    group: 'unsecured',
    name: 'Other dues',
    one: 'other amount you owe',
    examples: 'Tax payable, unpaid bills, guarantees you have given',
    kinds: ['Tax payable', 'Unpaid bills', 'Guarantee given', 'Other'],
    valueLabel: 'Amount',
    valueHint: 'For a guarantee, the amount you could be asked to pay',
    nominee: never,
    liquid: never,
    counts: always,
    shared: false,
    who: 'party',
    suggest: (kind, f) => join(kind, f.party),
    fields: [
      { key: 'party', label: 'Owed to', kind: 'text' },
      { key: 'due', label: 'Due by', kind: 'date' },
      { key: 'details', label: 'Details', kind: 'textarea', more: true, wide: true },
    ],
    watch: [{ key: 'due', verb: 'Due', noun: 'due date', ahead: 30, passed: 'This was due. If it is paid, delete it.' }],
    staleAfter: 6,
  },
];

const BY_ID = new Map(HEADS.map((h) => [h.id, h]));

export function head(id: HeadId): HeadSpec {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`Unknown head: ${id}`);
  return spec;
}

export const isHeadId = (v: unknown): v is HeadId => typeof v === 'string' && BY_ID.has(v as HeadId);

export const ASSET_HEADS = HEADS.filter((h) => h.side === 'asset');
export const LIABILITY_HEADS = HEADS.filter((h) => h.side === 'liability');

/** The fields that apply to an entry as it stands, in the order they are asked. */
export function fieldsFor(spec: HeadSpec, kind: string, fields: Fields): FieldSpec[] {
  return spec.fields.filter((f) => !f.showIf || f.showIf(fields, kind));
}

