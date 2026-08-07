import { describe, expect, it } from 'vitest';
import { createSseParser, parsePayloads } from './sse';

/**
 * The parser, fed the way a network feeds it.
 *
 * Nearly every test here splits its input somewhere awkward on purpose. That is
 * the whole point: an SSE parser that is only ever given whole events works
 * perfectly on localhost and truncates answers over a real connection, and no
 * amount of using the feature will find it.
 */

/** Push a string one character at a time, which is the worst case. */
function drip(text: string): string[] {
  const parser = createSseParser();
  const out: string[] = [];
  for (const ch of text) out.push(...parser.push(ch));
  out.push(...parser.flush());
  return out;
}

describe('reading server-sent events', () => {
  it('reads one event', () => {
    const parser = createSseParser();
    expect(parser.push('data: {"a":1}\n\n')).toEqual(['{"a":1}']);
  });

  it('reads the same event however it is chopped up', () => {
    const stream = 'data: {"type":"delta","text":"hello"}\n\ndata: {"type":"done"}\n\n';
    const whole = createSseParser();

    expect(whole.push(stream)).toEqual([
      '{"type":"delta","text":"hello"}',
      '{"type":"done"}',
    ]);
    expect(drip(stream)).toEqual(['{"type":"delta","text":"hello"}', '{"type":"done"}']);
  });

  it('holds on to a chunk that ends mid-object', () => {
    const parser = createSseParser();

    // The break falls inside the JSON, which is where a real one usually falls.
    expect(parser.push('data: {"text":"half')).toEqual([]);
    expect(parser.push(' and half"}\n\n')).toEqual(['{"text":"half and half"}']);
  });

  it('holds on to a chunk that ends mid-line-ending', () => {
    const parser = createSseParser();
    expect(parser.push('data: {"a":1}\n')).toEqual([]);
    expect(parser.push('\n')).toEqual(['{"a":1}']);
  });

  it('ignores the event name, which the payload already carries', () => {
    const parser = createSseParser();
    expect(parser.push('event: response.output_text.delta\ndata: {"a":1}\n\n')).toEqual([
      '{"a":1}',
    ]);
  });

  it('ignores comments, which is what a keep-alive is', () => {
    const parser = createSseParser();
    expect(parser.push(': ping\n\ndata: {"a":1}\n\n')).toEqual(['{"a":1}']);
  });

  it('joins several data lines with a newline, as the format says', () => {
    const parser = createSseParser();
    expect(parser.push('data: one\ndata: two\n\n')).toEqual(['one\ntwo']);
  });

  it('takes one space after the colon and no more', () => {
    const parser = createSseParser();
    // The first space is part of the format. The second is part of the value.
    expect(parser.push('data:  padded\n\n')).toEqual([' padded']);
  });

  it('copes with CRLF, which some proxies rewrite to', () => {
    const parser = createSseParser();
    expect(parser.push('data: {"a":1}\r\n\r\n')).toEqual(['{"a":1}']);
  });

  it('drops the [DONE] sentinel rather than trying to parse it', () => {
    const parser = createSseParser();
    expect(parser.push('data: {"a":1}\n\ndata: [DONE]\n\n')).toEqual(['{"a":1}']);
  });

  it('does not lose the last event when the stream ends without a blank line', () => {
    const parser = createSseParser();
    expect(parser.push('data: {"a":1}')).toEqual([]);
    expect(parser.flush()).toEqual(['{"a":1}']);
  });

  it('has nothing left after a clean end', () => {
    const parser = createSseParser();
    parser.push('data: {"a":1}\n\n');
    expect(parser.flush()).toEqual([]);
  });
});

describe('parsing payloads', () => {
  it('parses what it can', () => {
    expect(parsePayloads(['{"a":1}', '{"b":2}'])).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('drops a malformed frame instead of throwing away the answer', () => {
    // One bad frame out of hundreds must not lose everything written so far.
    expect(parsePayloads(['{"a":1}', 'not json', '{"b":2}'])).toEqual([{ a: 1 }, { b: 2 }]);
  });
});
