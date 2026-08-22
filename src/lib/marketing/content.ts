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
 * The literal is the real production domain. On Vercel it is never reached,
 * because the platform sets the variable above it — this only fires in local
 * development or anywhere NEXT_PUBLIC_SITE_URL isn't set.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://www.thefinanceintelligence.com';

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
      'Payment vouchers with approval built in, on or off by your choice. Nobody can approve their own voucher, whatever you set.',
    pitch:
      'The approval step is not just a screen in an app. It is a rule inside the database, so it holds whether the request comes from the website, from a script, or from anywhere else.',
    does: [
      'All thirty-two fields from the voucher your team already uses, so the printed page looks the way it always has.',
      'Approval is off until you switch it on. Switched on, a voucher needs one signature and it can never come from the person who raised it. Left off, a submission goes straight to paid. The database is what decides which, not the screen.',
      'The voucher number is yours to type, in the form FI/CHAPTER/26-27/0001. The desk works out what the next one in that chapter and that year should be and offers it, so the run stays in order without the software overruling you.',
      'The database works out the totals itself, so the figure on screen is the figure on record.',
      'GST is sorted for you. CGST and SGST inside a state, IGST between states, never both at once. Checked before you can submit.',
      'Submitting is what closes the figures. From that moment nobody can change them, including whoever raised it. Sending it back is the only way to reopen one, and that is a new line in the history rather than a quiet edit.',
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
      'The two files are read inside your browser and never uploaded. What gets kept is the statement you produced, in a history only you can open.',
    ],
    inputs: 'Two ledgers, as Excel, CSV or a text PDF',
    outputs: 'A reconciliation statement, and the lines to look at',
    href: '/reconcile',
  },
  {
    slug: 'valuation-desk',
    name: 'Valuation Desk',
    stage: 'building',
    category: 'Valuation & deals',
    accent: 'violet',
    summary:
      'Comparable companies, the multiples they trade at, and what those imply for a company that does not trade. Every figure links to the filing it came from.',
    pitch:
      'A comparable set is not a screen output. It is a judgement somebody will argue with, so the peers you left out are recorded with the reason you left them out, and every multiple is arithmetic on figures in the same row.',
    does: [
      'Finds peers by what a company says it does, not by the industry code it was filed under. One code holds cybersecurity, gaming and enterprise software, and none of those three is comparable to the others.',
      'Shows the size band, the geography and the profitability screen it applied, and lists every company it rejected with the reason.',
      'Computes EV/Revenue, EV/EBITDA and P/E in the database as generated columns, so a quoted multiple cannot drift from the figures it was built from.',
      'Leaves a cell empty when the figure is not known. A blank is a question you can ask; a zero is a claim the company earned nothing.',
      'Flags outliers and does not remove them. The peer trading at forty times may be the one that just transacted, at a price a buyer actually paid.',
      'Keeps enterprise multiples and P/E apart. One implies a value for the whole business and needs the debt taken off; the other already implies the equity. Confusing them overstates a geared company by its whole net debt.',
      'Reads the free public record: the exchanges, the MCA register, and the SEC for anything American. Where a private company has filed, the multiple it raised at is arithmetic rather than an estimate.',
    ],
    inputs: 'A company, or an industry',
    outputs: 'Peer set, multiples, implied value, and the filing behind each figure',
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

/**
 * How many are running, said in words, derived rather than typed.
 *
 * Four places on the site said "one is live" in prose. Ledger Reconciliation
 * shipped and every one of them went on saying it, which is the expensive
 * direction for that error to run: a site that undersells is a site quietly
 * hiding a product from the people who came to look at it. Counting the roster
 * instead means there is nowhere left to forget.
 *
 * Words rather than figures because these appear mid-sentence, and a numeral in
 * running prose reads as a specification. The table stops at six because the
 * roster has six entries; a seventh would show up as a bare numeral, which is
 * ugly enough to notice and fix rather than wrong enough to mislead.
 */
const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six'] as const;

export function inWords(n: number): string {
  return WORDS[n] ?? String(n);
}

/** For a word that has to start a sentence. */
const opening = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

export const ROSTER = {
  /** Figures, for the mono micro-labels where a numeral is what reads well. */
  live: LIVE_AGENTS.length,
  coming: AGENTS.length - LIVE_AGENTS.length,
  total: AGENTS.length,
  /** "two", mid-sentence: "one of the **two** running today". */
  liveWord: inWords(LIVE_AGENTS.length),
  /** "four", mid-sentence: "and **four** more besides". */
  comingWord: inWords(AGENTS.length - LIVE_AGENTS.length),
  /** "six", mid-sentence: "buy **six** tools from six companies". */
  totalWord: inWords(AGENTS.length),
  /** The same three where the sentence starts on them. */
  liveOpen: opening(inWords(LIVE_AGENTS.length)),
  comingOpen: opening(inWords(AGENTS.length - LIVE_AGENTS.length)),
  /** Agreement, so the sentence survives the roster shrinking to one. */
  liveVerb: LIVE_AGENTS.length === 1 ? 'is' : 'are',
  comingVerb: AGENTS.length - LIVE_AGENTS.length === 1 ? 'is' : 'are',
} as const;

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
 *
 * Only what works today. The strip used to carry GSTR-2B, 26Q, Tally exports
 * and the payment rails, and under a heading that says "works with what your
 * team already uses" every one of those was a promise: two of them belong to
 * agents that are not built, one is an integration that does not exist, and the
 * desk has never moved money in its life. A recognition strip is the cheapest
 * possible place to lose a reader who checks, and the audience for this page
 * checks for a living.
 */
export const FORMATS = [
  'GSTIN',
  'PAN',
  'CGST / SGST / IGST',
  'FY Apr–Mar',
  'Excel (.xlsx)',
  'CSV',
  'Text PDF',
  'Chapter-wise numbering',
] as const;

/**
 * The four steps on the home page.
 *
 * All four are Voucher Desk as it stands. The previous version opened on an
 * invoice being read for you, which is Invoice Intake and is on the roadmap, and
 * had two people signing off, which was true of a schema that no longer exists.
 * Anything a reader can check has to be checkable in the running product.
 */
export const STEPS = [
  {
    n: '01',
    title: 'Somebody raises it',
    body: 'An invoice turns up, or an event finishes and there are bills to settle. Whoever has the paperwork fills in the voucher, and the form checks as they go rather than at the end.',
  },
  {
    n: '02',
    title: 'The database does the arithmetic',
    body: 'The totals are worked out by the database itself, not by the page, so the figure on screen is the figure on record. It also refuses a voucher whose GST is claimed two ways at once, whatever the browser was willing to send it.',
  },
  {
    n: '03',
    title: 'Somebody signs it off, if you want that',
    body: 'Approval is yours to switch on. With it on, a voucher needs one signature and it can never be the person who raised it. With it off, a submission goes straight to paid. Either way the rule is held a layer below the website.',
  },
  {
    n: '04',
    title: 'The figures close',
    body: 'Submitting is what locks them. You can still print the PDF or pull the Excel, but nobody can change an amount after that, and sending it back is the only way to reopen it. That is a new line in the history, never an edit to an old one.',
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
    ours: 'The voucher is raised on screen and the database does the arithmetic. Ask for a signature and it can never be the person who raised it; skip it and the voucher goes straight to paid. Either way the record keeps a history nobody can edit.',
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
    body: 'A payment and the reconciliation that clears it are looking at the same chapter, the same people and the same organisation. Nothing has to be kept in step by hand, and nothing has to be typed in twice.',
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
 * One real mailbox, team@, behind both. There's no dedicated security inbox
 * yet — `security` is the same address for now, kept as its own field so it
 * moves to a real one later without touching every call site.
 */
export const CONTACT = {
  email: 'team@thefinanceintelligence.com',
  security: 'team@thefinanceintelligence.com',
} as const;
