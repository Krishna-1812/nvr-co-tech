import { describe, expect, it } from 'vitest';
import { retrieve, retrieveWithContext, tokenise } from './retrieve';

/**
 * Retrieval, tested as a question-answering problem rather than as a scorer.
 *
 * The assertions are all of the form "this question must reach that document",
 * because that is the only property that matters: the assistant may only make
 * claims about this platform from what it is given, so a question that retrieves
 * the wrong documents cannot produce a right answer no matter how good the model
 * is. A relevance score is not worth asserting about on its own.
 *
 * Most of them allow the document anywhere in the results rather than first.
 * Where a question has one obviously correct document, that is asserted
 * strictly, and those are the ones worth keeping an eye on.
 */

const ids = (query: string, agent: string | null = null) =>
  retrieve(query, { agent }).map((hit) => hit.doc.id);

describe('turning text into terms', () => {
  it('drops words that mean nothing anywhere', () => {
    expect(tokenise('what is the of and')).toEqual([]);
  });

  it('folds a plural onto its singular', () => {
    expect(tokenise('approvals')).toEqual(tokenise('approval'));
    expect(tokenise('vouchers')).toEqual(tokenise('voucher'));
  });

  it('folds the two verb endings that cost matches here', () => {
    expect(tokenise('matching')).toEqual(tokenise('match'));
    expect(tokenise('matched')).toEqual(tokenise('match'));
  });

  it('leaves short words alone rather than eating them', () => {
    // "less" must not become "les", and "paid" must not become "pa".
    expect(tokenise('less')).toEqual(['less']);
    expect(tokenise('paid')).toEqual(['paid']);
  });

  it('keeps a section number as one word, and does not stem it', () => {
    expect(tokenise('194J')).toEqual(['194j']);
    expect(tokenise('26Q and 2B')).toEqual(['26q', '2b']);
  });

  it('splits on punctuation, so a hyphenated form becomes its parts', () => {
    expect(tokenise('GSTR-2B')).toEqual(['gstr', '2b']);
  });
});

describe('finding the right documents', () => {
  it('finds the workflow for a question about approving', () => {
    expect(ids('how do approvals work')).toContain('voucher-workflow');
  });

  it('finds the workflow for the question people actually ask', () => {
    expect(ids('why can I not approve my own voucher')).toContain('voucher-workflow');
  });

  it('finds the amount ladder for a question about totals', () => {
    expect(ids('how is the grand total worked out')).toContain('voucher-amounts');
  });

  it('finds the numbering document', () => {
    expect(ids('when does a voucher get its number')).toContain('voucher-numbers');
  });

  it('finds the matching passes', () => {
    expect(ids('how does it decide two entries are the same')).toContain('recon-matching');
  });

  it('finds the contra document from the symptom rather than the word', () => {
    // Nobody types "contra". They type what they are looking at.
    expect(ids('my bank statement shows a deposit as a credit')).toContain('recon-contra');
  });

  it('finds the differences document', () => {
    expect(ids('what do I do about a timing difference')).toContain('recon-differences');
  });

  it('finds the file formats document', () => {
    expect(ids('can it read a scanned PDF')).toContain('recon-files');
  });

  it('answers an acronym, which is what the keyword lists are for', () => {
    // Every document spells it out; nobody asking about it does.
    expect(ids('what is a BRS')).toContain('finance-brs');
  });

  it('finds the TDS document from a section number', () => {
    expect(ids('what rate applies under 194J')).toContain('finance-tds');
  });

  it('finds the GST document from the three tax names', () => {
    expect(ids('CGST SGST or IGST')).toContain('finance-gst');
  });

  it('finds the roles document', () => {
    expect(ids('who is allowed to change somebody else role')).toContain('platform-roles');
  });

  it('finds what it can and cannot do when asked about itself', () => {
    expect(ids('can you approve this voucher for me')).toContain('assistant-limits');
  });

  it('finds the privacy document when asked where files go', () => {
    expect(ids('is my bank statement uploaded anywhere')).toContain('platform-privacy');
  });

  it('finds a roadmap tool by name, so its status can be given', () => {
    expect(ids('tell me about GST Reconciliation')).toContain('agent-gst-reconciliation');
  });
});

describe('what it does not do', () => {
  it('returns nothing for a question with no words in it', () => {
    expect(retrieve('the and of')).toEqual([]);
    expect(retrieve('')).toEqual([]);
  });

  it('returns nothing rather than the least bad thing', () => {
    // A wrong document is worse than none: it invites an answer built from it.
    expect(retrieve('photosynthesis chlorophyll xylem')).toEqual([]);
  });

  it('keeps the list short enough to send', () => {
    expect(retrieve('voucher gst tds reconciliation approval ledger balance').length).toBeLessThanOrEqual(6);
  });

  it('gives the same answer twice', () => {
    expect(ids('how does matching work')).toEqual(ids('how does matching work'));
  });
});

describe('the tool on screen', () => {
  it('prefers that tool when a question could mean either', () => {
    // "How do I start" is the same question in both tools and has to be answered
    // about the one being looked at.
    expect(ids('how do I start', 'ledger-reconciliation')[0]).toBe('recon-how');
  });

  it('does not drag a tool in where the question is about something else', () => {
    // Sitting inside a reconciliation and asking about GST wants the GST answer.
    const found = ids('what is the difference between CGST and IGST', 'ledger-reconciliation');
    expect(found).toContain('finance-gst');
  });

  it('always includes the tool on screen, even when nothing matched it', () => {
    const found = retrieveWithContext('what can you do', { agent: 'ledger-reconciliation' });
    expect(found.map((h) => h.doc.agent)).toContain('ledger-reconciliation');
  });

  it('does not add it twice when the question already found it', () => {
    const found = retrieveWithContext('how does matching work', {
      agent: 'ledger-reconciliation',
    });
    expect(new Set(found.map((h) => h.doc.id)).size).toBe(found.length);
  });

  it('changes nothing when no tool is on screen', () => {
    const query = 'how does matching work';
    expect(retrieveWithContext(query, { agent: null }).map((h) => h.doc.id)).toEqual(ids(query));
  });
});
