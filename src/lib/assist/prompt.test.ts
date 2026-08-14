import { describe, expect, it } from 'vitest';
import { AGENTS, LIVE_AGENTS } from '@/lib/marketing/content';
import { retrieve } from './retrieve';
import {
  contextBlock,
  instructions,
  latestQuestion,
  retrievalQuery,
  sourcesOf,
  trimHistory,
} from './prompt';

/**
 * The prompt.
 *
 * Asserting on the text of a prompt is usually a waste of a test, so what is
 * checked here is only the part that is load-bearing: the rules that keep the
 * assistant honest. If somebody edits the instructions and drops the sentence
 * that says not to invent features, or the one that says four of the tools do
 * not exist, that is a behaviour change and it should fail a test rather than
 * merely read slightly differently.
 */

const user = (content: string) => ({ role: 'user' as const, content });
const bot = (content: string) => ({ role: 'assistant' as const, content });

describe('the standing instructions', () => {
  const text = instructions({});

  it('tells it to ground claims in the context and to admit ignorance', () => {
    expect(text).toMatch(/Ground every claim about this platform in the CONTEXT/);
    expect(text).toMatch(/say plainly that you do not know/);
  });

  it('tells it how many tools are real, from the roster rather than from a literal', () => {
    // Two live today. When a third ships, this sentence changes on its own.
    expect(text).toContain(`${LIVE_AGENTS.length} of the ${AGENTS.length} tools are built`);
    expect(text).toMatch(/Never explain how to use a tool that is not live/);
  });

  it('forbids doing its own arithmetic', () => {
    expect(text).toMatch(/Never do arithmetic yourself/);
    expect(text).toMatch(/must come from a tool call/);
  });

  it('tells it that it does not know the date', () => {
    expect(text).toMatch(/You do not know the date/);
  });

  it('tells it that it cannot act and cannot see records', () => {
    expect(text).toMatch(/cannot do anything on the reader's behalf/);
    expect(text).toMatch(/no connection to their vouchers/);
  });

  it('tells it to decline anything that is not its subject', () => {
    // Left to itself it answers the question anyway and recommends a library,
    // which is helpful and is not what this is for.
    expect(text).toMatch(/Stay on your subject/);
    expect(text).toMatch(/Do not answer it anyway/);
  });

  it('tells it to be careful with statutory figures', () => {
    expect(text).toMatch(/Never invent a rate, a section or a deadline/);
    expect(text).toMatch(/not a substitute for professional advice/);
  });

  it('tells it to check its own answer against what it was actually given', () => {
    expect(text).toMatch(/check it against what you were actually given/);
  });

  it('carries the house style, since every answer is read by a customer', () => {
    expect(text).toMatch(/Short sentences and ordinary words. No em-dashes/);
    expect(text).toMatch(/₹1,00,000 rather than ₹100,000/);
  });

  it('only promises the markdown the renderer actually supports', () => {
    expect(text).toMatch(/## and ### headings/);
    expect(text).toMatch(/pipe tables/);
  });

  it('says which tool is on screen when there is one', () => {
    const inside = instructions({ agent: 'ledger-reconciliation' });
    expect(inside).toMatch(/looking at Ledger Reconciliation/);
    expect(inside).toMatch(/Take "this", "it" and "here" to mean that tool/);
  });

  it('says explicitly when there is not one, rather than leaving it open', () => {
    expect(text).toMatch(/not inside a particular tool/);
  });

  it('gives the first name only, and only when there is one', () => {
    expect(instructions({ name: 'Krishna' })).toMatch(/first name is Krishna/);
    expect(text).not.toMatch(/first name/);
  });
});

describe('the context block', () => {
  it('numbers and titles each document so they cannot be blended', () => {
    const hits = retrieve('how do approvals work');
    const block = contextBlock(hits);

    expect(block).toMatch(/--- Document 1: /);
    expect(block).toContain(hits[0].doc.body.split('\n')[0]);
  });

  it('names the tool a document belongs to', () => {
    const block = contextBlock(retrieve('how does matching work'));
    expect(block).toMatch(/\(Ledger Reconciliation\)/);
  });

  it('says what to do when nothing matched, rather than being empty', () => {
    // An empty context is an invitation to answer from general knowledge.
    expect(contextBlock([])).toMatch(/Say you do not know/);
  });
});

describe('sources', () => {
  it('carries the title, the tool and the link across', () => {
    const [first] = sourcesOf(retrieve('how do I run a reconciliation'));
    expect(first).toMatchObject({ agent: 'ledger-reconciliation' });
    expect(typeof first.title).toBe('string');
  });
});

describe('trimming the conversation', () => {
  it('leaves a short conversation alone', () => {
    const turns = [user('one'), bot('two'), user('three')];
    expect(trimHistory(turns)).toEqual(turns);
  });

  it('drops the oldest turns rather than the newest', () => {
    const turns = Array.from({ length: 30 }, (_, i) =>
      i % 2 === 0 ? user(`q${i}`) : bot(`a${i}`),
    );
    const kept = trimHistory(turns);

    expect(kept.length).toBeLessThan(turns.length);
    expect(kept[kept.length - 1]).toEqual(turns[turns.length - 1]);
  });

  it('drops turns when one of them is enormous', () => {
    // Somebody has pasted a ledger in. The turn count is fine and the size is not.
    const turns = [user('x'.repeat(30_000)), bot('ok'), user('and now?')];
    const kept = trimHistory(turns);

    expect(kept.length).toBeLessThan(3);
    expect(kept[kept.length - 1].content).toBe('and now?');
  });

  it('never opens on an assistant turn', () => {
    // Without its question in front of it, it reads as something the model said
    // unprompted, and the model continues it instead of answering.
    const turns = Array.from({ length: 30 }, (_, i) =>
      i % 2 === 1 ? user(`q${i}`) : bot(`a${i}`),
    );
    expect(trimHistory(turns)[0].role).toBe('user');
  });

  it('keeps the one turn there is, whatever it is', () => {
    expect(trimHistory([user('only')])).toHaveLength(1);
  });
});

describe('what retrieval runs on', () => {
  it('is the question, when the question stands on its own', () => {
    const long =
      'how does the reconciliation decide that two entries in different books are the same entry';
    expect(retrievalQuery([user('something else'), bot('x'), user(long)])).toBe(long);
  });

  it('borrows the previous question when this one cannot stand up', () => {
    // "What about inter-state?" has nothing retrievable in it at all.
    const query = retrievalQuery([
      user('how does GST split on a voucher'),
      bot('...'),
      user('what about inter-state?'),
    ]);

    expect(query).toContain('GST split');
    expect(query).toContain('inter-state');
  });

  it('finds the right document for a follow-up, which is the point of it', () => {
    const follow = [user('how does GST work on a voucher'), bot('...'), user('and IGST?')];
    expect(retrieve(retrievalQuery(follow)).map((h) => h.doc.id)).toContain('voucher-gst');
  });

  it('is empty when nothing has been asked', () => {
    expect(retrievalQuery([])).toBe('');
    expect(latestQuestion([])).toBe('');
  });

  it('takes the last question, not the last turn', () => {
    expect(latestQuestion([user('first'), bot('answer'), user('second')])).toBe('second');
  });
});
