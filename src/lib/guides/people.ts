import type { Guide } from './types';

/*
 * The net worth example is plain addition, and guides.test.ts adds it up again:
 *
 *   Assets      savings 3,50,000 · FDs 5,00,000 · mutual funds 12,40,000
 *               EPF 8,60,000 · PPF 4,20,000 · half of a ₹90 lakh flat 45,00,000
 *               gold 3,00,000 · car 4,00,000                    = 85,70,000
 *   Liabilities half of a ₹38 lakh home loan 19,00,000
 *               car loan 2,40,000 · credit card 35,000          = 21,75,000
 *   Net worth                                                   = 63,95,000
 *   Liquid      savings + FDs + mutual funds                    = 20,90,000
 */

export const NET_WORTH: Guide = {
  slug: 'how-to-calculate-net-worth',
  status: 'published',
  title: 'How to calculate your net worth',
  search: {
    title: 'How to Calculate Your Net Worth (India)',
    description:
      'Add up what you own, take away what you owe: a step-by-step net worth calculation for an Indian household, with jointly held property and a worked example.',
  },
  tool: 'wealth-tracker',
  updated: '2026-10-27',
  lead:
    'Your net worth is one number: everything you own, less everything you owe. Working it out properly is mostly a matter of not leaving anything out.',
  answer:
    'List everything you own at what it is worth today: bank balances, deposits, investments, provident fund, property, gold and vehicles. List everything you owe: home and car loans, credit card balances and personal loans. Count only your share of anything held jointly. Net worth is the first total less the second.',
  blocks: [
    { t: 'h2', text: 'What counts as an asset' },
    {
      t: 'ul',
      items: [
        'Money in the bank: savings and current accounts, and fixed and recurring deposits.',
        'Investments: shares, mutual funds, bonds, and the National Pension System.',
        'Retirement savings: EPF and PPF balances, which are yours even though you cannot spend them yet.',
        'Property: flats, houses and plots at what they would sell for today, not what you paid.',
        'Gold and other valuables at today’s value, and vehicles at what they would fetch, not their price new.',
        'Money you have lent that you expect to get back.',
        'Life insurance with a surrender value: count that value. A pure term policy has none until a claim, so it adds nothing to net worth.',
      ],
    },
    { t: 'h2', text: 'What counts as a liability' },
    {
      t: 'ul',
      items: [
        'The outstanding balance on every loan: home, car, education, personal and gold loans.',
        'Credit card balances, whether or not they are due yet.',
        'Money you have borrowed from family or friends.',
      ],
    },
    { t: 'h2', text: 'Jointly held assets and loans' },
    {
      t: 'p',
      text: 'Count your share, not the whole. If you and your spouse each own half of a flat, put half its value in your figures, and do the same with a loan you hold jointly. Working out each person’s net worth separately and adding them gives the household figure without counting anything twice.',
    },
    { t: 'h2', text: 'A worked example' },
    {
      t: 'table',
      caption: 'Assets, at today’s values',
      head: ['Asset', 'Value'],
      rows: [
        ['Savings accounts', '₹3,50,000'],
        ['Fixed deposits', '₹5,00,000'],
        ['Mutual funds', '₹12,40,000'],
        ['EPF', '₹8,60,000'],
        ['PPF', '₹4,20,000'],
        ['Flat worth ₹90 lakh, owned half and half', '₹45,00,000'],
        ['Gold', '₹3,00,000'],
        ['Car', '₹4,00,000'],
        ['Total assets', '₹85,70,000'],
      ],
    },
    {
      t: 'table',
      caption: 'Liabilities, as outstanding today',
      head: ['Liability', 'Outstanding'],
      rows: [
        ['Home loan of ₹38 lakh, held jointly: your half', '₹19,00,000'],
        ['Car loan', '₹2,40,000'],
        ['Credit card', '₹35,000'],
        ['Total liabilities', '₹21,75,000'],
      ],
    },
    { t: 'formula', text: 'Net worth = ₹85,70,000 − ₹21,75,000 = ₹63,95,000' },
    { t: 'h2', text: 'Three numbers worth looking at beside it' },
    {
      t: 'ul',
      items: [
        'Liquid assets: what you could turn into cash within days. In the example, the savings, deposits and mutual funds come to ₹20,90,000. EPF, PPF, the flat and the car do not count, however large they are.',
        'Debt as a share of assets: ₹21,75,000 of ₹85,70,000, about a quarter.',
        'Monthly EMIs: what the loans take out of each month’s income, which matters more day to day than the balances do.',
      ],
    },
    { t: 'h2', text: 'While you are at it: nominees' },
    {
      t: 'p',
      text: 'Going through every account to find its balance is the right moment to check that each one that takes a nominee has one, that the nominee is still the person you want, and that a nominee who is a minor has a guardian named. An account with no nominee can take your family much longer to claim.',
    },
  ],
  faq: [
    {
      q: 'Should I include my house in my net worth?',
      a: 'Yes, at what it would sell for today, with the loan on it as a liability. If you want a figure for what you could actually spend, look at liquid assets as well, which leave the house out.',
    },
    {
      q: 'Do EPF and PPF count towards net worth?',
      a: 'Yes. The balances are yours, even though you cannot withdraw all of them yet. They do not count as liquid assets.',
    },
    {
      q: 'How often should I work out my net worth?',
      a: 'Once or twice a year is enough for most households, and whenever something large changes: a property bought or sold, a loan taken or cleared.',
    },
  ],
};

export const TAX_NOTICES: Guide = {
  slug: 'check-income-tax-notices-e-proceedings',
  status: 'published',
  title: 'How to check for income tax notices on the e-Filing portal',
  search: {
    title: 'How to Check Income Tax Notices Online',
    description:
      'Where income tax notices appear on the e-Filing portal, how to find the response date, how to check a notice is genuine, and how CA firms track many clients.',
  },
  tool: 'tax-notices',
  updated: '2026-10-27',
  lead:
    'The Income Tax Department sends most notices to the e-Filing portal. The email or text about one is easy to miss; the notice itself waits in the portal with a date for your reply.',
  answer:
    'Log in to the Income Tax e-Filing portal, open Pending Actions and choose e-Proceedings. Notices that need a reply are listed there with their section and response date, and you can open each one, read it and submit a response from the same screen. Check regularly rather than waiting for an email, because the response date runs whether or not you saw the email.',
  blocks: [
    { t: 'h2', text: 'Where notices appear' },
    {
      t: 'ol',
      items: [
        'Log in at incometax.gov.in with the PAN and password of the person or business the notice is for.',
        'Open Pending Actions, then e-Proceedings.',
        'Look through the proceedings listed. Each shows its assessment year and the section it was issued under, with the notices inside it.',
        'Open a notice to read it and see its response date, and to submit a response or ask for more time where the portal allows it.',
      ],
    },
    {
      t: 'p',
      text: 'The e-Proceedings screen is split into what needs your action and what is only for your information. Read both: a notice for information today can be followed by one that needs a reply.',
    },
    { t: 'h2', text: 'Check that a notice is genuine' },
    {
      t: 'p',
      text: 'Notices from the Income Tax Department carry a Document Identification Number (DIN). The e-Filing portal has a service to authenticate a notice or order issued by the department, where you can check the DIN or the details of a notice you have received. Be wary of a notice that arrives only by email or message and cannot be found in the portal, and never pay or share a password through a link in such a message.',
    },
    { t: 'h2', text: 'Why the response date matters' },
    {
      t: 'p',
      text: 'The date in the notice is the deadline, whether or not the email about it reached you. Miss it and the proceeding can go ahead without your side of the story, and a later reply may need a reason for the delay. If you need more time, ask for it through the portal before the date, not after.',
    },
    { t: 'h2', text: 'Keeping track for many clients' },
    {
      t: 'p',
      text: 'A firm that looks after forty clients would have to log in to forty accounts to be sure nothing new has arrived, and do it often enough that no response date slips past. The usual answers are a weekly round of logins by a junior, which is slow and easy to skip, or relying on clients to forward the department’s emails, which often land in spam. Whatever the method, it should give one list of every open notice and its due date, and it should say clearly which accounts could not be checked, so that a missed login is never mistaken for no notices.',
    },
  ],
  faq: [
    {
      q: 'Where can I see income tax notices online?',
      a: 'On the Income Tax e-Filing portal, under Pending Actions and then e-Proceedings, after logging in with the PAN the notice is addressed to.',
    },
    {
      q: 'How do I know if an income tax notice is genuine?',
      a: 'Check its Document Identification Number (DIN) with the e-Filing portal’s service for authenticating notices and orders, and confirm the notice also appears under e-Proceedings in your own login.',
    },
    {
      q: 'What if I need more time to respond?',
      a: 'Ask for it through the portal before the response date, where the notice allows it, rather than replying late.',
    },
  ],
};
