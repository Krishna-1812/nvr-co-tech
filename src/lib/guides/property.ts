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
      text: 'Interest paid before possession is not lost for tax purposes. It is claimed in five equal parts, starting from the tax year in which construction is completed, within the limit that applies to the property for that year. From tax year 2026-27 the rule is in section 22 of the Income-tax Act, 2025; for earlier years it was section 24(b) of the 1961 Act. Whether it can be claimed at all depends on the tax regime you choose, so check your own position before relying on it.',
    },
    { t: 'h2', text: 'What it does to the flat’s true cost' },
    {
      t: 'p',
      text: 'Pre-EMI is a real cost of owning the flat before you can live in it or let it. Added to every instalment and charge, it is part of what the flat cost by possession, which is usually well above the agreement value.',
    },
  ],
  sources: [
    {
      name: 'Income-tax Act, 2025, section 22: deductions from income from house property',
      publisher: 'Income Tax Department',
      url: 'https://www.incometaxindia.gov.in/w/section-22-218',
    },
    {
      name: 'Income-tax Act, 2025, section 22, full text',
      publisher: 'Indian Kanoon',
      url: 'https://indiankanoon.org/doc/26891583/',
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
      a: 'Interest for the period before possession is claimed in five equal parts from the tax year construction is completed, within the limit for the property, and only under a tax regime that allows it. From tax year 2026-27 that is section 22 of the Income-tax Act, 2025, which took the place of section 24(b) of the 1961 Act.',
    },
  ],
};

/*
 * The carpet area example, checked by guides.test.ts:
 *
 *   Flat A  1,000 sq ft super built-up at ₹8,000  = ₹80,00,000   carpet 700 sq ft
 *           per sq ft of carpet 80,00,000 ÷ 700  = ₹11,429        loading 1,000 ÷ 700 − 1 = 42.9%
 *   Flat B    950 sq ft super built-up at ₹8,400  = ₹79,80,000   carpet 720 sq ft
 *           per sq ft of carpet 79,80,000 ÷ 720  = ₹11,083        loading   950 ÷ 720 − 1 = 31.9%
 *   65 sq m × 10.7639                             = 699.65 sq ft
 */
export const CARPET_AREA: Guide = {
  slug: 'carpet-area-vs-built-up-vs-super-built-up',
  short: 'Carpet vs super built-up',
  figure: { value: '42.9%', label: 'Loading on flat A’s carpet area' },
  motif: 'tower',
  status: 'published',
  title: 'Carpet area, built-up area and super built-up area: what you are paying for',
  search: {
    title: 'Carpet Area vs Built-Up vs Super Built-Up Area',
    description:
      'What carpet, built-up and super built-up area mean under RERA, how loading works, and how to compare flats on the price per square foot you can use.',
  },
  tool: 'true-property-cost',
  updated: '2026-10-28',
  lead:
    'A flat is sold in square feet, but not always the same square feet. Which area the price is quoted on can make a cheaper-looking flat the dearer one.',
  answer:
    'Carpet area is the floor area you can actually use inside a flat’s walls, as section 2(k) of RERA defines it: it leaves out the external walls, service shafts, exclusive balconies and open terraces. Built-up area adds the walls and, usually, the balcony. Super built-up area also adds a share of the lobby, lifts, staircases and other common areas, which is called loading. To compare two flats, divide each total price by its carpet area.',
  blocks: [
    { t: 'h2', text: 'The three areas, from smallest to largest' },
    {
      t: 'ul',
      items: [
        'Carpet area: the net usable floor area inside the flat. It includes the area under the internal partition walls, and leaves out the external walls, the service shafts, any balcony or verandah for the flat’s exclusive use and any exclusive open terrace.',
        'Built-up area: the carpet area plus the area the flat’s walls stand on, and in most quotations its balcony as well.',
        'Super built-up area: the built-up area plus the flat’s share of the building’s common areas, such as the entrance lobby, lift wells, staircases, corridors and sometimes the clubhouse. It is also called super area or saleable area.',
      ],
    },
    { t: 'h2', text: 'What RERA changed' },
    {
      t: 'p',
      text: 'Before the Real Estate (Regulation and Development) Act, 2016, carpet area had no definition in law, and each builder measured it its own way. Section 2(k) of the Act now defines it in the words above, and section 4(2)(h) requires a builder registering a project to state the number, type and carpet area of the flats for sale, with the areas of exclusive balconies, verandahs and open terraces given separately.',
    },
    {
      t: 'p',
      text: 'Some state authorities have gone further. Haryana’s, for example, requires flats in registered projects to be sold on carpet area only, with the rate inclusive of all charges, rather than on super area.',
    },
    { t: 'h2', text: 'Loading, and why it matters' },
    {
      t: 'p',
      text: 'Loading is how much bigger the area you are charged for is than the area you can use. It is quoted in two ways, as a share of the carpet area or as a share of the super built-up area, so check which before comparing two figures.',
    },
    { t: 'formula', text: 'Loading = super built-up area ÷ carpet area − 1' },
    {
      t: 'p',
      text: 'A rate per square foot on super built-up area tells you little on its own, because the same rate on a building with heavy loading buys much less usable space. The rate that compares like with like is the total price divided by the carpet area.',
    },
    { t: 'h2', text: 'A worked example' },
    {
      t: 'p',
      text: 'Two flats in the same area. Flat A is offered at ₹8,000 a square foot on 1,000 square feet of super built-up area, so ₹80,00,000, and its carpet area is 700 square feet. Flat B is offered at ₹8,400 a square foot on 950 square feet, so ₹79,80,000, and its carpet area is 720 square feet.',
    },
    {
      t: 'table',
      caption: 'The same two flats, on the area you can use',
      head: ['', 'Flat A', 'Flat B'],
      rows: [
        ['Super built-up area', '1,000 sq ft', '950 sq ft'],
        ['Rate quoted', '₹8,000', '₹8,400'],
        ['Price', '₹80,00,000', '₹79,80,000'],
        ['Carpet area', '700 sq ft', '720 sq ft'],
        ['Loading on carpet area', '42.9%', '31.9%'],
        ['Price per sq ft of carpet', '₹11,429', '₹11,083'],
      ],
    },
    {
      t: 'p',
      text: 'Flat B is quoted at the higher rate, yet it gives you 20 more square feet to live in for ₹20,000 less, and costs ₹11,083 for each square foot you can use against ₹11,429 for flat A.',
    },
    { t: 'h2', text: 'Square metres and square feet' },
    {
      t: 'p',
      text: 'RERA registrations and agreements often state areas in square metres. One square metre is 10.7639 square feet, so a carpet area of 65 square metres is 699.65 square feet, about 700.',
    },
    { t: 'h2', text: 'What to ask before you book' },
    {
      t: 'ol',
      items: [
        'The carpet area, as section 2(k) of RERA defines it, written into the agreement for sale.',
        'The areas of any exclusive balcony, verandah or open terrace, stated separately.',
        'What the price includes: parking, preferential location charges, clubhouse and other charges.',
        'The super built-up area the rate is quoted on, so you can work out the loading yourself.',
      ],
    },
  ],
  sources: [
    {
      name: 'Sale of apartments and floors in a real estate project on the basis of carpet area: regulations, 2021 (quoting RERA sections 2(k) and 4(2)(h))',
      publisher: 'Haryana Real Estate Regulatory Authority, Gurugram',
      url: 'https://haryanarera.gov.in/regulations/Sale_of_ApartmentsFloors_in_a_Real_Estate_Project_on_the_basis_of_Carpet_Area.pdf',
    },
  ],
  faq: [
    {
      q: 'Is the balcony part of the carpet area?',
      a: 'No. Under section 2(k) of RERA, a balcony, verandah or open terrace for the flat’s exclusive use is left out of the carpet area, and its area is stated separately.',
    },
    {
      q: 'Are internal walls included in the carpet area?',
      a: 'Yes. The area under the internal partition walls is part of the carpet area. The external walls are not.',
    },
    {
      q: 'What is a normal loading?',
      a: 'There is no fixed figure. It depends on how much common area the building has, such as lobbies, lifts and amenities. Work it out from the carpet area in the agreement rather than relying on a typical percentage.',
    },
    {
      q: 'Which area should I compare flats on?',
      a: 'Carpet area. Divide each flat’s total price by its carpet area and compare those figures.',
    },
  ],
};

/*
 * The GST example, checked by guides.test.ts:
 *
 *   Pune is not one of the metropolitan areas in the definition; Thane is in
 *   the Mumbai Metropolitan Region, which is.
 *
 *   ₹60,00,000, Pune,  75 sq m   over ₹45 lakh             → 5%  = ₹3,00,000
 *   ₹40,00,000, Pune,  85 sq m   ≤ 90 sq m and ≤ ₹45 lakh  → 1%  = ₹40,000
 *   ₹40,00,000, Thane, 62 sq m   over 60 sq m in a metro   → 5%  = ₹2,00,000
 */
export const GST_ON_FLATS: Guide = {
  slug: 'gst-on-under-construction-flat',
  short: 'GST on a flat',
  figure: { value: '₹3,00,000', label: 'GST on a ₹60 lakh flat' },
  motif: 'tower',
  status: 'published',
  title: 'GST on an under-construction flat: 1%, 5%, or none',
  search: {
    title: 'GST on Under-Construction Flats: 1% or 5%',
    description:
      'GST on a flat bought under construction is 5% of the price, or 1% for an affordable home. What counts as affordable, and when a flat carries no GST at all.',
  },
  tool: 'true-property-cost',
  updated: '2026-10-28',
  lead:
    'GST is one of the larger charges on a flat bought off plan, and it is paid in step with the instalments. Whether it is 1%, 5% or nothing depends on three facts about the flat.',
  answer:
    'A flat bought before its completion certificate carries GST of 5% of the total price, or 1% if it is an affordable home, with no input tax credit for the builder. Affordable means a carpet area of up to 60 square metres in the metropolitan areas named in the rules, or 90 elsewhere, and a price of no more than ₹45 lakh. A flat sold after the completion certificate, with the whole price received after it, carries no GST.',
  blocks: [
    { t: 'h2', text: 'The two rates' },
    {
      t: 'table',
      caption: 'GST on residential flats from 1 April 2019',
      head: ['Flat', 'GST on the total price'],
      rows: [
        ['Affordable residential apartment', '1%'],
        ['Any other residential apartment', '5%'],
      ],
    },
    {
      t: 'p',
      text: 'Both are effective rates on the whole price. The law treats a third of the price as the value of the land, which carries no GST, and taxes the rest at a higher rate that works out to 1% or 5% of the total. The builder cannot set input tax credit against either, which is why they are lower than the 8% and 12% charged before April 2019.',
    },
    { t: 'h2', text: 'What counts as an affordable home' },
    {
      t: 'p',
      text: 'Both conditions have to be met.',
    },
    {
      t: 'ul',
      items: [
        'A carpet area of up to 60 square metres in a metropolitan area, or up to 90 square metres anywhere else, villages included.',
        'A price charged by the builder of no more than ₹45 lakh.',
        'The metropolitan areas are Bengaluru, Chennai, Delhi NCR (Delhi, Noida, Greater Noida, Ghaziabad, Gurgaon and Faridabad), Hyderabad, Kolkata and the whole Mumbai Metropolitan Region.',
      ],
    },
    { t: 'h2', text: 'When there is no GST' },
    {
      t: 'p',
      text: 'GST applies to the construction of a flat for sale. Once the completion certificate is issued, or the building is first occupied if that comes sooner, a flat sold with the whole price received after that date is the sale of a building, which GST does not reach. A completed flat resold by its owner carries no GST for the same reason.',
    },
    {
      t: 'note',
      title: 'Stamp duty is separate',
      text: 'Stamp duty and registration are charged by the state on the agreement, not by the builder, and are not part of GST. Budget for both on top of the price and the GST.',
    },
    { t: 'h2', text: 'A worked example' },
    {
      t: 'p',
      text: 'Three flats, each bought under construction. Pune is not one of the named metropolitan areas; Thane is part of the Mumbai Metropolitan Region, which is.',
    },
    {
      t: 'table',
      caption: 'Which rate applies, and what it comes to',
      head: ['Flat', 'Carpet area', 'Price', 'Rate', 'GST'],
      rows: [
        ['Pune', '75 sq m', '₹60,00,000', '5%', '₹3,00,000'],
        ['Pune', '85 sq m', '₹40,00,000', '1%', '₹40,000'],
        ['Thane', '62 sq m', '₹40,00,000', '5%', '₹2,00,000'],
      ],
    },
    {
      t: 'p',
      text: 'The first flat costs more than ₹45 lakh, so it is not affordable whatever its size. The second is under both limits. The third costs the same as the second but is two square metres over the 60 square metre limit for a metropolitan area, which moves it from 1% to 5% and adds ₹1,60,000 of GST.',
    },
    { t: 'h2', text: 'How it is paid, and what it does to the true cost' },
    {
      t: 'p',
      text: 'GST is charged on each demand the builder raises, so it is paid in step with a construction-linked plan rather than in one sum at the end. Like every instalment, the GST paid years before possession ties up money that would otherwise earn a return or reduce a loan, which is part of a flat’s true cost.',
    },
  ],
  sources: [
    {
      name: 'Frequently asked questions on the real estate sector (GST rates from 1 April 2019)',
      publisher: 'GST Council',
      url: 'https://www.gstcouncil.gov.in/sites/default/files/2024-02/faq-real-estate-sector.pdf',
    },
    {
      name: 'Press release on the 34th meeting of the GST Council: rates for residential real estate',
      publisher: 'GST Council and the Press Information Bureau',
      url: 'https://gstcouncil.gov.in/sites/default/files/2024-10/34th_gst_press_information_bureau.pdf',
    },
  ],
  faq: [
    {
      q: 'Is GST charged on stamp duty and registration?',
      a: 'No. Stamp duty and registration are state charges on the agreement, paid separately. GST is charged on the price the builder charges for the flat.',
    },
    {
      q: 'Is there GST on a ready-to-move flat?',
      a: 'Not if the completion certificate has been issued, or the building first occupied, and the whole price is received after that. If any part of the price was received before, the sale is taxed.',
    },
    {
      q: 'Is there GST on a resale flat?',
      a: 'Not on a completed flat sold by its owner. That is the sale of a building, which is outside GST.',
    },
    {
      q: 'Why did GST on flats fall from 12% to 5%?',
      a: 'From 1 April 2019 the rates were cut to 5%, and 1% for affordable homes, with the condition that the builder takes no input tax credit. Before that the rates were 12% and 8% with credit.',
    },
  ],
};
