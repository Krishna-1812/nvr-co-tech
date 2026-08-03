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
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://nvr-tech.vercel.app';

export const BRAND = {
  /** The platform. */
  name: 'NVR Intelligence',
  /** Shortened for tight spaces (nav mark, footer). */
  short: 'NVR',
  /** The firm that operates it. */
  firm: 'N V R & Co',
  firmLong: 'N V R & Co, Chartered Accountants',
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
 * The roster. Voucher Desk is the one you can actually use today, and the
 * honesty about that is deliberate: a grid of six equally confident tiles that
 * all lead nowhere is the fastest way to lose a finance buyer.
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
      'Voucher numbers are handed out when you submit, in the form NVR/CHAPTER/25-26/0001. One run of numbers per chapter per financial year, and nobody types them by hand.',
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
    stage: 'building',
    category: 'Books & closing',
    accent: 'emerald',
    summary:
      'Matches your bank statement against the ledger, clears the lines that clearly agree, and gives you a short list of the ones that do not.',
    pitch:
      'Most of a reconciliation is matching, and most matching follows rules. The software does that part. What is left is the handful of lines that need someone to think about them, and each one comes with a note on why.',
    does: [
      'Reads bank statements and ledger extracts in the formats they already arrive in.',
      'Matches on amount, date, narration and reference, including one payment that settles several invoices.',
      'Explains every line it could not match in plain words, instead of leaving you a difference column to work out.',
      'Picks up the counterparties and the odd narration habits of your own accounts.',
      'Hands you a list to look at. It does not post anything by itself.',
    ],
    inputs: 'Bank statements, ledger extracts',
    outputs: 'Matched lines, and the ones to look at',
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
  live: 'You can use this today. Sign in and it is there, with the approval steps running behind it.',
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
 * ⚠ UNVERIFIED. The nvrco.in domain was inferred from placeholder addresses in
 * the test fixtures, not from anything the firm has confirmed. Nobody has
 * checked that these two mailboxes exist. Confirm them before the site is shared
 * with anyone, because an enquiry sent here currently has no proven destination.
 * It is the one thing on the public site that fails silently.
 */
export const CONTACT = {
  email: 'hello@nvrco.in',
  security: 'security@nvrco.in',
} as const;
