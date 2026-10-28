import { publishedGuides } from '.';

/**
 * The glossary: one plain definition for each term the guides and tools use.
 *
 * A definition is the sentence an assistant most often lifts whole ("X is …"),
 * so each one stands on its own, says only what the guide it links to says,
 * and links to that guide for the working. Written in the house style: short
 * sentences, ordinary words, no em-dashes (guides.test.ts reads these too).
 *
 * `guide` is the slug of the guide that explains the term in full; a term whose
 * guide is not published links nowhere rather than to a page that is not there.
 */
export type Term = {
  /** The anchor on /glossary, and the term's @id. */
  id: string;
  term: string;
  definition: string;
  topic: Topic;
  guide?: string;
};

export type Topic = 'Property' | 'Books and payments' | 'Personal finance' | 'Income tax' | 'Valuation';

export const TOPICS: readonly Topic[] = ['Property', 'Books and payments', 'Personal finance', 'Income tax', 'Valuation'];

export const TERMS: readonly Term[] = [
  // Property
  {
    id: 'carpet-area',
    term: 'Carpet area',
    definition:
      'The net usable floor area of a flat, as section 2(k) of RERA defines it. It includes the area under the internal partition walls and leaves out the external walls, service shafts, exclusive balconies or verandahs and exclusive open terraces.',
    topic: 'Property',
    guide: 'carpet-area-vs-built-up-vs-super-built-up',
  },
  {
    id: 'built-up-area',
    term: 'Built-up area',
    definition: 'The carpet area of a flat plus the area its walls stand on, and in most quotations its balcony as well.',
    topic: 'Property',
    guide: 'carpet-area-vs-built-up-vs-super-built-up',
  },
  {
    id: 'super-built-up-area',
    term: 'Super built-up area',
    definition:
      'The built-up area of a flat plus its share of the building’s common areas, such as the lobby, lift wells, staircases and corridors. Also called super area or saleable area.',
    topic: 'Property',
    guide: 'carpet-area-vs-built-up-vs-super-built-up',
  },
  {
    id: 'loading',
    term: 'Loading',
    definition:
      'How much bigger the area a flat is charged on is than its carpet area. As a share of the carpet area, it is the super built-up area divided by the carpet area, less one.',
    topic: 'Property',
    guide: 'carpet-area-vs-built-up-vs-super-built-up',
  },
  {
    id: 'true-cost',
    term: 'True cost of a flat',
    definition:
      'Every payment made for a flat, plus what each payment cost while the flat was being built: interest on any loan until possession, and the return your own money would have earned over the same time.',
    topic: 'Property',
    guide: 'true-cost-of-an-under-construction-flat',
  },
  {
    id: 'carrying-cost',
    term: 'Carrying cost',
    definition:
      'The cost of money tied up in a flat before possession: interest on the borrowed part, and the return given up on your own funds.',
    topic: 'Property',
    guide: 'true-cost-of-an-under-construction-flat',
  },
  {
    id: 'pre-emi',
    term: 'Pre-EMI',
    definition:
      'Interest-only payments on the part of a home loan the bank has disbursed while a flat is being built. They do not reduce the loan; the regular EMIs start after possession or the final disbursement.',
    topic: 'Property',
    guide: 'pre-emi-vs-full-emi-under-construction',
  },
  {
    id: 'full-emi',
    term: 'Full EMI',
    definition:
      'Paying regular EMIs on the disbursed part of a home loan from the start of construction, so part of every payment repays the loan.',
    topic: 'Property',
    guide: 'pre-emi-vs-full-emi-under-construction',
  },
  {
    id: 'gross-rental-yield',
    term: 'Gross rental yield',
    definition: 'A year’s rent divided by the cost of the property.',
    topic: 'Property',
    guide: 'rental-yield-on-property',
  },
  {
    id: 'net-rental-yield',
    term: 'Net rental yield',
    definition:
      'A year’s rent less the months the property stands empty, the maintenance the owner pays and other owner costs such as property tax, divided by the cost of the property.',
    topic: 'Property',
    guide: 'rental-yield-on-property',
  },
  {
    id: 'affordable-residential-apartment',
    term: 'Affordable residential apartment (GST)',
    definition:
      'A flat with a carpet area of up to 60 square metres in the metropolitan areas named in the GST rules, or 90 square metres elsewhere, and a price of no more than ₹45 lakh. GST on one bought under construction is 1% of the price.',
    topic: 'Property',
    guide: 'gst-on-under-construction-flat',
  },
  {
    id: 'completion-certificate',
    term: 'Completion certificate',
    definition:
      'The certificate that a building has been completed. A flat sold after it, or after the building is first occupied if that is sooner, with the whole price received after that date, carries no GST.',
    topic: 'Property',
    guide: 'gst-on-under-construction-flat',
  },

  // Books and payments
  {
    id: 'bank-reconciliation-statement',
    term: 'Bank reconciliation statement',
    definition:
      'A statement that explains every difference between the balance in your cash book and the balance on the bank statement on the same date, so that one can be worked out from the other.',
    topic: 'Books and payments',
    guide: 'bank-reconciliation-statement',
  },
  {
    id: 'reconciling-item',
    term: 'Reconciling item',
    definition:
      'An entry that appears in one of two records and not yet in the other, such as a cheque issued but not yet presented. Each one explains part of the difference between two balances.',
    topic: 'Books and payments',
    guide: 'bank-reconciliation-statement',
  },
  {
    id: 'supplier-statement-reconciliation',
    term: 'Supplier statement reconciliation',
    definition:
      'Matching your ledger for a supplier with the supplier’s statement of account to the same date, and explaining every difference until both balances agree.',
    topic: 'Books and payments',
    guide: 'supplier-statement-reconciliation',
  },
  {
    id: 'payment-voucher',
    term: 'Payment voucher',
    definition:
      'The document behind a payment: who is paid, how much, for what and against which invoice, with the account it is charged to, the tax on it and who approved it.',
    topic: 'Books and payments',
    guide: 'payment-voucher-format-and-approvals',
  },
  {
    id: 'receipt-voucher',
    term: 'Receipt voucher',
    definition: 'The voucher for money coming in to your cash or bank account from somebody else, such as a customer paying an invoice.',
    topic: 'Books and payments',
    guide: 'types-of-vouchers-in-accounting',
  },
  {
    id: 'contra-voucher',
    term: 'Contra voucher',
    definition:
      'The voucher for money moving between your own cash and bank accounts, or between two of your bank accounts, such as a cash withdrawal or a deposit.',
    topic: 'Books and payments',
    guide: 'types-of-vouchers-in-accounting',
  },
  {
    id: 'journal-voucher',
    term: 'Journal voucher',
    definition: 'The voucher for an entry that involves no cash or bank account, such as depreciation, a provision or a correction.',
    topic: 'Books and payments',
    guide: 'types-of-vouchers-in-accounting',
  },
  {
    id: 'maker-checker',
    term: 'Maker and checker',
    definition:
      'Splitting a payment between the person who raises it and a different person who approves it, so that nobody can both create a payment and authorise it.',
    topic: 'Books and payments',
    guide: 'payment-voucher-format-and-approvals',
  },
  {
    id: 'cgst-sgst-igst',
    term: 'CGST, SGST and IGST',
    definition:
      'A supply within one state carries CGST and SGST in equal halves; a supply between states carries IGST. An invoice never carries both.',
    topic: 'Books and payments',
    guide: 'payment-voucher-format-and-approvals',
  },

  // Personal finance
  {
    id: 'net-worth',
    term: 'Net worth',
    definition:
      'Everything you own at what it is worth today, less everything you owe. Anything held jointly counts at your share.',
    topic: 'Personal finance',
    guide: 'how-to-calculate-net-worth',
  },
  {
    id: 'nominee',
    term: 'Nominee',
    definition:
      'The person named on an account, investment or policy to whom it is paid out when the holder dies. An account without one usually takes longer to claim.',
    topic: 'Personal finance',
    guide: 'how-to-calculate-net-worth',
  },

  // Income tax
  {
    id: 'e-proceedings',
    term: 'e-Proceedings',
    definition:
      'The part of the Income Tax e-Filing portal, under Pending Actions, where notices that need a reply are listed with their section and response date, and can be read and answered.',
    topic: 'Income tax',
    guide: 'check-income-tax-notices-e-proceedings',
  },
  {
    id: 'din',
    term: 'Document Identification Number (DIN)',
    definition:
      'The number carried by a notice or order from the Income Tax Department, which can be checked with the e-Filing portal’s service for authenticating notices and orders.',
    topic: 'Income tax',
    guide: 'check-income-tax-notices-e-proceedings',
  },
  {
    id: 'response-date',
    term: 'Response date',
    definition: 'The date by which an income tax notice has to be answered. It runs whether or not the email about the notice was seen.',
    topic: 'Income tax',
    guide: 'check-income-tax-notices-e-proceedings',
  },
  {
    id: 'pre-construction-interest',
    term: 'Pre-construction interest',
    definition:
      'Home loan interest for the period before construction is completed. It is claimed in five equal parts from the tax year construction is completed, within the limit for the property; from tax year 2026-27 under section 22 of the Income-tax Act, 2025.',
    topic: 'Income tax',
    guide: 'pre-emi-vs-full-emi-under-construction',
  },

  // Valuation
  {
    id: 'enterprise-value',
    term: 'Enterprise value (EV)',
    definition: 'A company’s market capitalisation plus its debt, less its cash: the price of the whole business.',
    topic: 'Valuation',
    guide: 'ev-ebitda-multiple-explained',
  },
  {
    id: 'ebitda',
    term: 'EBITDA',
    definition: 'Earnings before interest, tax, depreciation and amortisation.',
    topic: 'Valuation',
    guide: 'ev-ebitda-multiple-explained',
  },
  {
    id: 'ev-ebitda',
    term: 'EV/EBITDA',
    definition:
      'Enterprise value divided by EBITDA: how many times its yearly operating earnings the whole business is priced at. It counts debt in the price and leaves interest out of the earnings.',
    topic: 'Valuation',
    guide: 'ev-ebitda-multiple-explained',
  },
  {
    id: 'comparable-companies-method',
    term: 'Comparable companies method',
    definition:
      'Valuing a company by taking the median multiple at which similar listed companies trade, such as EV/EBITDA or P/E, and applying it to the company’s own figure.',
    topic: 'Valuation',
    guide: 'value-an-unlisted-company-with-comparables',
  },
  {
    id: 'net-debt',
    term: 'Net debt',
    definition:
      'A company’s borrowings less its cash. Taken off an enterprise value, it leaves the value of the shares.',
    topic: 'Valuation',
    guide: 'value-an-unlisted-company-with-comparables',
  },
];

/** The terms, with the link to a guide kept only where the guide is published. */
export function glossary(): (Term & { href?: string; guideTitle?: string })[] {
  const live = new Map(publishedGuides().map((g) => [g.slug, g.title]));
  return TERMS.map((t) => {
    const title = t.guide ? live.get(t.guide) : undefined;
    return title ? { ...t, href: `/guides/${t.guide}`, guideTitle: title } : { ...t, guide: undefined };
  });
}
