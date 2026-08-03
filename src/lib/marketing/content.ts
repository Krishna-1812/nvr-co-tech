/**
 * Everything the public site says about itself, in one file.
 *
 * The marketing pages read from here rather than hard-coding strings, so the
 * product name, the agent roster and the positioning can all change without
 * touching layout code — which matters, because the roster is expected to grow
 * and the name is the newest thing here.
 */

/**
 * Absolute origin of the public site.
 *
 * Needed for canonical URLs, the sitemap and social cards, all of which must be
 * absolute. Vercel exposes the deployment host, so preview deployments describe
 * themselves rather than claiming to be production; the literal is the fallback
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
  tagline: 'Agentic AI for finance teams',
  /** One sentence, used in metadata and the footer. */
  blurb:
    'Agents that run the parts of finance that are rules, not judgement — with every decision recorded, attributable and provable.',
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
  /** Only set for the live agent — where signing in takes you. */
  href?: string;
  accent: 'indigo' | 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'lime' | 'magenta';
};

export const STAGE_LABEL: Record<AgentStage, string> = {
  live: 'Live',
  building: 'In build',
  planned: 'On the roadmap',
};

/**
 * The roster. Voucher Desk is the one you can actually use today; the honesty
 * about that is deliberate, because a grid of six equally-confident tiles that
 * all 404 is the fastest way to lose a finance buyer.
 */
export const AGENTS: Agent[] = [
  {
    slug: 'voucher-desk',
    name: 'Voucher Desk',
    stage: 'live',
    category: 'Payments & approvals',
    accent: 'indigo',
    summary:
      'Payment vouchers with a two-step approval chain the database itself enforces — nobody approves their own, nobody approves twice.',
    pitch:
      'The approval chain is not a workflow drawn on a slide. It is a set of rules inside Postgres, which means it holds whoever is calling the API and whatever the front end believes.',
    does: [
      'Thirty-two fields of the firm’s existing voucher, preserved exactly — the printed document still looks like the document.',
      'Two approvals from two different people, neither of them the person who raised it. Enforced in SQL, not in the browser.',
      'Voucher numbers generated on submit — NVR/CHAPTER/25-26/0001 — unique per chapter per financial year, never hand-typed.',
      'Totals computed by the database as generated columns, so the number on screen and the number on record cannot drift apart.',
      'GST handled properly: CGST + SGST for intra-state or IGST for inter-state, never both, checked before you can submit.',
      'Every transition appended to an audit trail with no update and no delete path — not even an owner can rewrite it.',
      'Searchable vector PDFs and a 32-column Excel export that matches the format your team already reconciles against.',
    ],
    inputs: 'Invoice, event, chapter, payee, amounts',
    outputs: 'Numbered voucher, PDF, Excel, audit trail',
    href: '/dashboard',
  },
  {
    slug: 'ledger-reconciliation',
    name: 'Ledger Reconciliation',
    stage: 'building',
    category: 'Books & closing',
    accent: 'emerald',
    summary:
      'Matches bank statements against the ledger, clears what obviously agrees, and puts a short, explained list of breaks in front of a human.',
    pitch:
      'Reconciliation is mostly matching, and matching is mostly rules. The agent does the ninety per cent that is mechanical and spends its explanation budget on the ten per cent that is not.',
    does: [
      'Ingests bank statements and ledger extracts in the formats they already arrive in.',
      'Matches on amount, date window, narration and reference, including many-to-one settlements.',
      'Flags breaks with a reason in plain language, not a difference column you have to decode.',
      'Learns the counterparties and narration quirks specific to your accounts.',
      'Hands off a clean, reviewable list rather than an auto-posted journal.',
    ],
    inputs: 'Bank statements, ledger extracts',
    outputs: 'Cleared matches, explained breaks',
  },
  {
    slug: 'gst-reconciliation',
    name: 'GST Reconciliation',
    stage: 'planned',
    category: 'Indirect tax',
    accent: 'cyan',
    summary:
      'GSTR-2B against the purchase register, with input tax credit eligibility worked out line by line and the mismatches ranked by what they cost you.',
    pitch:
      'Credit that goes unclaimed is money, and credit claimed wrongly is a notice. Both come from the same reconciliation, so it is worth doing properly and worth doing monthly.',
    does: [
      'Pulls GSTR-2B and matches it against the purchase register on GSTIN, invoice number and value.',
      'Separates genuine mismatches from formatting differences in invoice numbering.',
      'Works out ITC eligibility per line, including blocked credits.',
      'Ranks what is outstanding by rupee value, so the follow-up list is ordered by what matters.',
    ],
    inputs: 'GSTR-2B, purchase register',
    outputs: 'Matched credit, ranked follow-ups',
  },
  {
    slug: 'tds-compliance',
    name: 'TDS Compliance',
    stage: 'planned',
    category: 'Direct tax',
    accent: 'amber',
    summary:
      'Works out the section and rate for each payment before it goes out, then assembles the quarterly return from what actually happened.',
    pitch:
      'Deducting at the wrong rate is discovered a quarter later, when fixing it costs interest. The right moment to get it right is while the payment is still a draft.',
    does: [
      'Identifies the applicable section from the nature of payment and the payee’s status.',
      'Applies the current rate, including the higher rate for a missing or inoperative PAN.',
      'Warns while the voucher is still editable, not after the money has moved.',
      'Assembles 26Q and 24Q from the payments on record, with the challan trail attached.',
      'Tracks deposit and filing deadlines against what has actually been paid.',
    ],
    inputs: 'Payments, payee PAN and status',
    outputs: 'Rates at source, quarterly returns',
  },
  {
    slug: 'invoice-intake',
    name: 'Invoice Intake',
    stage: 'planned',
    category: 'Document capture',
    accent: 'magenta',
    summary:
      'Reads an invoice — emailed, photographed or scanned — pulls out the fields, and starts the voucher already filled in.',
    pitch:
      'The slowest part of raising a voucher is copying numbers off a PDF. An agent that reads the document turns a five-minute form into a thirty-second review.',
    does: [
      'Accepts invoices by email, upload or phone photo.',
      'Extracts supplier, GSTIN, invoice number and date, line values and tax split.',
      'Validates the GSTIN checksum and that it agrees with the PAN before anyone sees the draft.',
      'Opens a pre-filled draft with every extracted field marked, so review is checking rather than typing.',
      'Attaches the source document to the voucher, so the evidence travels with the record.',
    ],
    inputs: 'PDFs, scans, photographs, email',
    outputs: 'Pre-filled drafts with evidence attached',
  },
  {
    slug: 'audit-copilot',
    name: 'Audit Copilot',
    stage: 'planned',
    category: 'Assurance & reporting',
    accent: 'rose',
    summary:
      'Answers questions about the record — who approved what, when, and on what evidence — and cites the rows it read.',
    pitch:
      'An audit trail is only useful if you can ask it something. This one answers in sentences and shows its working, so the answer is checkable rather than trusted.',
    does: [
      'Answers questions in plain language across vouchers, approvals and attachments.',
      'Cites the underlying rows, so every answer can be verified rather than believed.',
      'Assembles sampling packs and exception reports for a review period.',
      'Surfaces patterns worth a look — the same approver pair, unusual timing, repeated payees.',
      'Reads only. It can never change a record it reports on.',
    ],
    inputs: 'The complete audit trail',
    outputs: 'Cited answers, sampling packs',
  },
];

export const LIVE_AGENTS = AGENTS.filter((a) => a.stage === 'live');

export function agentBySlug(slug: string): Agent | undefined {
  return AGENTS.find((a) => a.slug === slug);
}

/** Primary navigation for the public site. */
export const NAV = [
  { href: '/agents', label: 'Agents' },
  { href: '/security', label: 'Security' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

/**
 * The formats and rails a finance team in India already works in. Shown as a
 * strip under the hero — the point is recognition, not novelty.
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
    title: 'The work arrives',
    body: 'An invoice lands, an event closes, a payment is due. Someone raises it — or an agent raises it for them from the document itself.',
  },
  {
    n: '02',
    title: 'The rules run',
    body: 'Tax split, section and rate, chapter, financial year, numbering. Everything that is a rule rather than a judgement is applied before a human looks at it.',
  },
  {
    n: '03',
    title: 'A person decides',
    body: 'What reaches an approver is the decision itself, with the reasoning attached. Two people sign off, and neither of them is the person who raised it.',
  },
  {
    n: '04',
    title: 'The record closes',
    body: 'Numbered, frozen, exported, and appended to an audit trail that has no edit path — so what happened stays what happened.',
  },
] as const;

/**
 * Three things the database will not let you do, with the message it actually
 * returns.
 *
 * Every string in `error` is copied verbatim from supabase/migrations — the first
 * two from the approve() function, the third from the immutability trigger. They
 * are quoted rather than paraphrased on purpose: a claim about enforcement that
 * shows the enforcement is checkable, and a paraphrase is not. If a message
 * changes in SQL it has to change here, which is the point.
 */
export const REFUSALS = [
  {
    id: 'self',
    attempt: 'Approve a voucher you raised yourself',
    error: 'You cannot approve a voucher you raised',
    where: 'approve_voucher() · 0002_workflow.sql',
    call: "select approve_voucher('a1f3…9c');",
    why: 'Segregation of duties, checked against the row’s created_by inside the transaction rather than by hiding a button.',
    /*
     * Precise about the reach of each rule, because "enforced in the database"
     * is two different guarantees here and conflating them would be a claim we
     * cannot stand behind. The approve() checks are unavoidable for anything
     * coming through the API: row-level security lets a member update their own
     * voucher only while it is draft or rejected, so the status and approver
     * columns cannot be written directly and this function is the only route.
     * The freeze trigger is stronger still — a trigger fires for every writer.
     */
    holds: 'Unavoidable from the application. Row-level security permits an update only while the voucher is a draft or rejected, so the status column cannot be written directly and this function is the only way in.',
  },
  {
    id: 'twice',
    attempt: 'Give the second approval after giving the first',
    error: 'This voucher already has your first approval — a second person must approve it',
    where: 'approve_voucher() · 0002_workflow.sql',
    call: "select approve_voucher('a1f3…9c');",
    why: 'Two approvals must be two people. One person clicking twice is the exact failure this workflow exists to prevent.',
    holds: 'Compares the caller against the recorded first approver on the row itself, so it cannot be defeated by a second session, a second device or a replayed request.',
  },
  {
    id: 'edit',
    attempt: 'Change the amount on an approved voucher',
    error: 'This voucher is approved and cannot be edited. Reopen it first.',
    where: 'freeze trigger · 0002_workflow.sql',
    call: "update vouchers set basic_value = 190000 where id = 'a1f3…9c';",
    why: 'Approved records are frozen field by field. Reopening is allowed, is an admin action, needs a reason, and leaves a row in the audit trail.',
    holds: 'A trigger rather than a policy, so it fires for every writer at every privilege level — including a connection that bypasses row-level security entirely.',
  },
] as const;

/**
 * The tax rules the interactive panel on the home page lets you drive.
 *
 * Rates only — the arithmetic is done by the application's own calcNetTotal and
 * calcGrandTotal, so the figures on the marketing page and the figures on a real
 * voucher come from the same two functions.
 */
export const GST_RATES = [5, 12, 18, 28] as const;

export const TDS_SECTIONS = [
  { code: 'None', rate: 0, note: 'No deduction at source' },
  { code: '194C', rate: 2, note: 'Contractors — 2% for a company' },
  { code: '194H', rate: 5, note: 'Commission or brokerage' },
  { code: '194J', rate: 10, note: 'Professional or technical services' },
] as const;

/** Security posture, shown on the home page and expanded on /security. */
export const CONTROLS = [
  {
    title: 'Authorisation lives in the database',
    body: 'Row-level security and SECURITY DEFINER functions decide who may read and write what. A bug in the front end cannot widen access, because the front end was never what was holding it shut.',
  },
  {
    title: 'Segregation of duties, enforced',
    body: 'The person who raises a voucher can never approve it, and the second approver can never be the first. Both rules are checks inside the transaction, not conventions.',
  },
  {
    title: 'History cannot be rewritten',
    body: 'The audit table has no UPDATE and no DELETE policy for anyone, at any role. Approved records are frozen by a trigger. Corrections leave a trace by design.',
  },
  {
    title: 'Your data stays in your region',
    body: 'Hosted in Mumbai on managed Postgres, encrypted in transit and at rest, with least-privilege access and a schema you can read in the repository.',
  },
] as const;

/**
 * Said plainly on each agent's page, next to the pitch.
 *
 * The first question a finance buyer has about a roadmap tile is whether they
 * can have it, and the answer belongs in the same screen as the promise rather
 * than three weeks later on a call.
 */
export const STAGE_NOTE: Record<AgentStage, string> = {
  live: 'Available today. Sign in and it is there, with the full approval chain running behind it.',
  building:
    'Under active development. You cannot switch it on today, and we would rather say so than sell a date we have not earned.',
  planned:
    'Specified and queued, not built. It starts when the agent ahead of it is genuinely finished.',
};

/**
 * Where the public site sends people.
 *
 * There is no form handler behind /contact — the form composes an email — so
 * these addresses are the route itself rather than a fallback, and they have to
 * be right in every place they appear.
 *
 * ⚠ UNVERIFIED. The nvrco.in domain was inferred from placeholder addresses in
 * the test fixtures, not from anything the firm has confirmed. Nobody has
 * checked that these two mailboxes exist. Confirm them before the site is
 * shared with anyone, because an enquiry sent here currently has no proven
 * destination — it is the one thing on the public site that fails silently.
 */
export const CONTACT = {
  email: 'hello@nvrco.in',
  security: 'security@nvrco.in',
} as const;
