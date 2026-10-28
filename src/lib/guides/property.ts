import type { Guide } from './types';

/*
 * The worked example in both property guides is one flat, run through the True
 * Property Cost engine (lib/landed/calc). guides.test.ts runs it again and fails
 * if any figure quoted below stops matching what the engine says.
 *
 *   Booking      1 Apr 2024   ₹6,00,000   own funds
 *   Plinth       1 Oct 2024   ₹18,00,000  home loan
 *   10th slab    1 Jul 2025   ₹18,00,000  home loan
 *   Finishing    1 Apr 2026   ₹12,00,000  home loan
 *   Possession  31 Mar 2027   ₹6,00,000   own funds   (OC date 31 Mar 2027)
 *
 *   Own funds 7% a year, loan 8.5% a year, simple interest, 700 sq ft carpet.
 *   Rent ₹25,000 a month, maintenance ₹3,000 a month, ₹8,000 a year of other
 *   owner costs, one month in twelve empty (8.33%).
 */

export const TRUE_COST: Guide = {
  slug: 'true-cost-of-an-under-construction-flat',
  short: 'True cost of a flat',
  figure: { value: '₹68,76,912', label: 'True cost of a ₹60 lakh flat' },
  motif: 'tower',
  status: 'published',
  title: 'The true cost of an under-construction flat',
  search: {
    title: 'True Cost of an Under-Construction Flat',
    description:
      'Why a flat bought off plan costs more than its agreement value, how to add pre-EMI interest and lost returns, with a worked ₹60 lakh example.',
  },
  tool: 'true-property-cost',
  updated: '2026-10-27',
  lead:
    'The agreement value is what you pay. It is not what the flat costs you, because the money is paid years before you can live in it or let it.',
  answer:
    'Add up every payment, then add what each payment cost you while the flat was being built: interest on any loan from the day it was disbursed until possession, and the return your own money would have earned over the same time. The total is the true cost. In the worked example below, three years of construction add 14.6% to a ₹60 lakh price.',
  blocks: [
    { t: 'h2', text: 'Why the price is not the cost' },
    {
      t: 'p',
      text: 'An under-construction flat is paid for in stages: a booking amount, then a demand each time the builder reaches a milestone such as the plinth or a slab, and the last instalment on possession. Every rupee paid early sits in a building you cannot use. If it came from a home loan, it charged interest the whole time. If it came from your savings, it stopped earning whatever it earned before.',
    },
    {
      t: 'p',
      text: 'A ready flat has none of that cost, because you pay and move in, or let it, at once. So comparing an under-construction flat with a ready one on price alone flatters the under-construction flat. Comparing them on true cost does not.',
    },
    { t: 'h2', text: 'What goes into the true cost' },
    {
      t: 'ul',
      items: [
        'Every payment: the booking amount, each construction-linked demand, the possession instalment, and the charges paid on the way such as stamp duty, registration and GST.',
        'Interest on borrowed money: the home loan interest charged on each disbursement until possession. Before possession this is usually paid as pre-EMI interest, so it is real money leaving your account every month.',
        'The return given up on your own money: what your own funds would have earned if they had stayed invested. It never shows on a statement, but it is a cost all the same.',
      ],
    },
    { t: 'h2', text: 'How to work it out' },
    {
      t: 'ol',
      items: [
        'List every payment with its date, its amount and where the money came from: your own funds or the loan.',
        'Fix the possession date. The occupancy certificate (OC) date is a fair one to use, because that is when the flat can lawfully be lived in.',
        'For each payment, count the days from the date it was paid to the possession date.',
        'Apply the right rate: the loan rate to loan money, and your own return (what the money earned before, or would have) to your own money.',
        'Add the carrying cost of every payment to the total paid. That sum is the true cost.',
      ],
    },
    { t: 'formula', text: 'Carrying cost of one payment = amount × annual rate × days to possession ÷ 365' },
    {
      t: 'p',
      text: 'Simple interest is the usual choice, because that is how a lender charges pre-EMI interest during construction. If your own money would have compounded, compounding it gives a slightly higher figure.',
    },
    { t: 'h2', text: 'A worked example' },
    {
      t: 'p',
      text: 'A 700 sq ft flat with an agreement value of ₹60 lakh, booked on 1 April 2024, with the OC on 31 March 2027. Own money is assumed to earn 7% a year and the home loan costs 8.5% a year, simple interest.',
    },
    {
      t: 'table',
      caption: 'Each payment and what it cost until possession',
      head: ['Payment', 'Date', 'Amount', 'Source', 'Days to OC', 'Carrying cost'],
      rows: [
        ['Booking', '1 Apr 2024', '₹6,00,000', 'Own funds, 7%', '1,094', '₹1,25,885'],
        ['Plinth', '1 Oct 2024', '₹18,00,000', 'Loan, 8.5%', '911', '₹3,81,871'],
        ['10th slab', '1 Jul 2025', '₹18,00,000', 'Loan, 8.5%', '638', '₹2,67,436'],
        ['Finishing', '1 Apr 2026', '₹12,00,000', 'Loan, 8.5%', '364', '₹1,01,721'],
        ['Possession', '31 Mar 2027', '₹6,00,000', 'Own funds, 7%', '0', '₹0'],
      ],
    },
    {
      t: 'table',
      caption: 'What the flat really cost',
      head: ['', 'Amount'],
      rows: [
        ['Total paid', '₹60,00,000'],
        ['Interest on the loan', '₹7,51,027'],
        ['Return given up on own funds', '₹1,25,885'],
        ['True cost at possession', '₹68,76,912'],
        ['Above the price paid', '14.6%'],
        ['Per sq ft: price paid, then true cost', '₹8,571, then ₹9,824'],
      ],
    },
    {
      t: 'p',
      text: 'The flat cost ₹8.77 lakh more than its price by the day it could be used. Of that, ₹7.51 lakh was loan interest that actually left the account, so the cash cost was ₹67,51,027; the rest is the return the own funds gave up.',
    },
    { t: 'h2', text: 'What moves the number most' },
    {
      t: 'ul',
      items: [
        'Delay. Every month between a payment and possession adds to its cost, so a project that slips by a year adds a year of interest on everything already paid.',
        'How early the money goes in. Large payments early in construction cost far more than the same amounts paid near possession.',
        'The loan rate. Most of the money in a typical purchase is borrowed, so a point on the loan rate matters more than a point on your own return.',
      ],
    },
    {
      t: 'note',
      title: 'What this leaves out',
      text: 'The true cost here is before tax. It does not count any tax deduction on home loan interest, any rise in the flat’s value, or rent you may be paying elsewhere while you wait. Those can matter, and they belong in the decision, but they are separate from what the flat cost.',
    },
  ],
  faq: [
    {
      q: 'Is pre-EMI interest part of the cost of the flat?',
      a: 'Yes. It is interest on money borrowed to pay for the flat before you could use it, so it is part of what the flat cost you, even though the builder never sees it.',
    },
    {
      q: 'Why count a return on my own money if I never paid it to anyone?',
      a: 'Because the money stopped earning. Savings paid to a builder three years before possession gave up three years of whatever they were earning, and that is the cost of using them for the flat rather than leaving them where they were.',
    },
    {
      q: 'Which date should I use as possession?',
      a: 'The occupancy certificate (OC) date is a fair choice, because that is when the flat can lawfully be occupied. If you will not get the keys until later, use that later date instead.',
    },
    {
      q: 'Should stamp duty, registration and GST be included?',
      a: 'Yes, as payments on the dates you paid them. They carry a cost of money from those dates like any other instalment.',
    },
  ],
};

export const RENTAL_YIELD: Guide = {
  slug: 'rental-yield-on-property',
  short: 'Rental yield',
  figure: { value: '3.36%', label: 'Net yield on the true cost' },
  motif: 'sundial',
  status: 'published',
  title: 'How to calculate rental yield on a property',
  search: {
    title: 'How to Calculate Rental Yield on Property',
    description:
      'Gross and net rental yield explained, why yield on the price flatters a flat bought off plan, and how to tell if the rent covers the money, with an example.',
  },
  tool: 'true-property-cost',
  updated: '2026-10-27',
  lead:
    'Rental yield tells you what a property earns as a share of what it cost. Which yield you quote, and on which cost, changes the answer a great deal.',
  answer:
    'Gross rental yield is a year’s rent divided by the property’s cost. Net rental yield takes off the months it will stand empty, the maintenance you pay and other owner costs such as property tax, then divides by the cost. For a flat bought under construction, divide by its true cost, not its price, and compare the result with what the money costs you.',
  blocks: [
    { t: 'h2', text: 'Gross and net yield' },
    { t: 'formula', text: 'Gross yield = monthly rent × 12 ÷ cost of the property' },
    {
      t: 'formula',
      text: 'Net yield = (monthly rent × 12 × share of the year let − maintenance − other owner costs) ÷ cost of the property',
    },
    {
      t: 'p',
      text: 'Gross yield is the figure a broker quotes, and it is always the higher one. Net yield is closer to what the property actually puts in your pocket, because a flat is rarely let every month of every year, and the owner pays the society maintenance and the property tax whoever lives there.',
    },
    { t: 'h2', text: 'Which cost to divide by' },
    {
      t: 'p',
      text: 'For a ready flat, the cost is the price plus the charges paid to buy it. For a flat bought under construction, the money went in years before the first month’s rent, and those years cost interest on the loan and the return your own money gave up. Dividing the rent by the agreement value ignores all of that. Dividing by the true cost at possession does not.',
    },
    { t: 'h2', text: 'A worked example' },
    {
      t: 'p',
      text: 'The flat from our guide to the true cost of an under-construction flat: ₹60 lakh paid in stages from April 2024 to March 2027, ₹68,76,912 once the loan interest and the return given up on own funds are added. It lets for ₹25,000 a month. The owner pays ₹3,000 a month of maintenance and ₹8,000 a year of other costs, and expects one month in twelve to be empty between tenants.',
    },
    {
      t: 'table',
      caption: 'The same rent, measured four ways',
      head: ['Measure', 'Result'],
      rows: [
        ['Rent for a full year', '₹3,00,000'],
        ['Net rent after one empty month and owner costs', '₹2,31,010'],
        ['Gross yield on the price paid', '5.00%'],
        ['Gross yield on the true cost', '4.36%'],
        ['Net yield on the true cost', '3.36%'],
      ],
    },
    { t: 'h2', text: 'Does the rent cover the money?' },
    {
      t: 'p',
      text: 'A yield means little on its own. Set it beside what the money in the property costs a year. In the example, ₹48 lakh of the price was borrowed at 8.5% and ₹12 lakh came from savings earning 7%, so the money costs 8.2% a year on average. The net yield on the true cost is 3.36%, so the rent covers well under half of what the money costs.',
    },
    {
      t: 'p',
      text: 'For the rent alone to cover the money, the flat would need to let for about ₹55,262 a month. That does not make it a bad purchase, since a property can also rise in value, but it shows how much of the return has to come from that rise rather than from the rent.',
    },
    {
      t: 'note',
      title: 'What this leaves out',
      text: 'These figures are before tax and without growth: no rise in rent or in the property’s value, no tax on the rent and no deduction for loan interest.',
    },
  ],
  faq: [
    {
      q: 'What is the difference between gross and net rental yield?',
      a: 'Gross yield is a full year’s rent divided by the cost. Net yield first takes off the months the property is empty, the maintenance the owner pays and other owner costs such as property tax, so it is lower and closer to what you actually earn.',
    },
    {
      q: 'Why does yield on the price flatter a flat bought under construction?',
      a: 'Because the money was paid years before the first rent, and those years cost loan interest and lost returns. The price leaves that out; the true cost at possession includes it.',
    },
    {
      q: 'What is break-even rent?',
      a: 'The monthly rent at which the net yield on the true cost equals what the money costs you a year. Below it, the rent does not cover the cost of the money in the property.',
    },
  ],
};

/*
 * The pre-EMI example, checked by guides.test.ts:
 *
 *   ₹18,00,000 disbursed at 8.5% a year
 *   Pre-EMI (interest only)        18,00,000 × 8.5% ÷ 12        = ₹12,750 a month
 *   Over 24 months of construction 12,750 × 24                   = ₹3,06,000, loan still ₹18,00,000
 *   Full EMI over 20 years         standard EMI formula, n = 240 = ₹15,621 a month
 *   Of the first full EMI          15,621 − 12,750               = ₹2,871 repays the loan
 *   After 24 full EMIs             principal repaid               ≈ ₹74,815
 */
export const PRE_EMI: Guide = {
  slug: 'pre-emi-vs-full-emi-under-construction',
  short: 'Pre-EMI or full EMI',
  figure: { value: '₹12,750', label: 'Pre-EMI a month on ₹18 lakh disbursed' },
  motif: 'tower',
  status: 'published',
  title: 'Pre-EMI or full EMI on an under-construction flat?',
  search: {
    title: 'Pre-EMI vs Full EMI on an Under-Construction Flat',
    description:
      'What pre-EMI is, how it differs from paying full EMI while a flat is built, what each costs with a worked example, and how to choose between them.',
  },
  tool: 'true-property-cost',
  updated: '2026-10-28',
  lead:
    'While a flat is being built, the bank pays the builder in stages and you pay interest on what has been paid out. Whether you also start repaying the loan then is the choice between pre-EMI and full EMI.',
  answer:
    'Pre-EMI is interest only, on the part of the loan the bank has disbursed so far; the loan itself does not go down, and your regular EMIs start after possession or the final disbursement. Full EMI means paying EMIs on the disbursed amount from the start, so part of each payment repays the loan. Pre-EMI costs less each month during construction; full EMI costs less in total.',
  blocks: [
    { t: 'h2', text: 'How pre-EMI works' },
    {
      t: 'formula',
      text: 'Pre-EMI a month = amount disbursed × annual interest rate ÷ 12',
    },
    {
      t: 'p',
      text: 'Each time the builder raises a demand and the bank pays it, the amount disbursed goes up, and so does the pre-EMI. None of it reduces what you owe: at possession the loan is exactly the amount disbursed, and the full term of EMIs is still ahead of you.',
    },
    { t: 'h2', text: 'A worked example' },
    {
      t: 'p',
      text: 'Say ₹18,00,000 of the loan has been disbursed at 8.5% a year. The pre-EMI is ₹12,750 a month. If the flat takes another 24 months to finish at that stage, you pay ₹3,06,000 in pre-EMI and still owe the full ₹18,00,000 at possession.',
    },
    {
      t: 'p',
      text: 'On full EMI over 20 years, the same ₹18,00,000 costs ₹15,621 a month. Of the first payment, ₹12,750 is interest and ₹2,871 repays the loan, and after 24 payments about ₹74,815 of the loan has been repaid. You pay more each month during construction, and less interest over the life of the loan.',
    },
    {
      t: 'table',
      caption: 'Pre-EMI and full EMI on ₹18,00,000 at 8.5%',
      head: ['', 'Pre-EMI', 'Full EMI'],
      rows: [
        ['Paid each month during construction', '₹12,750', '₹15,621'],
        ['Of the first payment, repays the loan', 'Nil', '₹2,871'],
        ['Loan repaid after 24 months', 'Nil', 'About ₹74,815'],
      ],
    },
    { t: 'h2', text: 'Which to choose' },
    {
      t: 'ul',
      items: [
        'Pre-EMI suits you if you are also paying rent, or the builder’s schedule is long and the lower monthly outgo matters more.',
        'Full EMI suits you if you can afford it: the loan starts coming down at once and the total interest is lower.',
        'Ask the bank whether you can switch from pre-EMI to full EMI part way through; many allow it.',
        'Either way, if possession is delayed, pre-EMI keeps running for every extra month, which is the cost a delayed project adds.',
      ],
    },
    { t: 'h2', text: 'Interest before possession and tax' },
    {
      t: 'p',
      text: 'Interest paid before possession is not lost for tax purposes. Under section 24(b) it is claimed in five equal parts, starting from the year construction is completed, within the limit that applies to the property for that year. Whether it can be claimed at all depends on the tax regime you choose, so check your own position before relying on it.',
    },
    { t: 'h2', text: 'What it does to the flat’s true cost' },
    {
      t: 'p',
      text: 'Pre-EMI is a real cost of owning the flat before you can live in it or let it. Added to every instalment and charge, it is part of what the flat cost by possession, which is usually well above the agreement value.',
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
      q: 'Can I claim pre-EMI interest in my tax return?',
      a: 'Interest for the period before possession is claimed under section 24(b) in five equal parts from the year construction is completed, within the limit for the property, and only under a tax regime that allows it.',
    },
  ],
};
