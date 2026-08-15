/**
 * Everything the public site says about itself, in one file.
 *
 * The marketing pages read from here rather than hard-coding strings, so the
 * product name, the agent roster and the positioning can all change without
 * touching layout code. That matters, because the roster is expected to grow.
 *
 * House style for anything in here, since it is all read by a customer:
 * short sentences, ordinary words, and no em-dashes. If a sentence needs a
 * dash to hold itself together, it wants to be two sentences.
 */

/**
 * Absolute origin of the public site.
 *
 * Needed for canonical URLs, the sitemap and social cards, all of which must be
 * absolute. Vercel exposes the deployment host, so preview deployments describe
 * themselves rather than claiming to be production. The literal is the fallback
 * for local development and for anywhere that variable is absent.
 *
 * ⚠ The literal is the intended production domain, not a registered one yet. On
 * Vercel it is never reached, because the platform sets the variable above it.
 * Set NEXT_PUBLIC_SITE_URL once the domain is bought and pointed here.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://financeintelligence.in';

export const BRAND = {
  /** The platform. */
  name: 'The Finance Intelligence',
  /** Shortened for tight spaces (nav mark, footer). */
  short: 'FI',
  tagline: 'AI tools for finance teams',
  /** One sentence, used in metadata and the footer. */
  blurb:
    'Tools that take care of the routine parts of finance work and keep a clear record of who approved what, and when.',
} as const;

export type AgentStage = 'live' | 'building' | 'planned';

export type Agent = {
  slug: string;
  name: string;
  stage: AgentStage;
  /** Two or three words, shown under the name in the grid. */
  category: string;
  /** One line for cards. */
  summary: string;
  /** The pitch, for the agent's own page. */
  pitch: string;
  /** What it actually does, in specifics. */
  does: string[];
  /** Where it fits, for the detail page. */
  inputs: string;
  outputs: string;
  /** Only set for the live agent, where signing in takes you. */
  href?: string;
  accent: 'indigo' | 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'lime' | 'magenta';
};

export const STAGE_LABEL: Record<AgentStage, string> = {
  live: 'Live',
  building: 'In build',
  planned: 'On the roadmap',
};

/**
 * The roster.
 *
 * Two of the six are built and four are not, and every screen that renders this
 * list says which is which. The honesty is deliberate: a grid of six equally
 * confident tiles that mostly lead nowhere is the fastest way to lose a finance
 * buyer, and the fastest way to lose them twice is for the tiles to have been
 * lying about what the two working ones do.
 *
 * Which means the `does` list of a live agent is a promise, not a pitch. When
 * one of these ships, this is the entry that gets rewritten down to what the
 * thing actually does.
 */
export const AGENTS: Agent[] = [
  {
    slug: 'voucher-desk',
    name: 'Voucher Desk',
    stage: 'live',
    category: 'Payments & approvals',
    accent: 'indigo',
    summary:
      'Payment vouchers with two approvals built in. Nobody can approve their own voucher, and nobody can approve the same one twice.',
    pitch:
      'The approval steps are not just screens in an app. They are rules inside the database, so they hold whether the request comes from the website, from a script, or from anywhere else.',
    does: [
      'All thirty-two fields from the voucher your team already uses, so the printed page looks the way it always has.',
      'Two approvals from two different people, and neither of them can be the person who raised it. The database checks this, not the browser.',
      'Voucher numbers are handed out when you submit, in the form FI/CHAPTER/25-26/0001. One run of numbers per chapter per financial year, and nobody types them by hand.',
      'The database works out the totals itself, so the figure on screen is the figure on record.',
      'GST is sorted for you. CGST and SGST inside a state, IGST between states, never both at once. Checked before you can submit.',
      'Every step is added to a history that nobody can edit or delete, including the owner of the account.',
      'PDFs you can search, and an Excel export with the same thirty-two columns your team already works from.',
    ],
    inputs: 'Invoice, event, chapter, payee, amounts',
    outputs: 'Numbered voucher, PDF, Excel, full history',
    href: '/dashboard',
  },
  {
    slug: 'ledger-reconciliation',
    name: 'Ledger Reconciliation',
    stage: 'live',
    category: 'Books & closing',
    accent: 'emerald',
    summary:
      'Two ledgers in, a reconciliation statement out. It clears the lines that agree, explains the ones that do not, and tells you whether the two balances tie.',
    pitch:
      'Most of a reconciliation is matching, and most matching follows rules. The software does that part in a few seconds. What is left is the handful of lines that need somebody to think about them, and each one arrives with a note saying why it is there.',
    does: [
      'Reads Excel, CSV and text PDFs, including the bank statements that print as tables with no lines around them.',
      'Works out what each column is from its heading, and lets you fix it when the two files use different words for the same thing.',
      'Matches on the reference first, then on the description and the amount, then on the amount alone. A cheque number counts for more than a round figure that happens to turn up twice.',
      'Copes with a bank statement being the mirror of your cash book, where every debit in one is a credit in the other. It works that out from the entries themselves.',
      'Builds the statement in the usual Add and Less form and says whether the two balances tie out.',
      'Says in plain words why each remaining line is there, and names the likely cause of an amount difference: rounding, a decimal point in the wrong place, or a multiple.',
      'A PDF for the file, an Excel workbook for the follow up, and a copy kept in your own history.',
      'The two files are read inside your browser. They are never uploaded anywhere.',
    ],
    inputs: 'Two ledgers, as Excel, CSV or a text PDF',
    outputs: 'A reconciliation statement, and the lines to look at',
    href: '/reconcile',
  },
  {
    slug: 'gst-reconciliation',
    name: 'GST Reconciliation',
    stage: 'planned',
    category: 'Indirect tax',
    accent: 'cyan',
    summary:
      'Checks GSTR-2B against your purchase register, works out the input tax credit line by line, and sorts the problems by how much money is involved.',
    pitch:
      'Credit you forget to claim is money left on the table. Credit you claim wrongly brings a notice. Both come out of the same check, so it is worth doing every month.',
    does: [
      'Pulls GSTR-2B and matches it to the purchase register on GSTIN, invoice number and value.',
      'Tells the difference between a real mismatch and the same invoice number written two ways.',
      'Works out how much credit you can claim on each line, including the blocked ones.',
      'Sorts what is outstanding by rupee value, so your follow up list starts with the biggest.',
    ],
    inputs: 'GSTR-2B, purchase register',
    outputs: 'Credit you can claim, and a follow up list',
  },
  {
    slug: 'tds-compliance',
    name: 'TDS Compliance',
    stage: 'planned',
    category: 'Direct tax',
    accent: 'amber',
    summary:
      'Works out the right section and rate before the payment goes out, then builds the quarterly return from the payments you actually made.',
    pitch:
      'Deduct at the wrong rate and you usually find out a quarter later, when putting it right costs interest. The time to get it right is while the voucher is still a draft.',
    does: [
      'Works out which section applies from the nature of the payment and who is being paid.',
      'Uses the current rate, including the higher one when a PAN is missing or inoperative.',
      'Tells you while the voucher can still be edited, not after the money has gone out.',
      'Builds 26Q and 24Q from the payments on record, with the challan details attached.',
      'Keeps track of deposit and filing dates against what has actually been paid.',
    ],
    inputs: 'Payments, payee PAN and status',
    outputs: 'The right rate at the time, and the quarterly returns',
  },
  {
    slug: 'invoice-intake',
    name: 'Invoice Intake',
    stage: 'planned',
    category: 'Document capture',
    accent: 'magenta',
    summary:
      'Reads an invoice, whether it comes by email, as a scan or as a photo, pulls out the details and starts the voucher for you.',
    pitch:
      'The slowest part of raising a voucher is copying numbers off a PDF. If the software reads the document instead, a five minute form becomes a thirty second check.',
    does: [
      'Takes invoices by email, by upload, or as a photo from your phone.',
      'Pulls out the supplier, GSTIN, invoice number and date, the line values and the tax split.',
      'Checks that the GSTIN is valid and that the PAN inside it matches the one on file, before you see the draft.',
      'Opens a draft with everything it filled in clearly marked, so you are checking rather than typing.',
      'Keeps the original document attached to the voucher, so the proof stays with the record.',
    ],
    inputs: 'PDFs, scans, photographs, email',
    outputs: 'A draft that is mostly filled in, with the invoice attached',
  },
  {
    slug: 'audit-copilot',
    name: 'Audit Copilot',
    stage: 'planned',
    category: 'Assurance & reporting',
    accent: 'rose',
    summary:
      'Answers questions about your records. Who approved what, when, and on what basis. It shows you the rows it read.',
    pitch:
      'A history is only useful if you can ask it something. This one answers in ordinary sentences and shows its working, so you can check the answer rather than take it on trust.',
    does: [
      'Answers questions in plain language across vouchers, approvals and attachments.',
      'Points at the records behind every answer, so you can go and check it yourself.',
      'Puts together sampling packs and exception reports for a period.',
      'Flags things worth a look, like the same pair of approvers, odd timings, or a payee that keeps coming back.',
      'Reads only. It can never change anything it reports on.',
    ],
    inputs: 'The whole history',
    outputs: 'Answers with their sources, and sampling packs',
  },
];

export const LIVE_AGENTS = AGENTS.filter((a) => a.stage === 'live');

export function agentBySlug(slug: string): Agent | undefined {
  return AGENTS.find((a) => a.slug === slug);
}

/** Primary navigation for the public site. */
export const NAV = [
  { href: '/agents', label: 'Agents' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

/**
 * The formats and rails a finance team in India already works in. Shown as a
 * strip under the hero. The point is recognition, not novelty.
 */
export const FORMATS = [
  'GSTIN',
  'PAN',
  'GSTR-2B',
  'TDS 26Q',
  'FY Apr–Mar',
  'Tally exports',
  'Excel',
  'NEFT / RTGS / UPI',
] as const;

/** The four steps on the home page. */
export const STEPS = [
  {
    n: '01',
    title: 'Something needs paying',
    body: 'An invoice turns up, or an event finishes and there are bills to settle. Someone starts a voucher. If we can read the invoice, most of it is filled in for them.',
  },
  {
    n: '02',
    title: 'The software applies the rules',
    body: 'Which GST applies, which TDS section and rate, which chapter, which financial year, and what number the voucher gets. All of that is worked out before anyone has to look at it.',
  },
  {
    n: '03',
    title: 'Two people sign off',
    body: 'The approver sees the whole voucher and the numbers behind it. Two different people have to approve it, and neither of them can be the person who raised it.',
  },
  {
    n: '04',
    title: 'The record is closed',
    body: 'Once it is approved the voucher is locked. You can still print the PDF or pull the Excel, but the figures cannot be changed and the history cannot be edited.',
  },
] as const;

/**
 * The finance month, and which tool takes each job.
 *
 * This is the roster told from the other side: instead of six products looking
 * for a use, it is the work a finance team already repeats every month, with our
 * name against the part we take on. It is also the honest way to show that five
 * of the six are not built yet, because the job is real either way.
 *
 * `day` is the statutory date for a monthly filer, and only the three dates we
 * are sure of are given one. Deposit TDS by the 7th of the following month,
 * GSTR-2B is available on the 14th, GSTR-3B is due on the 20th. Anything with a
 * date that moves with your filing frequency is left as a band instead, and the
 * section says so under the ruler. Getting a compliance date wrong on a
 * chartered accountant's own website is not a mistake we can afford, so nothing
 * is stated here that is not the standard case.
 *
 * `agent` is a slug from AGENTS, so a tool's name and stage are never written
 * down twice.
 */
export type Job = {
  id: string;
  /** Where it falls, in words. Shown as a chip. */
  when: string;
  /** 1 to 31, only for the three statutory dates. Positions it on the ruler. */
  day?: number;
  title: string;
  /** How the job goes today, before any of this. */
  now: string;
  /** The part we take on. */
  ours: string;
  agent: string;
};

export const JOBS: readonly Job[] = [
  {
    id: 'intake',
    when: 'All month',
    title: 'Bills turn up from everywhere',
    now: 'One by email, one on WhatsApp, one as a photo somebody took in a taxi. Each one gets typed into a form by hand, and the numbers get typed wrong often enough to matter.',
    ours: 'The invoice is read for you. The supplier, the GSTIN, the invoice number and the values come back already filled in, with the original document attached to the record.',
    agent: 'invoice-intake',
  },
  {
    id: 'pay',
    when: 'All month',
    title: 'Payments have to be raised and signed off',
    now: 'A form, a print, two signatures chased over WhatsApp, and a folder somebody has to keep in case anyone asks later.',
    ours: 'The voucher is raised on screen, the tax is worked out for you, and two people approve it. Neither of them can be the person who raised it, and the record keeps its own history.',
    agent: 'voucher-desk',
  },
  {
    id: 'tds-deposit',
    when: 'By the 7th',
    day: 7,
    title: 'Last month’s TDS has to be in the bank',
    now: 'Somebody goes back through every payment working out which section applied to it, after the money has already gone out. Getting it wrong now costs interest.',
    ours: 'The section and the rate are worked out while the voucher is still a draft. By the 7th the figure is already there, with the payments behind it listed.',
    agent: 'tds-compliance',
  },
  {
    id: 'gst-match',
    when: 'From the 14th',
    day: 14,
    title: 'GSTR-2B lands and has to be matched',
    now: 'Two spreadsheets side by side, sorted by amount, hoping the invoice numbers were typed the same way twice.',
    ours: 'Every line of 2B matched to your purchase register on GSTIN, invoice number and value, with the near misses told apart from the real mismatches.',
    agent: 'gst-reconciliation',
  },
  {
    id: 'gst-claim',
    when: 'By the 20th',
    day: 20,
    title: 'The credit you claim has to be the credit you have',
    now: 'Settled in a rush the night before. Anything that would not match gets left for next month, and next month it is somebody else’s problem.',
    ours: 'What you can claim, what is blocked and what is still missing, line by line and sorted by rupee value, so the follow up list starts with the biggest.',
    agent: 'gst-reconciliation',
  },
  {
    id: 'bank',
    when: 'Month end',
    title: 'The bank statement has to agree with the ledger',
    now: 'A day of matching, then a difference column nobody can explain, then a suspense entry that quietly stays there.',
    ours: 'The lines that agree are cleared in seconds, and the statement is built for you. What is left is a short list, and each line says why it is on it.',
    agent: 'ledger-reconciliation',
  },
  {
    id: 'quarter',
    when: 'Quarter end',
    title: 'The quarterly return has to be built',
    now: 'Payments, challans and PANs pulled back together from three places, a quarter after the fact.',
    ours: '26Q and 24Q put together from the payments already on record, with the challan details attached and the filing dates tracked.',
    agent: 'tds-compliance',
  },
  {
    id: 'audit',
    when: 'Year end',
    title: 'The auditor asks who approved what',
    now: 'A week of pulling files, and an awkward gap wherever the person who signed has since left.',
    ours: 'Ask the question in plain words and get the answer with the records behind it, so you can check it rather than take it on trust.',
    agent: 'audit-copilot',
  },
];

/**
 * What the tools have in common, said plainly.
 *
 * The reason a finance team should want six tools from one place is not a
 * bundle price, and this is the section that has to say what it actually is.
 */
export const SHARED = [
  {
    title: 'One sign-in',
    body: 'The same account across every tool. Nobody keeps a second password, and nobody is left with access to something after they have moved on.',
  },
  {
    title: 'One list of who can do what',
    body: 'Four roles, set once. Being able to approve a payment means the same thing in every tool, and the database is what enforces it rather than each screen.',
  },
  {
    title: 'One set of records',
    body: 'The GST match, the TDS working and the payment all point at the same invoice and the same payee. Nothing has to be kept in step by hand.',
  },
  {
    title: 'One history',
    body: 'Every action anywhere lands in the same list, and nobody can edit or delete a line in it. One place to look when somebody asks what happened.',
  },
] as const;

/**
 * The tax rules the interactive panel on the home page lets you drive.
 *
 * Rates only. The arithmetic is done by the application's own calcNetTotal and
 * calcGrandTotal, so the figures on the marketing page and the figures on a real
 * voucher come from the same two functions.
 */
export const GST_RATES = [5, 12, 18, 28] as const;

export const TDS_SECTIONS = [
  { code: 'None', rate: 0, note: 'Nothing deducted' },
  { code: '194C', rate: 2, note: 'Contractors. 2% when you are paying a company' },
  { code: '194H', rate: 5, note: 'Commission or brokerage' },
  { code: '194J', rate: 10, note: 'Professional or technical services' },
] as const;

/**
 * Said plainly on each agent's page, next to the pitch.
 *
 * The first question a finance buyer has about a roadmap tile is whether they
 * can have it, and the answer belongs on the same screen as the promise rather
 * than three weeks later on a call.
 */
export const STAGE_NOTE: Record<AgentStage, string> = {
  live: 'You can use this today. Sign in and it is there, with the rules running behind it.',
  building:
    'We are building this now. You cannot switch it on yet, and we would rather tell you that than give you a date we are not sure of.',
  planned:
    'Written up and waiting its turn. Work starts on it once the one before it is properly finished.',
};

/**
 * Where the public site sends people.
 *
 * There is no form handler behind /contact, since the form composes an email, so
 * these addresses are the route itself rather than a fallback. They have to be
 * right in every place they appear.
 *
 * ⚠ UNVERIFIED. These are on the intended platform domain, which nobody has
 * registered yet, so neither mailbox exists. Confirm both before the site is
 * shared with anyone, because an enquiry sent here currently has no destination
 * at all. It is the one thing on the public site that fails silently.
 */
export const CONTACT = {
  email: 'hello@financeintelligence.in',
  security: 'security@financeintelligence.in',
} as const;
