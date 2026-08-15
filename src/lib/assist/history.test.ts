import { describe, expect, it } from 'vitest';
import {
  MAX_TITLE_CHARS,
  UNTITLED,
  titleFor,
  turnsFromRows,
  whenLabel,
  type StoredTurn,
} from './history';

/**
 * Saved conversations, on the way in and on the way out.
 *
 * Both halves are worth testing for the same reason. A title is the only thing
 * somebody has to go on when they are looking for a conversation they had last
 * week, and a turn read back out of jsonb is the only version of an answer that
 * still exists. Getting either subtly wrong is not a crash; it is a history
 * that quietly is not what was said.
 */

describe('what a conversation is called', () => {
  it('is the question, when the question is short', () => {
    expect(titleFor('What is the TDS on a contractor bill?')).toBe(
      'What is the TDS on a contractor bill?',
    );
  });

  it('collapses the whitespace of a pasted question', () => {
    expect(titleFor('  How   do\nI\tsubmit  a voucher? ')).toBe('How do I submit a voucher?');
  });

  it('drops the markdown a paste brings with it', () => {
    expect(titleFor('> what is the GST split on 1,00,000')).toBe(
      'what is the GST split on 1,00,000',
    );
    expect(titleFor('- **who** approves this')).toBe('who approves this');
  });

  it('cuts a long question at a word, not mid-word', () => {
    const title = titleFor(
      'Explain how the two step approval workflow decides who is allowed to approve a voucher',
    );
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE_CHARS + 1);
    expect(title.endsWith('…')).toBe(true);
    // The cut landed on a boundary, so the character before the ellipsis is the
    // end of a word rather than the middle of one.
    expect(title).not.toMatch(/\s…$/);
    expect(title).toBe('Explain how the two step approval workflow decides who is allowed to…');
  });

  it('still cuts a long question with no spaces in it', () => {
    const title = titleFor('a'.repeat(200));
    expect(title).toBe(`${'a'.repeat(MAX_TITLE_CHARS)}…`);
  });

  it('has something to say about a question with no words', () => {
    expect(titleFor('   ')).toBe(UNTITLED);
    expect(titleFor('***')).toBe(UNTITLED);
  });
});

describe('when it was', () => {
  // A fixed instant, so the assertions below are about the function rather
  // than about what time it happens to be when the suite runs.
  const now = new Date('2026-08-15T12:00:00Z').getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;

  it('counts minutes and hours for the first day', () => {
    expect(whenLabel(ago(20_000), now)).toBe('just now');
    expect(whenLabel(ago(9 * MINUTE), now)).toBe('9 min ago');
    expect(whenLabel(ago(HOUR), now)).toBe('1 hour ago');
    expect(whenLabel(ago(5 * HOUR), now)).toBe('5 hours ago');
  });

  it('says yesterday rather than 30 hours ago', () => {
    expect(whenLabel(ago(30 * HOUR), now)).toBe('yesterday');
  });

  it('gives a date once it is older than that, with the year only when it differs', () => {
    expect(whenLabel(ago(10 * 24 * HOUR), now)).toBe('5 Aug');
    expect(whenLabel('2025-03-02T08:00:00Z', now)).toBe('2 Mar 2025');
  });

  it('says nothing at all rather than "Invalid Date"', () => {
    expect(whenLabel('not a date', now)).toBe('');
  });
});

describe('reading turns back', () => {
  const row = (over: Partial<StoredTurn>): StoredTurn => ({
    id: 1,
    role: 'user',
    content: 'hello',
    sources: null,
    tools: null,
    note: null,
    ...over,
  });

  it('keeps the order it was given and gives each turn a stable id', () => {
    const turns = turnsFromRows([
      row({ id: 4, role: 'user', content: 'a question' }),
      row({ id: 5, role: 'assistant', content: 'an answer' }),
    ]);

    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant']);
    expect(turns.map((t) => t.id)).toEqual(['s4', 's5']);
    expect(new Set(turns.map((t) => t.id)).size).toBe(2);
  });

  it('brings the chips and the calculations back with the answer', () => {
    const [turn] = turnsFromRows([
      row({
        role: 'assistant',
        sources: [{ id: 'gst-basics', title: 'GST basics', agent: null }],
        tools: [{ name: 'gst_split', label: 'GST split', args: {}, summary: '₹18,000', ok: true }],
      }),
    ]);

    expect(turn.sources).toHaveLength(1);
    expect(turn.sources?.[0].title).toBe('GST basics');
    expect(turn.tools?.[0].summary).toBe('₹18,000');
  });

  it('keeps a sample answer labelled as one', () => {
    expect(turnsFromRows([row({ role: 'assistant', note: 'offline' })])[0].note).toBe('offline');
    expect(turnsFromRows([row({ role: 'assistant' })])[0].note).toBeUndefined();
  });

  it('drops a turn whose role it does not recognise', () => {
    expect(turnsFromRows([row({ role: 'system' }), row({ id: 2, role: 'user' })])).toHaveLength(1);
  });

  it('survives jsonb that is not the shape it should be', () => {
    const [turn] = turnsFromRows([
      row({ role: 'assistant', sources: 'not an array', tools: [{ nope: true }, null] }),
    ]);

    expect(turn.sources).toBeUndefined();
    expect(turn.tools).toBeUndefined();
  });
});
