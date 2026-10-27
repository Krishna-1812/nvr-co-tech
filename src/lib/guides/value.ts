import type { Guide } from './types';

/*
 * The comparables example, checked by guides.test.ts:
 *
 *   EV/EBITDA of five peers  9.5, 11.0, 12.5, 14.0, 18.0  → median 12.5x
 *   Target EBITDA ₹8 crore   → enterprise value ₹100 crore
 *   Net debt ₹15 crore       → equity value ₹85 crore
 *   P/E of the same peers    18, 20, 22, 25, 30           → median 22x
 *   Target profit after tax ₹4.5 crore → equity value ₹99 crore
 */

export const COMPARABLES: Guide = {
  slug: 'value-an-unlisted-company-with-comparables',
  status: 'draft',
  title: 'How to value an unlisted company using comparable companies',
  search: {
    title: 'Value a Company with Comparable Multiples',
    description:
      'How comparable company analysis works: choosing peers, EV/EBITDA and P/E, getting from enterprise value to equity value, and the mistakes that skew it.',
  },
  tool: 'valuation-desk',
  updated: '2026-10-27',
  lead:
    'A company with no share price can be valued by looking at what similar listed companies trade at, and applying the same multiples to its own figures.',
  answer:
    'Choose listed companies that do the same thing at a similar scale, work out what each trades at as a multiple of revenue, EBITDA or profit, and take the median. Multiply the company’s own figure by that median. An enterprise value multiple gives the value of the whole business, so take off net debt to reach the value of the shares; a P/E multiple gives the value of the shares directly.',
  blocks: [
    { t: 'h2', text: 'Step 1: choose the peers' },
    {
      t: 'p',
      text: 'The whole method rests on this step. A peer should earn its money the same way: the same products or services, sold to the same kind of customer. Industry codes are a starting point and often a poor one, because a single code can hold businesses with very different economics. Size, geography and profitability matter too: a loss-making company has no meaningful P/E, and a business ten times larger may trade at a premium the smaller one would never earn.',
    },
    {
      t: 'p',
      text: 'Write down every company you considered and left out, with the reason. A peer set is a judgement, and the first question anybody reviewing it asks is why a particular name is missing.',
    },
    { t: 'h2', text: 'Step 2: work out the multiples' },
    { t: 'formula', text: 'Enterprise value (EV) = market capitalisation + debt − cash' },
    {
      t: 'ul',
      items: [
        'EV/Revenue: useful for young or loss-making businesses, but blind to how profitable each one is.',
        'EV/EBITDA: the most common, because it compares operating earnings before the effects of debt, tax and depreciation policy.',
        'P/E: share price over earnings per share, or market capitalisation over profit after tax. It reflects each company’s debt and tax, so it compares equity with equity.',
      ],
    },
    {
      t: 'p',
      text: 'Use figures for the same period for every company, and leave a cell blank when a figure is not known rather than filling it with zero.',
    },
    { t: 'h2', text: 'Step 3: take the median, and look at the outliers' },
    {
      t: 'p',
      text: 'Use the median rather than the average, so that one company trading at an unusual multiple does not drag the answer. But look at the outlier before setting it aside: a peer at a far higher multiple may be one that has just been bought, at a price a real buyer paid.',
    },
    { t: 'h2', text: 'Step 4: apply it, and get to the value of the shares' },
    {
      t: 'p',
      text: 'An unlisted company makes ₹8 crore of EBITDA and ₹4.5 crore of profit after tax, and has ₹15 crore of net debt. Five listed peers trade at 9.5, 11.0, 12.5, 14.0 and 18.0 times EBITDA, and at 18, 20, 22, 25 and 30 times earnings.',
    },
    {
      t: 'table',
      caption: 'Two multiples, two routes to the value of the shares',
      head: ['', 'EV/EBITDA route', 'P/E route'],
      rows: [
        ['Median multiple', '12.5x', '22x'],
        ['Applied to', 'EBITDA ₹8 crore', 'Profit after tax ₹4.5 crore'],
        ['Gives', 'Enterprise value ₹100 crore', 'Equity value ₹99 crore'],
        ['Less net debt', '₹15 crore', 'Already reflected'],
        ['Value of the shares', '₹85 crore', '₹99 crore'],
      ],
    },
    {
      t: 'p',
      text: 'The two routes rarely agree exactly. Differences in debt, tax and depreciation between the company and its peers pull them apart, which is why a valuation usually presents a range from the methods used rather than a single figure.',
    },
    { t: 'h2', text: 'The mistake that matters most' },
    {
      t: 'p',
      text: 'Never subtract debt from a value found with P/E, and never forget to subtract it from a value found with an EV multiple. An EV multiple values the whole business, lenders included; P/E values only the shares. Mixing them up overstates or understates a company with debt by the whole of that debt.',
    },
    {
      t: 'note',
      title: 'Listed and unlisted are not the same',
      text: 'Shares in a listed company can be sold in a day; shares in a private company usually cannot. Valuers often reflect that with a discount for lack of marketability, and its size depends on the facts of the case. A valuation for a regulatory purpose may also have to follow a prescribed method, so check what the purpose requires.',
    },
  ],
  faq: [
    {
      q: 'Why use the median multiple instead of the average?',
      a: 'Because one peer at an unusual multiple can move an average a long way. The median is the middle company, so a single outlier barely shifts it.',
    },
    {
      q: 'Do I subtract debt when using a P/E multiple?',
      a: 'No. P/E already gives the value of the shares. Debt is subtracted only from an enterprise value, such as one found with EV/EBITDA or EV/Revenue.',
    },
    {
      q: 'Where do the figures for listed peers come from?',
      a: 'From their filings: annual reports and results filed with the stock exchanges, and in India the financial statements filed with the Ministry of Corporate Affairs.',
    },
  ],
};
