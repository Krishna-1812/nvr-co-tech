import { describe, expect, it } from 'vitest';
import { chatPayload, mayRecord, readChatMeta, tally } from './chat';

const headers = (h: Record<string, string> = {}) => new Headers({ 'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/130', ...h });

describe('what the browser says about a question', () => {
  it('keeps a well-formed chat id, session, page and source', () => {
    expect(readChatMeta({ conversation: 'cabc123', sid: 's-1', via: 'greeting-pick', path: '/tools/voucher-desk' })).toEqual({
      conversation: 'cabc123',
      sid: 's-1',
      via: 'greeting-pick',
      path: '/tools/voucher-desk',
    });
  });

  it('drops anything not shaped like it, and falls back to the page the chat was sent', () => {
    expect(readChatMeta({ conversation: 'x; drop table', via: 'hacker' }, '/guides')).toEqual({
      conversation: null,
      sid: null,
      via: null,
      path: '/guides',
    });
    expect(readChatMeta(null)).toEqual({ conversation: null, sid: null, via: null, path: null });
  });
});

describe('what is never recorded', () => {
  it('a crawler, a browser asking not to be tracked, and anything asked on a will', () => {
    expect(mayRecord(headers(), '/')).toBe(true);
    expect(mayRecord(headers({ 'user-agent': 'Googlebot/2.1' }), '/')).toBe(false);
    expect(mayRecord(headers({ dnt: '1' }), '/')).toBe(false);
    expect(mayRecord(headers({ 'sec-gpc': '1' }), '/')).toBe(false);
    expect(mayRecord(headers(), '/will-maker/start')).toBe(false);
  });
});

describe('an answer, watched as it goes by', () => {
  it('keeps the words, the pages, the sums and the time to the first word', () => {
    const t = tally(1000);
    t.see({ type: 'sources', sources: [{ id: 'g1', title: 'Rental yield', agent: null, href: '/guides/rental-yield' }] }, 1100);
    t.see({ type: 'delta', text: '' }, 1200);
    t.see({ type: 'delta', text: 'Gross yield is ' }, 1500);
    t.see({ type: 'tool', trace: { name: 'yield', label: 'Rental yield', args: { rent: 30000 }, summary: '3.6%', ok: true } }, 1600);
    t.see({ type: 'delta', text: '3.6%.' }, 1700);
    t.see({ type: 'done' }, 1800);
    expect(t.result(false, 2000)).toEqual({
      answer: 'Gross yield is 3.6%.',
      sources: [{ id: 'g1', title: 'Rental yield', href: '/guides/rental-yield' }],
      tools: [{ label: 'Rental yield', summary: '3.6%', ok: true, args: { rent: 30000 } }],
      outcome: 'answered',
      error: null,
      first_ms: 500,
      total_ms: 1000,
    });
  });

  it('says how it ended: stopped by the reader, failed, or a sample', () => {
    const stopped = tally(0);
    stopped.see({ type: 'delta', text: 'Half an' }, 10);
    expect(stopped.result(true, 20).outcome).toBe('stopped');

    const failed = tally(0);
    failed.see({ type: 'error', message: 'The model stopped.', note: 'error' });
    expect(failed.result(false)).toMatchObject({ outcome: 'error', error: 'The model stopped.' });

    const sample = tally(0);
    sample.see({ type: 'note', note: 'offline' });
    sample.see({ type: 'done' });
    expect(sample.result(false).outcome).toBe('offline');

    // Finished before the reader left: it was answered, not stopped.
    const finished = tally(0);
    finished.see({ type: 'done' });
    expect(finished.result(true).outcome).toBe('answered');
  });
});

describe('the row', () => {
  it('carries the chat, visit, page and source with the question and answer', () => {
    const row = chatPayload({
      id: '00000000-0000-4000-8000-000000000001',
      vid: '11111111-1111-4111-8111-111111111111',
      mode: 'visitor',
      meta: { conversation: 'c1', sid: 's1', via: 'typed', path: '/' },
      question: 'What is loading?',
      model: 'm',
      answer: 'The share of common areas.',
      outcome: 'answered',
    });
    expect(row).toMatchObject({ conversation: 'c1', sid: 's1', via: 'typed', path: '/', question: 'What is loading?', answer: 'The share of common areas.' });
    expect(chatPayload({ id: 'x', vid: null, mode: 'member', meta: readChatMeta(null), question: 'q', model: null, outcome: 'limited' }).answer).toBeNull();
  });
});
