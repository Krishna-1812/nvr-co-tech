/**
 * What to put in an empty chat window.
 *
 * Not decoration. An empty box with a cursor in it is the hardest interface in
 * software to use, because the reader has to guess the range of what it can do
 * before they have any evidence, and the usual first guess is "everything",
 * which is wrong. Four questions is enough to draw the edges: this one knows the
 * product, this one knows the accounting, this one does arithmetic, and this one
 * is honest about what it cannot do.
 *
 * They are written per tool, because a question about matching passes means
 * nothing on the voucher dashboard.
 */

export type Suggestion = { label: string; question: string };

/**
 * The first is deliberately first. It is the one question every reader has, and
 * it is the one whose answer sets expectations honestly, so it is the shared
 * suggestion that survives when a tool has its own three.
 */
const SHARED: Suggestion[] = [
  {
    label: 'What can you do?',
    question: 'What can you help me with, and what can you not do?',
  },
  {
    label: 'Which tools are live?',
    question: 'Which tools on this platform are built and which are still on the roadmap?',
  },
  {
    label: 'Check a GSTIN',
    question: 'Is 29AAACI1195H1ZI a valid GSTIN, and what do the parts of it mean?',
  },
  {
    label: 'Where does my data go?',
    question: 'Where is my data kept, and does anything I upload leave my machine?',
  },
];

const BY_AGENT: Record<string, Suggestion[]> = {
  'voucher-desk': [
    {
      label: 'Who can approve?',
      question: 'Who is allowed to approve a voucher, and why can I not approve my own?',
    },
    {
      label: 'Work out a total',
      question:
        'A bill is ₹1,00,000 basic value with 18% GST inside Karnataka, TDS of ₹10,000 and an advance of ₹25,000 already paid. What is the grand total?',
    },
    {
      label: 'CGST or IGST?',
      question: 'How do I know whether to put CGST and SGST on a voucher, or IGST?',
    },
    {
      label: 'Voucher numbers',
      question: 'When does a voucher get its number, and what do the parts of it mean?',
    },
  ],
  'ledger-reconciliation': [
    {
      label: 'How matching works',
      question: 'How does it decide that two entries are the same entry?',
    },
    {
      label: 'Why is my statement inverted?',
      question:
        'Why does my bank statement show a deposit as a credit when it is a debit in my cash book?',
    },
    {
      label: 'Check a closing balance',
      question:
        'My ledger opens at ₹10,00,000 Dr, total debits are ₹2,50,000 and total credits ₹3,10,000. The printed closing balance says ₹9,40,000 Dr. Is that right?',
    },
    {
      label: 'What is left over',
      question: 'What are the different kinds of difference it reports, and what do I do about each?',
    },
  ],
};

/**
 * Always four, and always the same four for a given screen.
 *
 * Inside a tool it is three of that tool's own plus "what can you do", which is
 * the question worth keeping wherever somebody is. Everywhere else it is the
 * four general ones. Nothing is shuffled: a suggestion that moves between
 * visits is one somebody has to read again each time.
 */
export function suggestionsFor(agent: string | null): Suggestion[] {
  const own = (agent && BY_AGENT[agent]) || [];
  return own.length > 0 ? [...own.slice(0, 3), SHARED[0]] : SHARED.slice(0, 4);
}
