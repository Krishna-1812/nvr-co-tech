import type { Guide } from './types';

/*
 * The reconciliation example is small enough to check by hand, and
 * guides.test.ts checks it: the cash book balance plus the additions less the
 * deductions has to equal the bank balance quoted.
 *
 *   Cash book balance (Dr)                       1,25,000
 *   + cheques issued, not yet presented   18,000 + 7,500
 *   + interest credited by the bank, not in the cash book   1,240
 *   + NEFT from a customer, not in the cash book            9,000
 *   − cheque deposited, not yet credited                   12,000
 *   − bank charges, not in the cash book                      590
 *   = balance as per bank statement (Cr)         1,48,150
 */

export const BANK_RECONCILIATION: Guide = {
  slug: 'bank-reconciliation-statement',
  short: 'Bank reconciliation statement',
  figure: { value: '₹1,48,150', label: 'The bank balance it ties to' },
  motif: 'ledger',
  status: 'published',
  title: 'How to prepare a bank reconciliation statement',
  search: {
    title: 'Bank Reconciliation Statement: How to Prepare',
    description:
      'What a bank reconciliation statement is, why the cash book and bank statement differ, and how to prepare one step by step, with a format and a worked example.',
  },
  tool: 'ledger-reconciliation',
  updated: '2026-10-27',
  lead:
    'Your cash book and your bank statement record the same money, but rarely agree on the same day. A bank reconciliation statement explains every difference between them.',
  answer:
    'Start from the balance in your cash book. Add cheques you have issued that the bank has not yet paid, and credits the bank has given you that you have not recorded. Take off cheques you have deposited that the bank has not yet credited, and charges the bank has taken that you have not recorded. The result should equal the balance on the bank statement.',
  blocks: [
    { t: 'h2', text: 'Why the two balances differ' },
    {
      t: 'p',
      text: 'Most differences are timing: one side has recorded something the other has not caught up with yet. A few are omissions that need an entry in your books, and occasionally one is a mistake on one side or the other.',
    },
    {
      t: 'ul',
      items: [
        'Cheques issued but not yet presented: you have written them and recorded the payment, but the payee has not cashed them.',
        'Cheques deposited but not yet credited: you have recorded the receipt, but the bank has not finished clearing them.',
        'Bank charges, interest and direct debits: the bank has recorded them and you have not, usually because you learn of them only from the statement.',
        'Direct credits: money a customer sent by NEFT, RTGS or UPI that reached the bank before it reached your books.',
        'Errors: an amount typed wrongly, a transposed figure or an entry made twice, on either side.',
      ],
    },
    { t: 'h2', text: 'One thing to know before you start' },
    {
      t: 'p',
      text: 'Your cash book and the bank’s statement are mirror images. Money in your account is an asset to you, so a deposit is a debit in your cash book. To the bank it is money it owes you, so the same deposit is a credit on its statement. A debit balance in your cash book and a credit balance on the bank statement are the same healthy position.',
    },
    { t: 'h2', text: 'Step by step' },
    {
      t: 'ol',
      items: [
        'Take the cash book and the bank statement for the same period, ending on the same date.',
        'Tick off every entry that appears in both, matching on cheque number or reference first, then on date and amount.',
        'List what is left on each side. Those unticked lines are the reconciling items.',
        'Put through your books anything the bank has recorded correctly that you have not, such as bank charges, interest and direct credits. Those are now in both records.',
        'Start the statement from one balance, add and deduct the items that are still timing differences, and check that you arrive at the other balance.',
        'If it does not tie, look for an amount entered twice, a figure with its digits swapped, or a decimal point in the wrong place.',
      ],
    },
    { t: 'h2', text: 'A worked example' },
    {
      t: 'p',
      text: 'On 31 March the cash book shows ₹1,25,000 in the bank. The bank statement for the same date shows ₹1,48,150. Ticking the two off against each other leaves six items unmatched.',
    },
    {
      t: 'table',
      caption: 'Bank reconciliation statement as at 31 March',
      head: ['', '₹', '₹'],
      rows: [
        ['Balance as per cash book', '', '1,25,000'],
        ['Add: cheque no. 456 issued, not yet presented', '18,000', ''],
        ['Add: cheque no. 459 issued, not yet presented', '7,500', ''],
        ['Add: interest credited by the bank, not in the cash book', '1,240', ''],
        ['Add: NEFT received from a customer, not in the cash book', '9,000', '35,740'],
        ['Less: cheque deposited, not yet credited by the bank', '12,000', ''],
        ['Less: bank charges, not in the cash book', '590', '(12,590)'],
        ['Balance as per bank statement', '', '1,48,150'],
      ],
    },
    {
      t: 'p',
      text: 'The interest, the NEFT receipt and the bank charges should now be entered in the cash book, which brings its balance to ₹1,34,650. After that, the only differences left are the two cheques not yet presented and the one deposit not yet cleared, which will clear on their own in the next few days.',
    },
    { t: 'h2', text: 'The same method, for any two ledgers' },
    {
      t: 'p',
      text: 'Reconciling a customer’s ledger with their statement of account, or a supplier’s ledger with the supplier’s statement, works the same way: match the entries, list what is left, and explain each one as timing, omission or error.',
    },
  ],
  sources: [
    {
      name: 'Principles and Practice of Accounting, Module 1, chapter 3: Bank Reconciliation Statement',
      publisher: 'The Institute of Chartered Accountants of India (Foundation course study material)',
      url: 'https://resource.cdn.icai.org/61784bos50279mod1-ipages.pdf',
    },
  ],
  faq: [
    {
      q: 'Can I start from the bank statement balance instead of the cash book?',
      a: 'Yes. Starting from the bank statement, you reverse every adjustment: deduct what you would have added and add what you would have deducted, and you should arrive at the cash book balance.',
    },
    {
      q: 'What if the bank statement shows an overdraft?',
      a: 'The method is the same, but start from the overdraft and remember that it is a debit balance on the bank statement and a credit balance in the cash book. Additions and deductions swap round.',
    },
    {
      q: 'How often should I reconcile the bank?',
      a: 'At least once a month, when the statement arrives. The longer you leave it, the more items there are to match and the harder an error is to find.',
    },
    {
      q: 'Which differences need an entry in my books?',
      a: 'Anything the bank recorded correctly and you did not: bank charges, interest, direct debits and direct credits. Cheques not yet presented or not yet cleared need no entry; they clear on their own.',
    },
  ],
};

export const PAYMENT_VOUCHER: Guide = {
  slug: 'payment-voucher-format-and-approvals',
  short: 'Payment voucher format',
  figure: { value: '26-27/0001', label: 'One unbroken series a year' },
  motif: 'voucher',
  status: 'published',
  title: 'Payment vouchers: what goes on one, and who should approve it',
  search: {
    title: 'Payment Voucher: Format, Fields and Approvals',
    description:
      'What a payment voucher is, the fields it needs, how to number vouchers, how GST is split, and why the person who raises a voucher should never approve it.',
  },
  tool: 'voucher-desk',
  updated: '2026-10-27',
  lead:
    'A payment voucher is the record that a payment was asked for, checked and authorised before the money went out. Done properly, it is also the first thing an auditor asks to see.',
  answer:
    'A payment voucher records who is being paid, how much, for what, and against which invoice, together with the account it is charged to, the tax on it and who approved it. Number vouchers in an unbroken series for each financial year, keep the invoice with the voucher, and make sure the person who raises a voucher is never the person who approves it.',
  blocks: [
    { t: 'h2', text: 'What a payment voucher is for' },
    {
      t: 'p',
      text: 'A voucher sits between an invoice and a payment. It says that somebody looked at the invoice, decided it should be paid, charged it to the right account, worked out the tax, and that somebody else with the authority to do so agreed. The bank statement says money left; the voucher says why, and who said it could.',
    },
    { t: 'h2', text: 'The fields a payment voucher needs' },
    {
      t: 'ul',
      items: [
        'Voucher number and date.',
        'Payee: the name, and for a business, its GSTIN and PAN.',
        'What the payment is for, in words someone else would understand a year later.',
        'The invoice it pays: invoice number, date and amount, with a copy attached.',
        'The account or cost centre it is charged to.',
        'The amount before tax, the GST on it, any TDS deducted, and the net amount payable.',
        'How it is paid: cheque number, or the bank reference of the transfer.',
        'Who prepared it and who approved it, with dates.',
      ],
    },
    { t: 'h2', text: 'Numbering vouchers' },
    {
      t: 'p',
      text: 'Number vouchers in one unbroken series for each financial year, with a prefix that says which year, for example 26-27/0001 onwards for April 2026 to March 2027. A gap in the series is the first thing a reviewer looks for, because it can mean a voucher was destroyed. If you keep separate series for different units or books, give each its own prefix so the numbers cannot collide.',
    },
    { t: 'h2', text: 'Getting the GST split right' },
    {
      t: 'p',
      text: 'Whether an invoice carries CGST and SGST or IGST depends on whether the supply is within one state or between two. A supply within a state carries CGST and SGST in equal halves; a supply between states carries IGST. An invoice never carries both. A voucher that records the wrong pair puts the credit in the wrong ledger, so the split is worth checking before the voucher is approved, not after.',
    },
    { t: 'h2', text: 'Who should approve a voucher' },
    {
      t: 'p',
      text: 'The rule that matters most is that the person who raises a voucher does not approve it. Splitting the two jobs between different people, often called maker and checker, means no single person can both create a payment and authorise it. It is the simplest control there is against error and against fraud, and the first one an auditor tests.',
    },
    {
      t: 'ul',
      items: [
        'Set limits: who may approve up to what amount, and what needs a second approval.',
        'Approve against the invoice, not against the voucher alone.',
        'Once a voucher is approved, do not edit it. Send it back and record that it was sent back, so the history shows what changed and who changed it.',
        'Keep every voucher, approved or rejected, with its supporting papers.',
      ],
    },
  ],
  sources: [
    {
      name: 'Integrated Goods and Services Tax Act, 2017, section 7: inter-State supply',
      publisher: 'Central Board of Indirect Taxes and Customs',
      url: 'https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_IGST_Act/active/chapteriv/section7_v1.00.html',
    },
  ],
  faq: [
    {
      q: 'What is the difference between a payment voucher and an invoice?',
      a: 'The invoice comes from the supplier and says what you owe. The payment voucher is your own record that the invoice was checked, charged to an account and approved for payment.',
    },
    {
      q: 'Can the same person prepare and approve a payment voucher?',
      a: 'They should not. Keeping the person who prepares a voucher separate from the person who approves it is the basic control against error and fraud in payments.',
    },
    {
      q: 'Should payment vouchers be numbered by financial year?',
      a: 'Yes. One unbroken series for each financial year, with the year in the prefix, makes a missing voucher easy to spot and keeps two years from sharing a number.',
    },
  ],
};

/*
 * The supplier example, checked by guides.test.ts: our balance plus the
 * additions less the deductions is the supplier's, and each side's balance
 * after its own corrections is the same figure.
 *
 *   Our ledger (we owe)                               1,98,400
 *   + invoice 1187, not yet in our books                38,000
 *   + our NEFT of 31 March, not yet on their statement  25,000
 *   + our debit note DN-09, not yet in their books       6,000
 *   − their credit note CN-42, not yet in our books      4,800
 *   = their statement                                 2,62,600
 *   Ours after booking 1187 and CN-42:   1,98,400 + 38,000 − 4,800  = 2,31,600
 *   Theirs after booking NEFT and DN-09: 2,62,600 − 25,000 − 6,000 = 2,31,600
 */
export const SUPPLIER_RECONCILIATION: Guide = {
  slug: 'supplier-statement-reconciliation',
  short: 'Supplier reconciliation',
  figure: { value: '₹2,31,600', label: 'The balance both sides agree on' },
  motif: 'scales',
  status: 'published',
  title: 'How to reconcile a supplier statement with your ledger',
  search: {
    title: 'Supplier Statement Reconciliation: How to Do It',
    description:
      'How to match a supplier’s statement of account to their ledger in your books, explain every difference and agree the balance, with a worked example.',
  },
  tool: 'ledger-reconciliation',
  updated: '2026-10-28',
  lead:
    'A supplier’s statement and your ledger for that supplier should show the same balance. When they do not, the difference is almost always a short list of entries one side has recorded and the other has not.',
  answer:
    'Take your ledger for the supplier and their statement of account to the same date. Tick off the invoices, payments, credit notes and debit notes that appear in both. List what is left on each side, start from your balance, add or take off each item, and you should arrive at theirs. Then each side records what it has missed, and both balances agree.',
  blocks: [
    { t: 'h2', text: 'Why the two balances differ' },
    {
      t: 'p',
      text: 'The supplier and you record the same dealings from opposite sides, on different days. Most differences are timing, a few are entries one side never received, and now and then one is a mistake.',
    },
    {
      t: 'ul',
      items: [
        'Invoices the supplier has raised that have not reached your books yet.',
        'Payments you have made that the supplier has not received or recorded yet.',
        'Credit notes the supplier has issued, for a discount or a rate difference, that you have not booked.',
        'Debit notes you have raised, for goods returned or short supplied, that the supplier has not accepted yet.',
        'Errors: an invoice booked twice, a wrong amount, or an entry posted to the wrong supplier.',
      ],
    },
    { t: 'h2', text: 'Step by step' },
    {
      t: 'ol',
      items: [
        'Ask the supplier for a statement of account to a date, usually the month end or the year end.',
        'Take your ledger for the same supplier to the same date.',
        'Match the entries that appear in both, by invoice number first, then by date and amount.',
        'List what is left on each side, and say for each one which side has it and why.',
        'Start from your balance, add and take off the items, and check that you arrive at the supplier’s balance.',
        'Record what you have missed, and send the supplier the items they have missed, so both sides end on the same figure.',
      ],
    },
    { t: 'h2', text: 'A worked example' },
    {
      t: 'p',
      text: 'On 31 March your ledger shows ₹1,98,400 owed to the supplier. Their statement for the same date says you owe ₹2,62,600. Matching the two leaves four items.',
    },
    {
      t: 'table',
      caption: 'Supplier reconciliation as at 31 March',
      head: ['', '₹', '₹'],
      rows: [
        ['Balance as per our ledger (we owe)', '', '1,98,400'],
        ['Add: their invoice 1187 of 29 March, not yet in our books', '38,000', ''],
        ['Add: our NEFT payment of 31 March, not yet on their statement', '25,000', ''],
        ['Add: our debit note DN-09 for goods returned, not yet in their books', '6,000', '69,000'],
        ['Less: their credit note CN-42 for a rate difference, not yet in our books', '4,800', '(4,800)'],
        ['Balance as per supplier statement', '', '2,62,600'],
      ],
    },
    {
      t: 'p',
      text: 'You book invoice 1187 and credit note CN-42, which takes your balance to ₹2,31,600. The supplier records your payment and the debit note, which takes theirs to the same ₹2,31,600. The two sides now agree, and the confirmation you send them can say so.',
    },
    { t: 'h2', text: 'Who corrects what' },
    {
      t: 'p',
      text: 'Each side records only what it has genuinely missed. An invoice you have received but not booked is yours to book. A payment the supplier has not yet credited is theirs to record, and the bank reference is what you send them. A difference neither side can explain is not written off; it is raised with the supplier until one of you finds the entry behind it.',
    },
    { t: 'h2', text: 'How often to do it' },
    {
      t: 'p',
      text: 'For the suppliers you pay most often, every month. For the rest, at least at the year end, when auditors often ask for balance confirmations. A difference found a month after it arose is a phone call; found a year later it is a search through a year of invoices.',
    },
  ],
  faq: [
    {
      q: 'What is a supplier statement of account?',
      a: 'A list the supplier sends of every invoice, payment, credit note and adjustment on your account with them, ending in the balance they say you owe.',
    },
    {
      q: 'Should I start from my balance or the supplier’s?',
      a: 'Either works. Starting from your own balance and arriving at theirs is the usual way, because the reconciliation then explains their figure in terms of your books.',
    },
    {
      q: 'What if a difference cannot be explained?',
      a: 'Do not write it off. Ask the supplier for the documents behind the entries you cannot match; most unexplained differences turn out to be an invoice or payment recorded against the wrong account.',
    },
    {
      q: 'Is this the same as a bank reconciliation?',
      a: 'The method is the same: match the entries, list what is left, and explain each item as timing, omission or error. Only the other party changes.',
    },
  ],
};

/*
 * The week of vouchers, checked by guides.test.ts:
 *
 *   Bank  1,00,000 − 25,000 (rent) + 59,000 (receipt) − 10,000 (to petty cash) = ₹1,24,000
 *   Cash      2,000 + 10,000 (from the bank) − 1,200 (courier)                  = ₹10,800
 *   Sale  1,00,000 + 18% GST 18,000                                              = ₹1,18,000
 */
export const VOUCHER_TYPES: Guide = {
  slug: 'types-of-vouchers-in-accounting',
  short: 'Types of vouchers',
  figure: { value: '₹1,24,000', label: 'The bank balance the week ends on' },
  motif: 'voucher',
  status: 'published',
  title: 'Types of vouchers in accounting: payment, receipt, contra and journal',
  search: {
    title: 'Types of Vouchers in Accounting, with Examples',
    description:
      'Payment, receipt, contra and journal vouchers, and the sales, purchase and note vouchers: what each records, with a week of entries sorted into the right one.',
  },
  tool: 'voucher-desk',
  updated: '2026-10-28',
  lead:
    'Every entry in the books should rest on a voucher. Which kind of voucher depends on one question: does money move, and if it does, where to?',
  answer:
    'A voucher is the document behind an entry in the books. A payment voucher records money leaving your cash or bank, a receipt voucher money coming in, a contra voucher money moving between your own cash and bank accounts, and a journal voucher an entry that touches neither, such as depreciation or a provision. Sales, purchase, credit note and debit note vouchers record trading on credit.',
  blocks: [
    { t: 'h2', text: 'What a voucher is for' },
    {
      t: 'p',
      text: 'A voucher is the evidence for an entry: what happened, for how much, which accounts it touches, and who agreed to it, with the bill, invoice or bank advice behind it attached. An auditor tests the books by picking entries and tracing each one back to its voucher, so an entry without one is an entry nobody can check.',
    },
    { t: 'h2', text: 'The four every business uses' },
    {
      t: 'ul',
      items: [
        'Payment voucher: money going out of cash or a bank account to somebody else, such as rent, a supplier or salaries. The bank or cash account is credited.',
        'Receipt voucher: money coming in to cash or a bank account from somebody else, such as a customer paying an invoice. The bank or cash account is debited.',
        'Contra voucher: money moving between your own cash and bank accounts, or between two of your bank accounts, such as a cash withdrawal or a deposit. Both sides are your own cash or bank.',
        'Journal voucher: an entry that involves no cash or bank at all, such as depreciation, a provision, a correction or a transfer between two ledger accounts.',
      ],
    },
    { t: 'h2', text: 'The trading vouchers' },
    {
      t: 'ul',
      items: [
        'Sales voucher: a sale, with the customer or cash debited and sales and the tax on them credited.',
        'Purchase voucher: a purchase, with the purchase and the input tax debited and the supplier or cash credited.',
        'Credit note and debit note: a change to an invoice already issued. A credit note reduces what the customer owes, for a return or an overcharge, and a debit note increases it. In GST both are issued by the supplier, though many businesses also raise a debit note to their supplier when they return goods.',
      ],
    },
    { t: 'h2', text: 'A worked example' },
    {
      t: 'p',
      text: 'A small business starts the week with ₹1,00,000 in the bank and ₹2,000 in petty cash. Six things happen.',
    },
    {
      t: 'table',
      caption: 'One week, each entry on its voucher',
      head: ['What happened', 'Voucher', 'Debit', 'Credit', '₹'],
      rows: [
        ['Office rent paid by NEFT', 'Payment', 'Rent', 'Bank', '25,000'],
        ['A customer pays an invoice by UPI', 'Receipt', 'Bank', 'Customer', '59,000'],
        ['Cash drawn from the bank for petty cash', 'Contra', 'Cash', 'Bank', '10,000'],
        ['A courier paid in cash', 'Payment', 'Courier', 'Cash', '1,200'],
        ['Depreciation on office furniture', 'Journal', 'Depreciation', 'Furniture', '4,500'],
        ['Goods sold on credit, with 18% GST', 'Sales', 'Customer', 'Sales and GST', '1,18,000'],
      ],
    },
    {
      t: 'p',
      text: 'Only the payment, receipt and contra vouchers move cash or the bank. The bank ends the week at ₹1,24,000: ₹1,00,000 less ₹25,000 of rent, plus ₹59,000 received, less ₹10,000 drawn for petty cash. Petty cash ends at ₹10,800. The depreciation and the credit sale change no balance of money at all, which is why they sit on a journal and a sales voucher.',
    },
    { t: 'h2', text: 'Numbering, and who approves' },
    {
      t: 'p',
      text: 'Give each type of voucher its own unbroken series of numbers for each financial year, so a gap in the series is noticed. For payment vouchers above all, the person who raises the voucher should never be the person who approves it.',
    },
  ],
  faq: [
    {
      q: 'What is the difference between a contra voucher and a payment voucher?',
      a: 'A contra voucher moves money between your own cash and bank accounts. A payment voucher sends money to somebody else.',
    },
    {
      q: 'Can a journal voucher record a cash payment?',
      a: 'No. Any entry that involves cash or a bank account goes on a payment, receipt or contra voucher. A journal voucher is for entries that touch neither.',
    },
    {
      q: 'Who should approve a payment voucher?',
      a: 'Somebody other than the person who raised it, with the authority to agree to the payment.',
    },
    {
      q: 'Does every entry need a voucher?',
      a: 'Yes. Every entry should trace back to a voucher and the document behind it, which is how the books are checked.',
    },
  ],
};
