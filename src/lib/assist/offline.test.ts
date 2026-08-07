import { describe, expect, it } from 'vitest';
import { chunk, runOffline } from './offline';
import { retrieve } from './retrieve';

/**
 * The sample answer.
 *
 * Small, but two things about it matter. It must reassemble to exactly what went
 * in, because a chunker that drops a space is a chunker that will be blamed for
 * the model's spacing. And it must say what it is in the first thing the reader
 * sees, because the whole risk of having a fake answer at all is somebody taking
 * one for a real one.
 */

async function collect(question: string) {
  const events = [];
  for await (const event of runOffline(question, retrieve(question))) events.push(event);
  return events;
}

const textOf = (events: { type: string; text?: string }[]) =>
  events.map((e) => e.text ?? '').join('');

describe('chunking', () => {
  it('puts the text back together exactly', () => {
    const text = 'The two balances tie out.  Nothing left to explain.\nA second line.';
    expect(chunk(text).join('')).toBe(text);
  });

  it('splits into more than one piece, so the stream is exercised', () => {
    expect(chunk('a b c d e f g h i j k l').length).toBeGreaterThan(1);
  });

  it('copes with an empty string', () => {
    expect(chunk('').join('')).toBe('');
  });
});

describe('the sample itself', () => {
  it('labels itself before a word of it arrives', async () => {
    // A sample answer that only admits to being one at the end has already been
    // read by the time it says so.
    const [first] = await collect('how does matching work');
    expect(first).toEqual({ type: 'note', note: 'offline' });
  });

  it('says what it is before anything else', async () => {
    const text = textOf(await collect('how does matching work'));
    expect(text.startsWith('**This is a sample answer. There is no model behind it.**')).toBe(true);
  });

  it('says how to get a real one', async () => {
    expect(textOf(await collect('how does matching work'))).toMatch(/OPENAI_API_KEY/);
  });

  it('reads back what retrieval found, so the retrieval can be judged', async () => {
    expect(textOf(await collect('how does matching work'))).toMatch(/### How the two ledgers/);
  });

  it('says so when nothing matched, rather than inventing something', async () => {
    const text = textOf(await collect('photosynthesis chlorophyll xylem'));
    expect(text).toMatch(/Nothing in the knowledge base matched/);
  });

  it('ends the stream the same way the real one does', async () => {
    const events = await collect('what is a BRS');
    expect(events[events.length - 1]).toEqual({ type: 'done' });
  });
});
