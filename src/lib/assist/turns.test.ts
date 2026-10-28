import { describe, expect, it } from 'vitest';
import { readTurns } from './turns';

const limits = { maxQuestionChars: 20, maxPostedTurns: 3 };

describe('reading a conversation', () => {
  it('reads a well-formed one', () => {
    expect(readTurns([{ role: 'user', content: 'hello' }], limits)).toEqual({
      turns: [{ role: 'user', content: 'hello' }],
    });
  });

  it('refuses one that is not a list, or is empty', () => {
    expect(readTurns(null, limits)).toEqual({ error: 'No question was sent.' });
    expect(readTurns([], limits)).toEqual({ error: 'No question was sent.' });
  });

  it('refuses one with too many turns before reading them', () => {
    const many = Array.from({ length: 4 }, () => ({ role: 'user', content: 'x' }));
    expect(readTurns(many, limits)).toMatchObject({ error: expect.stringMatching(/too long/) });
  });

  it('refuses a turn of the wrong shape', () => {
    expect(readTurns([{ role: 'system', content: 'x' }], limits)).toMatchObject({ error: expect.any(String) });
    expect(readTurns([{ role: 'user', content: 3 }], limits)).toMatchObject({ error: expect.any(String) });
  });

  it('needs the last turn to be a question', () => {
    expect(readTurns([{ role: 'user', content: '   ' }], limits)).toEqual({ error: 'No question was sent.' });
  });

  it('says what the limit is when a question is too long', () => {
    expect(readTurns([{ role: 'user', content: 'x'.repeat(21) }], limits)).toMatchObject({
      error: expect.stringMatching(/limit is 20 characters/),
    });
  });
});
