import type { Block } from '@/lib/guides/types';
import { defaults, run, type Kind } from './fields';

/**
 * The free calculators: one page each, for the sums people search for most
 * often before they ever look for a tool.
 *
 * Each one is the arithmetic of a published guide, done on your own figures,
 * with the guide's explanation and questions under it in a few paragraphs. A
 * calculator is the page a search for "rental yield calculator" wants, and a
 * page that works the sum out in front of you is the one an assistant can cite
 * for a figure. The guide does the explaining; the calculator links to it, and
 * the guide links back.
 *
 * Content is data for the same reasons as the guides: the same words feed the
 * page, its structured data, the sitemap, /llms-full.txt and the chat, and
 * calculators.test.ts checks every one against its guide.
 *
 * Copy follows the house style: short sentences, plain words, no em-dashes.
 */
export type Calculator = {
  slug: string;
  kind: Kind;
  /** The page's heading, and how it is named in lists. */
  name: string;
  /** A name of a few words, for lists short on room (the footer). */
  short: string;
  topic: 'Property' | 'Valuation';
  search: { title: string; description: string };
  lead: string;
  /** What it works out and how, in under sixty words: the paragraph an assistant quotes. */
  answer: string;
  formulas: string[];
  /** How the figures are worked out, after the formulas. */
  blocks: Block[];
  faq: { q: string; a: string }[];
  /** The guide that explains the sum in full. */
  guide: string;
  /** Glossary ids for the terms the calculator uses. */
  terms: string[];
  /** The tool that does this on a whole schedule or a whole peer set. */
  tool: string;
  updated: string;
};

export const CALCULATORS: readonly Calculator[] = [
  {
    slug: 'rental-yield',
    kind: 'rental-yield',
    name: 'Rental yield calculator',
    short: 'Rental yield',
    topic: 'Property',
    search: {
      title: 'Rental Yield Calculator (Gross and Net)',
      description:
        'Work out the gross and net rental yield on a flat in India, after empty months, maintenance and property tax, and the rent that would cover your loan.',
    },
    lead: 'Gross and net rental yield on a property, after the months it stands empty and the costs the owner pays, and the rent it would take to cover the money in it.',
    answer:
      'Gross rental yield is a year’s rent divided by what the property cost. Net rental yield first takes off the months it stands empty, the maintenance the owner pays and other owner costs such as property tax. Compare the net yield with what the money costs you: below it, the rent does not pay for the money in the property.',
    formulas: [
      'Gross yield = monthly rent × 12 ÷ cost',
      'Net yield = (monthly rent × (12 − months empty) − maintenance × 12 − other owner costs) ÷ cost',
      'Rent that covers the money = (cost × rate + maintenance × 12 + other owner costs) ÷ (12 − months empty)',
    ],
    blocks: [
      {
        t: 'p',
        text: 'Use the full cost of the property, not only the price: stamp duty, registration and the other charges you paid to buy it are part of it. For a flat bought under construction, use its true cost at possession, which adds the loan interest and the return your own money gave up while it was built.',
      },
      {
        t: 'p',
        text: 'What the money costs is your home loan rate on the borrowed part and what your savings would otherwise earn on the rest. Leave it at 0 to skip the break-even rent.',
      },
      {
        t: 'note',
        title: 'What this leaves out',
        text: 'The figures are before tax and without growth: no rise in rent or in the property’s value, no tax on the rent and no deduction for loan interest.',
      },
    ],
    faq: [
      {
        q: 'What is a good rental yield in India?',
        a: 'There is no single figure. What matters is the net yield compared with what the money in the property costs you. If the net yield is lower, the rent does not cover the money, and the rest of the return has to come from the property rising in value.',
      },
      {
        q: 'What is the difference between gross and net rental yield?',
        a: 'Gross yield is a full year’s rent divided by the cost. Net yield first takes off the months the property is empty, the maintenance the owner pays and other owner costs such as property tax, so it is lower and closer to what you actually earn.',
      },
      {
        q: 'Should I divide by the price or the true cost?',
        a: 'By what the property actually cost you. For a ready flat that is the price plus the charges paid to buy it. For a flat bought under construction it is the true cost at possession, which is higher than the price.',
      },
    ],
    guide: 'rental-yield-on-property',
    terms: ['gross-rental-yield', 'net-rental-yield', 'true-cost', 'carrying-cost'],
    tool: 'true-property-cost',
    updated: '2026-10-29',
  },
  {
    slug: 'carpet-area',
    kind: 'carpet-area',
    name: 'Carpet area and loading calculator',
    short: 'Carpet area and loading',
    topic: 'Property',
    search: {
      title: 'Carpet Area and Loading Calculator',
      description:
        'Work out the loading on a flat, its carpet area in square metres and the price per square foot of carpet area, from the super built-up area and the rate.',
    },
    lead: 'How much of the area you are charged for you can actually use, and what each usable square foot costs.',
    answer:
      'Loading is how much bigger the area a flat is charged on is than its carpet area: the super built-up area divided by the carpet area, less one. To compare two flats fairly, divide each one’s total price by its carpet area, the floor area you can use as section 2(k) of RERA defines it.',
    formulas: [
      'Price = super built-up area × rate',
      'Loading on carpet area = super built-up area ÷ carpet area − 1',
      'Price per sq ft of carpet = price ÷ carpet area',
      'Square metres = square feet ÷ 10.7639',
    ],
    blocks: [
      {
        t: 'p',
        text: 'Loading is quoted two ways: as a share of the carpet area, or as the common area’s share of the super built-up area. The calculator gives both, so check which one a builder or a broker means before comparing figures.',
      },
      {
        t: 'p',
        text: 'Work out each flat you are considering, and compare the price per square foot of carpet area. A flat quoted at a higher rate can be the cheaper one for the space you can use, if its loading is lower.',
      },
    ],
    faq: [
      {
        q: 'How do I calculate carpet area from super built-up area?',
        a: 'You cannot work it out reliably from the super built-up area, because the loading differs from building to building. Ask for the carpet area: under RERA it has to be stated in the agreement for sale.',
      },
      {
        q: 'What is a normal loading?',
        a: 'There is no fixed figure. It depends on how much common area the building has, such as lobbies, lifts and amenities. Work it out from the carpet area in the agreement rather than relying on a typical percentage.',
      },
      {
        q: 'Is the balcony part of the carpet area?',
        a: 'No. Under section 2(k) of RERA, a balcony, verandah or open terrace for the flat’s exclusive use is left out of the carpet area, and its area is stated separately.',
      },
    ],
    guide: 'carpet-area-vs-built-up-vs-super-built-up',
    terms: ['carpet-area', 'built-up-area', 'super-built-up-area', 'loading'],
    tool: 'true-property-cost',
    updated: '2026-10-29',
  },
  {
    slug: 'gst-on-flat',
    kind: 'gst-flat',
    name: 'GST on an under-construction flat calculator',
    short: 'GST on a flat',
    topic: 'Property',
    search: {
      title: 'GST on Flat Calculator: 1% or 5%',
      description:
        'Check whether a flat bought under construction carries GST of 1% or 5%, or none after the completion certificate, and work out the GST in rupees.',
    },
    lead: 'Whether a flat bought under construction carries GST of 1%, 5% or nothing, and what that comes to on its price.',
    answer:
      'A flat bought under construction carries GST of 5% of the price, or 1% for an affordable home: up to 60 square metres of carpet area in a named metropolitan area, or 90 elsewhere, and a price of no more than ₹45 lakh. A flat sold after its completion certificate, with the whole price paid after it, carries none.',
    formulas: [
      'Affordable = carpet area ≤ 60 sq m (metro) or 90 sq m (elsewhere), and price ≤ ₹45 lakh',
      'GST = price × 1% if affordable, otherwise price × 5%',
      'No GST if the completion certificate came before any part of the price',
    ],
    blocks: [
      {
        t: 'p',
        text: 'The metropolitan areas are Bengaluru, Chennai, Delhi NCR (Delhi, Noida, Greater Noida, Ghaziabad, Gurgaon and Faridabad), Hyderabad, Kolkata and the whole Mumbai Metropolitan Region. Both conditions have to be met for the 1% rate: a small flat over ₹45 lakh is not affordable, and neither is a cheap one over the area limit.',
      },
      {
        t: 'p',
        text: 'Both rates are effective rates on the whole price, with no input tax credit for the builder. GST is charged on each demand the builder raises, so it is paid in step with the instalments rather than at the end.',
      },
      {
        t: 'note',
        title: 'Stamp duty is separate',
        text: 'Stamp duty and registration are charged by the state on the agreement, not by the builder, and are not part of GST. Budget for both on top of the price and the GST.',
      },
    ],
    faq: [
      {
        q: 'Is there GST on a ready-to-move flat?',
        a: 'Not if the completion certificate has been issued, or the building first occupied, and the whole price is received after that. If any part of the price was received before, the sale is taxed.',
      },
      {
        q: 'Is there GST on a resale flat?',
        a: 'Not on a completed flat sold by its owner. That is the sale of a building, which is outside GST.',
      },
      {
        q: 'Is GST charged on stamp duty and registration?',
        a: 'No. Stamp duty and registration are state charges on the agreement, paid separately. GST is charged on the price the builder charges for the flat.',
      },
    ],
    guide: 'gst-on-under-construction-flat',
    terms: ['affordable-residential-apartment', 'completion-certificate', 'carpet-area'],
    tool: 'true-property-cost',
    updated: '2026-10-29',
  },
  {
    slug: 'pre-emi',
    kind: 'pre-emi',
    name: 'Pre-EMI vs full EMI calculator',
    short: 'Pre-EMI vs full EMI',
    topic: 'Property',
    search: {
      title: 'Pre-EMI vs Full EMI Calculator',
      description:
        'Work out the pre-EMI on a home loan for an under-construction flat, the full EMI on the same amount, and how much of the loan each repays by possession.',
    },
    lead: 'What interest-only pre-EMI costs while a flat is built, against paying full EMI from the start, on the part of the loan disbursed so far.',
    answer:
      'Pre-EMI is interest only on the part of a home loan the bank has disbursed: amount disbursed × annual rate ÷ 12. It does not reduce the loan. Full EMI on the same amount costs more each month but starts repaying the loan at once, so less is owed at possession and less interest is paid in total.',
    formulas: [
      'Pre-EMI a month = amount disbursed × annual rate ÷ 12',
      'Full EMI = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1), where r is the monthly rate and n the months of the loan',
    ],
    blocks: [
      {
        t: 'p',
        text: 'Each time the bank pays a stage to the builder, the amount disbursed goes up and so does the pre-EMI. Run the calculator again at each stage, or use the amount you expect to have been disbursed by the time the flat is ready.',
      },
      {
        t: 'p',
        text: 'If possession is delayed, pre-EMI keeps running for every extra month. Change the months until possession to see what a delay costs.',
      },
      {
        t: 'note',
        title: 'Interest before possession and tax',
        text: 'Interest for the period before possession is claimed in five equal parts from the tax year construction is completed, within the limit for the property, under a tax regime that allows it. From tax year 2026-27 that is section 22 of the Income-tax Act, 2025.',
      },
    ],
    faq: [
      {
        q: 'Does pre-EMI reduce my home loan?',
        a: 'No. Pre-EMI is interest only. The loan at possession is the full amount disbursed, and the regular EMIs start after that.',
      },
      {
        q: 'Is pre-EMI or full EMI cheaper?',
        a: 'Pre-EMI is cheaper each month during construction. Full EMI is cheaper overall, because the loan starts coming down from the first payment.',
      },
      {
        q: 'Can I switch from pre-EMI to full EMI?',
        a: 'Many banks allow it part way through construction. Ask yours, and check whether it charges anything for the change.',
      },
    ],
    guide: 'pre-emi-vs-full-emi-under-construction',
    terms: ['pre-emi', 'full-emi', 'pre-construction-interest', 'carrying-cost'],
    tool: 'true-property-cost',
    updated: '2026-10-29',
  },
  {
    slug: 'ev-ebitda',
    kind: 'ev-ebitda',
    name: 'EV/EBITDA calculator',
    short: 'EV/EBITDA',
    topic: 'Valuation',
    search: {
      title: 'EV/EBITDA Calculator, with Equity Value',
      description:
        'Work out a company’s enterprise value, EBITDA and EV/EBITDA multiple in ₹ crore, and the value of its shares at a peer median multiple.',
    },
    lead: 'A company’s enterprise value, its EBITDA and the multiple between them, and what its shares are worth at the multiple its peers trade at.',
    answer:
      'EV/EBITDA divides enterprise value, which is market capitalisation plus debt less cash, by EBITDA, which is operating profit plus depreciation and amortisation. To value a company with it, multiply its EBITDA by the median multiple of similar listed companies, then take off net debt to reach the value of the shares.',
    formulas: [
      'Enterprise value = market capitalisation + debt − cash',
      'EBITDA = operating profit (EBIT) + depreciation and amortisation',
      'Value of the shares = peer median multiple × EBITDA − (debt − cash)',
    ],
    blocks: [
      {
        t: 'p',
        text: 'Use the same date for every figure: the market capitalisation on the valuation date, and the debt and cash from the balance sheet nearest to it. Use a normal year’s EBITDA, without one-off income or costs.',
      },
      {
        t: 'note',
        title: 'Where it misleads',
        text: 'A business that must keep spending heavily on equipment looks cheaper than it is, because EBITDA ignores that spending. Banks and insurers are not valued this way, because for them interest is the business itself.',
      },
    ],
    faq: [
      {
        q: 'What is a good EV/EBITDA ratio?',
        a: 'There is no single figure. A multiple only means something beside those of similar companies in the same industry, at the same date. Compare it with the median of a peer set rather than with a rule of thumb.',
      },
      {
        q: 'Why use EV/EBITDA rather than P/E?',
        a: 'Debt is in the price and interest is out of the earnings, so companies that borrow differently are compared on the same footing. It can also be used for a company making a loss after interest, where a P/E ratio means nothing.',
      },
      {
        q: 'How do I get from enterprise value to equity value?',
        a: 'Take off net debt, which is the company’s borrowings less its cash. What is left is the value of the shares.',
      },
    ],
    guide: 'ev-ebitda-multiple-explained',
    terms: ['enterprise-value', 'ebitda', 'ev-ebitda', 'net-debt', 'comparable-companies-method'],
    tool: 'valuation-desk',
    updated: '2026-10-29',
  },
];

export function calculatorBySlug(slug: string): Calculator | undefined {
  return CALCULATORS.find((c) => c.slug === slug);
}

/** The calculator that does a guide's sum, if there is one. */
export function calculatorForGuide(guideSlug: string): Calculator | undefined {
  return CALCULATORS.find((c) => c.guide === guideSlug);
}

/** The calculator's own worked example: its opening figures and what they come to. */
export function workedExample(c: Calculator) {
  return run(c.kind, defaults(c.kind));
}
