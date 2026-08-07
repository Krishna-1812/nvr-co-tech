import { describe, expect, it } from 'vitest';
import { linkHref, parseInline, parseMarkdown, type Block } from './markdown';

/**
 * The markdown parser.
 *
 * Two jobs, and the second is the one that would be embarrassing to get wrong.
 *
 * The first is rendering an answer properly. The second is that this runs on
 * half-finished text hundreds of times per answer, because it is called on every
 * frame while the reply is still streaming. So most of the block tests here have
 * a truncated companion: a table with no rows yet, an unterminated code fence, a
 * list whose last item stops mid-word. All of them have to produce something
 * rather than throwing or hanging.
 */

const types = (source: string) => parseMarkdown(source).map((b) => b.type);

/** The text of a block, ignoring how it was marked up. */
function flatten(block: Block): string {
  switch (block.type) {
    case 'heading':
    case 'para':
    case 'quote':
      return block.text.map((r) => r.text).join('');
    case 'code':
      return block.text;
    case 'list':
      return block.items.map((item) => item.map((r) => r.text).join('')).join(' | ');
    case 'table':
      return [block.head, ...block.rows]
        .map((row) => row.map((cell) => cell.map((r) => r.text).join('')).join(','))
        .join(' | ');
    case 'rule':
      return '';
  }
}

describe('inline runs', () => {
  it('reads bold', () => {
    expect(parseInline('a **b** c')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', text: 'b' },
      { type: 'text', text: ' c' },
    ]);
  });

  it('reads code', () => {
    expect(parseInline('run `npm test`')).toEqual([
      { type: 'text', text: 'run ' },
      { type: 'code', text: 'npm test' },
    ]);
  });

  it('reads italic without mistaking bold for it', () => {
    // The alternation has to try bold first, or **x** matches the italic branch
    // and everything after it falls apart.
    expect(parseInline('**bold** and *thin*')).toEqual([
      { type: 'bold', text: 'bold' },
      { type: 'text', text: ' and ' },
      { type: 'italic', text: 'thin' },
    ]);
  });

  it('leaves a lone asterisk alone', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ type: 'text', text: '2 * 3 = 6' }]);
  });

  it('leaves an unclosed marker as text', () => {
    // Which is what half-streamed bold looks like on every frame until it closes.
    expect(parseInline('**half')).toEqual([{ type: 'text', text: '**half' }]);
  });

  it('keeps a rupee figure intact', () => {
    expect(parseInline('₹1,00,000.00')).toEqual([{ type: 'text', text: '₹1,00,000.00' }]);
  });
});

describe('which links become links', () => {
  it('takes a path inside this app', () => {
    expect(linkHref('/reconcile')).toBe('/reconcile');
    expect(linkHref('/vouchers?status=draft')).toBe('/vouchers?status=draft');
  });

  it('refuses anything that leaves this app', () => {
    expect(linkHref('https://example.com')).toBeNull();
    expect(linkHref('http://example.com')).toBeNull();
    expect(linkHref('example.com')).toBeNull();
  });

  it('refuses the two schemes that make an anchor dangerous', () => {
    expect(linkHref('javascript:alert(1)')).toBeNull();
    expect(linkHref('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('refuses a protocol-relative URL, which looks like a path and is not', () => {
    // //evil.example passes a naive "starts with a slash" test and goes offsite.
    expect(linkHref('//evil.example')).toBeNull();
  });

  it('keeps the words of a link it will not follow', () => {
    expect(parseInline('[the docs](https://example.com)')).toEqual([
      { type: 'text', text: 'the docs' },
    ]);
  });

  it('makes a link of an internal one', () => {
    expect(parseInline('[Reconcile](/reconcile)')).toEqual([
      { type: 'link', text: 'Reconcile', href: '/reconcile' },
    ]);
  });
});

describe('blocks', () => {
  it('reads paragraphs, joining the lines of each', () => {
    const blocks = parseMarkdown('one\ntwo\n\nthree');
    expect(types('one\ntwo\n\nthree')).toEqual(['para', 'para']);
    expect(flatten(blocks[0])).toBe('one two');
  });

  it('reads the two heading levels it supports', () => {
    const blocks = parseMarkdown('## Two\n\n### Three');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 2 });
    expect(blocks[1]).toMatchObject({ type: 'heading', level: 3 });
  });

  it('ignores a single hash, which is a heading bigger than this needs', () => {
    expect(types('# One')).toEqual(['para']);
  });

  it('reads a bulleted list', () => {
    const blocks = parseMarkdown('- one\n- two\n- three');
    expect(blocks[0]).toMatchObject({ type: 'list', ordered: false });
    expect(flatten(blocks[0])).toBe('one | two | three');
  });

  it('reads a numbered list', () => {
    const blocks = parseMarkdown('1. one\n2. two');
    expect(blocks[0]).toMatchObject({ type: 'list', ordered: true });
  });

  it('splits a numbered list from a bulleted one', () => {
    expect(types('- one\n1. two')).toEqual(['list', 'list']);
  });

  it('joins a wrapped list item back together', () => {
    const blocks = parseMarkdown('- a long item that\n  wrapped onto a second line\n- another');
    expect(flatten(blocks[0])).toBe('a long item that wrapped onto a second line | another');
  });

  it('reads a quote', () => {
    expect(flatten(parseMarkdown('> mind the gap')[0])).toBe('mind the gap');
  });

  it('reads a fenced code block', () => {
    expect(flatten(parseMarkdown('```\nclosing = opening + dr - cr\n```')[0])).toBe(
      'closing = opening + dr - cr',
    );
  });

  it('reads a rule', () => {
    expect(types('a\n\n---\n\nb')).toEqual(['para', 'rule', 'para']);
  });

  it('reads a table', () => {
    const blocks = parseMarkdown('| Tax | Amount |\n| --- | --- |\n| CGST | 9,000 |\n| SGST | 9,000 |');
    expect(blocks[0]).toMatchObject({ type: 'table' });
    expect(flatten(blocks[0])).toBe('Tax,Amount | CGST,9,000 | SGST,9,000');
  });

  it('reads a table written without outer pipes', () => {
    expect(types('Tax | Amount\n--- | ---\nCGST | 9,000')).toEqual(['table']);
  });

  it('does not turn a sentence containing a pipe into a table', () => {
    // The divider line is what makes a table, not the pipes.
    expect(types('either a debit | or a credit')).toEqual(['para']);
  });

  it('keeps markup inside a table cell', () => {
    const blocks = parseMarkdown('| a | b |\n| --- | --- |\n| **9,000** | `x` |');
    expect(blocks[0]).toMatchObject({
      type: 'table',
      rows: [[[{ type: 'bold', text: '9,000' }], [{ type: 'code', text: 'x' }]]],
    });
  });
});

describe('text that is still arriving', () => {
  it('produces something for every prefix of an answer, and never hangs', () => {
    const answer = [
      '## The split',
      '',
      'For an intra-state supply the tax **halves**.',
      '',
      '| Head | Amount |',
      '| --- | --- |',
      '| CGST | 9,000 |',
      '| SGST | 9,000 |',
      '',
      '1. Work out the total',
      '2. Halve it',
      '',
      '> Check the place of supply.',
      '',
      '```',
      'total = value * rate / 100',
      '```',
    ].join('\n');

    // Every truncation point, which is what the renderer actually sees.
    for (let i = 0; i <= answer.length; i++) {
      expect(() => parseMarkdown(answer.slice(0, i))).not.toThrow();
    }

    expect(types(answer)).toEqual(['heading', 'para', 'table', 'list', 'quote', 'code']);
  });

  it('gives a table with no rows yet', () => {
    const blocks = parseMarkdown('| Head | Amount |\n| --- | --- |\n');
    expect(blocks[0]).toMatchObject({ type: 'table', rows: [] });
  });

  it('gives a code block for a fence that has not closed', () => {
    expect(flatten(parseMarkdown('```\nhalf a line')[0])).toBe('half a line');
  });

  it('handles an empty answer', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('\n\n  \n')).toEqual([]);
  });

  it('takes CRLF, since the text may have come from anywhere', () => {
    expect(types('one\r\n\r\ntwo')).toEqual(['para', 'para']);
  });
});

describe('markup is never interpreted', () => {
  it('leaves a script tag as text, because nothing here is ever HTML', () => {
    // This is the whole reason the parser exists rather than a markdown-to-HTML
    // library and dangerouslySetInnerHTML.
    const blocks = parseMarkdown('<script>alert(1)</script>');
    expect(blocks[0].type).toBe('para');
    expect(flatten(blocks[0])).toBe('<script>alert(1)</script>');
  });

  it('leaves an img tag as text', () => {
    expect(flatten(parseMarkdown('<img src=x onerror=alert(1)>')[0])).toBe(
      '<img src=x onerror=alert(1)>',
    );
  });
});
