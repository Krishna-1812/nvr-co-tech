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
    stage: 'live',
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
    href: '/comps',
  },
  {
    slug: 'contact-finder',
    name: 'Contact Finder',
    stage: 'live',
    category: 'Research & outreach',
    accent: 'lime',
    summary:
      'Find the person behind a company, by role, seniority, industry or size. Every row it shows has been checked against what the source actually said, and every row it removed is counted with the reason.',
    pitch:
      'The contact database behind this exposes parameters that look like filters and behave as suggestions. Ask it for healthcare companies and it returns a venture firm, a meditation app and a compliance vendor. So the search is asked broadly and the answer is guaranteed here, in code, which is why this screen can tell you it is showing eighteen of twenty-four and name what went.',
    does: [
      'Around forty filters across people and companies: title, seniority, industry, headcount, revenue, location, technology, funding, hiring signals and classification codes.',
      'Checks the answer rather than trusting it. Industry, company size, revenue, head office, technology and domain are all re-checked against the record itself, and rows that do not really match are removed and counted with the reason.',
      'Each reason is a button. It drops the filter it blames and runs the search again, so an explanation is something you can act on rather than something you have to act on by hand.',
      'Never reports a failure as an empty result. A search that could not reach the source says so, because nothing was found and nothing was ruled out, and those are different facts.',
      'Says what a search costs before you run it. Finding people is free; describing their employers spends one credit for a whole page however many companies are on it, and the answers are kept for thirty days so most pages spend nothing.',
      'Offers only values the source really uses. The industry, technology and location pickers grow from what actually comes back, and mark which values have been seen on a real record rather than merely written down.',
      'Reads seniority and function off the job title, for free, and labels them as read rather than as asserted. A Marketing Manager is never presented as the CMO.',
      'Says when a surname has been withheld, and shortens it rather than guessing at it.',
    ],
    inputs: 'A role, a company, an industry, or a size band',
    outputs: 'People and companies, with what was removed and why',
    href: '/contacts',
  },
  {
    slug: 'tax-notices',
    name: 'Tax Notice Watch',
    stage: 'live',
    category: 'Tax & compliance',
    accent: 'rose',
    summary:
      'Checks every client’s e-Proceedings on the Income Tax portal each morning, downloads any new notice, and emails the team the day it arrives, with the response date.',
    pitch:
      'A notice on the e-Filing portal does not wait to be noticed. It sits under Pending Actions with a response date, the email about it lands in a client’s spam folder, and the first anybody hears of it is the penalty. Checking forty logins by hand every morning is nobody’s job, so it is done here, and the only thing left to a person is the reply.',
    does: [
      'Reads the accounts to check from a Google Sheet the firm keeps: login, password, client name and who to tell. A row marked No is skipped.',
      'Logs in to each account every morning, one after another, and reads both tabs of Pending Actions → e-Proceedings: For your Action and For your Information.',
      'Notices what is new since yesterday: a new proceeding, more notices on one already there, or a new dated entry. The first look at an account only records what is already there, so adding a client does not announce old notices as new.',
      'Opens the notices that are new, downloads their files and reads the response date where the portal gives one.',
      'Emails the client’s addresses and the team when something is new, with the files attached, and sends the team one short summary on mornings when something is new, due within a week, or could not be checked.',
      'Never gets past an OTP or a CAPTCHA and never retries a password. An account that asks for one is reported as not checked, with a picture of what the portal showed, rather than skipped silently.',
      'Shows every client’s proceedings, files and due dates on one screen, with what needs a look first and a Mark handled button for each.',
      'Keeps no passwords. They stay in the firm’s sheet and pass through the check only for the length of one login.',
    ],
    inputs: 'A Google Sheet of client logins, and who to tell',
    outputs: 'New notices with their files and due dates, and an email the day one arrives',
    href: '/tax-notices',
  },
  {
    slug: 'true-property-cost',
    name: 'True Property Cost',
    stage: 'live',
    category: 'Property & capex',
    accent: 'cyan',
    summary:
      'What an under-construction property really costs by possession, and what it really yields once let: every instalment, plus what the money cost while it was tied up, own funds and loan each at its own rate.',
    pitch:
      'The agreement value is what you paid. It is not what the flat cost you. Money paid at booking sat in a building for two or three years before anyone could live in it, and that money either came out of a loan that charged interest or out of savings that stopped earning. Add that back and you have the number worth comparing against a ready flat.',
    does: [
      'Takes the down payment and each instalment as a date, an amount and a source of funds: your own money or borrowed.',
      'Applies one cost of capital to own funds and one to borrowed funds, the same rate for every payment from that source.',
      'Counts the cost of each payment from the day it was paid to the OC date, which it treats as possession. A payment on or after that date carries nothing, and is flagged.',
      'Simple interest by default, which is how a lender charges pre-EMI interest during construction, with yearly, quarterly or monthly compounding if you reinvest. Days are counted actual/365.',
      'Shows the true cost, the carrying cost of own funds and of the loan separately, the uplift over the amount paid, and a cost per square foot when you give it the carpet area.',
      'Reports the cash cost beside it: payments plus loan interest, without the return own funds gave up, which is a real cost but never left the account.',
      'Works out the rental yield on the true cost rather than the price: net of vacancy, maintenance and owner costs, set beside what the money costs a year, with the break-even rent and the payback period.',
      'Takes stamp duty, registration, GST and other charges as dated payments, so they carry the cost of funds like any instalment.',
      'Recomputes as you type, so moving the OC date six months or switching a demand to the loan shows its effect at once.',
      'Exports a PDF report, with the method and its limits stated, and an Excel workbook with amounts as numbers you can total.',
      'Runs in your browser, with no account needed. Without one, schedules stay in that browser and are never sent to a server; sign in and they are also saved to your account, readable only by you.',
    ],
    inputs: 'Instalment dates and amounts, own or borrowed, the OC date, and the expected rent',
    outputs: 'True cost at possession, the cash cost, and the rental yield on it',
    href: '/true-property-cost',
  },
  {
    slug: 'wealth-tracker',
    name: 'Wealth Tracker',
    stage: 'live',
    category: 'Personal finance',
    accent: 'amber',
    summary:
      'Everything you own and owe in one record: bank accounts, deposits, shares, funds, PF and PPF, policies, property, gold and loans, with your net worth and a check that every account has a nominee.',
    pitch:
      'Most families keep this in one person’s head, or across a dozen apps and a drawer of papers. The day it matters, the people who need it cannot find it, and an account with no nominee can take months to claim. Write it down once, keep it current, and know what would happen if somebody else had to pick it up.',
    does: [
      'A head for each kind of asset and liability a household has: savings accounts, FDs, demat, mutual funds, EPF, PPF, NPS and policies; flats, plots, gold and vehicles; home and car loans, credit cards, and money lent or borrowed.',
      'Asks for the details that identify each one on paper, such as account and folio numbers, IFSC, UAN, PRAN, policy numbers and a property’s address and papers, with the ones people rarely have to hand folded away.',
      'Asks whether a nominee is registered on every account that takes one, and records who, with their share and a guardian for a minor.',
      'Works out net worth at your share of anything held jointly, with liquid assets, monthly EMIs and what you owe as a share of what you own.',
      'Checks the record: missing or unconfirmed nominees, shares that do not add up to 100%, minors without a guardian, maturities, premiums and renewals coming up, values out of date, an account entered twice, and a password or card number typed where it should not be.',
      'Records the household, whether there is a will and where it is kept, and who should know the record exists.',
      'Reads amounts the way they are said: 85 lakh, 1.2 cr, 45k.',
      'Exports a PDF for your family with every detail, or with account numbers hidden for an adviser, and an Excel workbook.',
      'Runs in your browser, with no account needed. Without one, the record stays in that browser and is never sent to a server; sign in and it is also saved to your account, readable only by you. A passcode encrypts it in the browser before it is saved anywhere, and a backup file restores it.',
    ],
    inputs: 'Your accounts, investments, property, policies and loans, with as much detail as you have',
    outputs: 'Net worth, a nominee check on every account, and a record your family can use',
    href: '/wealth-tracker',
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

/*
 * The roster's derived counts, and what is left of them.
 *
 * There were eleven fields here, plus a lookup table of number words and two
 * helpers to render them: figures for the mono micro-labels, words for prose (a
 * numeral mid-sentence reads as a specification), capitalised words for the ones
 * that opened a sentence, and verbs to agree with each. All of it existed so
 * that no page could say "one is live" after a second had shipped — which four
 * of them had done, for months.
 *
 * The site no longer states how many tools are live or how many are on the
 * roster anywhere, so the counting went with the sentences that read it. The two
 * verbs stay: the sentences that remain still have to agree as the roster
 * changes, and that is agreement rather than a count.
 *
 * If a count ever comes back, it comes back derived from AGENTS the way these
 * were. Typing one out is how the platform section spent a while saying "Buy 8
 * tools from 8 companies and you get 8 logins".
 */
export const ROSTER = {
  /** Agreement, so the sentence survives the roster shrinking to one. */
  liveVerb: LIVE_AGENTS.length === 1 ? 'is' : 'are',
  comingVerb: AGENTS.length - LIVE_AGENTS.length === 1 ? 'is' : 'are',
} as const;

export function agentBySlug(slug: string): Agent | undefined {
  return AGENTS.find((a) => a.slug === slug);
}

/** Primary navigation for the public site. */
export const NAV = [
  { href: '/tools', label: 'Tools' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

/*
 * The format strip that used to live here is gone, and with it the FORMATS
 * list, the marquee utilities and the marquee keyframe — it was their only
 * reader.
 *
 * One rule from it is worth keeping even though the strip is not, because it
 * applies to anything that lists what we work with: name only what works today.
 * That list once carried GSTR-2B, 26Q, Tally exports and the payment rails, and
 * under a heading saying "works with what your team already uses" every one of
 * those was a promise — two belonged to agents that are not built, one was an
 * integration that does not exist, and the desk has never moved money in its
 * life. The audience for this page checks for a living.
 */

/**
 * The finance month: the work a finance team already repeats every month.
 *
 * The home page shows each job's dates, how it usually goes (`now`) and what it
 * looks like done well (`good`), and names no tool (18 Oct, at the owner's
 * request). `agent` and `ours` stay because the site's assistant still answers
 * "which tool does this job?" from them.
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
  /**
   * What the job looks like done well, said as good practice rather than as
   * anything we sell. The home page shows this; it names no tool (18 Oct, at
   * the owner's request, so the section is about the finance month and not
   * about the roster).
   */
  good: string;
  /** The part we take on. Read by the assistant (lib/assist), not the home page. */
  ours: string;
  agent: string;
};

export const JOBS: readonly Job[] = [
  {
    id: 'intake',
    when: 'All month',
    title: 'Bills turn up from everywhere',
    now: 'One by email, one on WhatsApp, one as a photo somebody took in a taxi. Each one gets typed into a form by hand, and the numbers get typed wrong often enough to matter.',
    good: 'Every bill captured once, the day it arrives, with the original kept beside the entry so nobody has to retype it or hunt for it later.',
    ours: 'The invoice is read for you. The supplier, the GSTIN, the invoice number and the values come back already filled in, with the original document attached to the record.',
    agent: 'invoice-intake',
  },
  {
    id: 'pay',
    when: 'All month',
    title: 'Payments have to be raised and signed off',
    now: 'A form, a print, two signatures chased over WhatsApp, and a folder somebody has to keep in case anyone asks later.',
    good: 'Every payment approved by somebody other than the person who raised it, with the approval and the reason kept where anyone can find them.',
    ours: 'The voucher is raised on screen and the database does the arithmetic. Ask for a signature and it can never be the person who raised it; skip it and the voucher goes straight to paid. Either way the record keeps a history nobody can edit.',
    agent: 'voucher-desk',
  },
  {
    id: 'tds-deposit',
    when: 'By the 7th',
    day: 7,
    title: 'Last month’s TDS has to be in the bank',
    now: 'Somebody goes back through every payment working out which section applied to it, after the money has already gone out. Getting it wrong now costs interest.',
    good: 'The section and the rate settled when the payment is made, not reconstructed a month later from memory and bank statements.',
    ours: 'The section and the rate are worked out while the voucher is still a draft. By the 7th the figure is already there, with the payments behind it listed.',
    agent: 'tds-compliance',
  },
  {
    id: 'gst-match',
    when: 'From the 14th',
    day: 14,
    title: 'GSTR-2B lands and has to be matched',
    now: 'Two spreadsheets side by side, sorted by amount, hoping the invoice numbers were typed the same way twice.',
    good: 'Every line of 2B matched to the purchase register, with the real mismatches told apart from the ones that are only typed differently.',
    ours: 'Every line of 2B matched to your purchase register on GSTIN, invoice number and value, with the near misses told apart from the real mismatches.',
    agent: 'gst-reconciliation',
  },
  {
    id: 'gst-claim',
    when: 'By the 20th',
    day: 20,
    title: 'The credit you claim has to be the credit you have',
    now: 'Settled in a rush the night before. Anything that would not match gets left for next month, and next month it is somebody else’s problem.',
    good: 'Credit claimed only where it is actually available, and a follow-up list for what is missing that starts with the largest amounts.',
    ours: 'What you can claim, what is blocked and what is still missing, line by line and sorted by rupee value, so the follow up list starts with the biggest.',
    agent: 'gst-reconciliation',
  },
  {
    id: 'bank',
    when: 'Month end',
    title: 'The bank statement has to agree with the ledger',
    now: 'A day of matching, then a difference column nobody can explain, then a suspense entry that quietly stays there.',
    good: 'A reconciliation where every difference has a reason next to it, and nothing sits in a suspense account without one.',
    ours: 'The lines that agree are cleared in seconds, and the statement is built for you. What is left is a short list, and each line says why it is on it.',
    agent: 'ledger-reconciliation',
  },
  {
    id: 'quarter',
    when: 'Quarter end',
    title: 'The quarterly return has to be built',
    now: 'Payments, challans and PANs pulled back together from three places, a quarter after the fact.',
    good: 'The return built from payments already on record, with the challans attached, well before the due date rather than on it.',
    ours: '26Q and 24Q put together from the payments already on record, with the challan details attached and the filing dates tracked.',
    agent: 'tds-compliance',
  },
  {
    id: 'audit',
    when: 'Year end',
    title: 'The auditor asks who approved what',
    now: 'A week of pulling files, and an awkward gap wherever the person who signed has since left.',
    good: 'Any approval traced to a person, a date and the papers behind it in minutes, even when the person who signed has since left.',
    ours: 'Ask the question in plain words and get the answer with the records behind it, so you can check it rather than take it on trust.',
    agent: 'audit-copilot',
  },
];

/**
 * The TDS sections the site's assistant will quote a rate for, and no others.
 *
 * `note` is what a section is for, and it is optional: 194C has none. The home
 * page used to have an interactive panel driving these with GST rates beside
 * them; that panel was taken off on 17 Oct at the owner's request, and the GST
 * rates went with it, because nothing else read them.
 */
export const TDS_SECTIONS: readonly { code: string; rate: number; note?: string }[] = [
  { code: 'None', rate: 0, note: 'Nothing deducted' },
  { code: '194C', rate: 2 },
  { code: '194H', rate: 5, note: 'Commission or brokerage' },
  { code: '194J', rate: 10, note: 'Professional or technical services' },
];

/**
 * Said plainly on each agent's page, next to the pitch.
 *
 * The first question a finance buyer has about a roadmap tile is whether they
 * can have it, and the answer belongs on the same screen as the promise rather
 * than three weeks later on a call.
 */
export const STAGE_NOTE: Record<AgentStage, string> = {
  live: 'Running today, with the rules behind it. True Property Cost and Wealth Tracker are open to anybody; the others are opened on request.',
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
