/**
 * Markdown, parsed rather than injected.
 *
 * The model writes markdown and the page has to render it. The ordinary way to
 * do that is a library that produces an HTML string, and then
 * `dangerouslySetInnerHTML`. That is the one thing this must not do. The text
 * being rendered was written by a language model, and part of it came from
 * whatever the reader pasted into the box, so treating it as markup means any
 * question containing a script tag is a question that runs.
 *
 * So this produces a tree of plain objects, the component renders it as React
 * elements, and there is no path from a model's output to the HTML parser at
 * all. Nothing is escaped, because nothing is ever interpreted.
 *
 * The subset is what the prompt promises the model it can use, and no more:
 * headings, paragraphs, bullet and numbered lists, quotes, fenced code, pipe
 * tables, and a horizontal rule. Inline: bold, italic, code and links.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  /** Only ever a path inside this app. See `linkHref`. */
  | { type: 'link'; text: string; href: string };

export type Block =
  | { type: 'heading'; level: 2 | 3; text: Inline[] }
  | { type: 'para'; text: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; text: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { type: 'rule' };

/**
 * Which links become links.
 *
 * Only a path inside this application. An answer suggesting the reader open
 * something on another site is rendered as words, not as something clickable,
 * and the two reasons are worth stating: a model can invent a plausible URL that
 * belongs to somebody else entirely, and javascript: and data: are links as far
 * as an anchor is concerned. Restricting to a leading single slash rules out
 * both, and rules out protocol-relative //evil.example as well.
 */
export function linkHref(raw: string): string | null {
  const href = raw.trim();
  return /^\/(?!\/)[\w\-./?%&=#:+~]*$/.test(href) ? href : null;
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/;

/**
 * Split one line into runs.
 *
 * A single regex with alternation and a capturing group, so `split` returns the
 * matches interleaved with the text between them. Order in the alternation
 * matters: `**bold**` has to be tried before `*italic*`, or the italic branch
 * matches the first two asterisks and everything after falls apart.
 */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];

  for (const piece of line.split(INLINE)) {
    if (!piece) continue;

    if (piece.startsWith('**') && piece.endsWith('**') && piece.length > 4) {
      out.push({ type: 'bold', text: piece.slice(2, -2) });
    } else if (piece.startsWith('`') && piece.endsWith('`') && piece.length > 2) {
      out.push({ type: 'code', text: piece.slice(1, -1) });
    } else if (piece.startsWith('*') && piece.endsWith('*') && piece.length > 2) {
      out.push({ type: 'italic', text: piece.slice(1, -1) });
    } else if (piece.startsWith('[')) {
      const match = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(piece);
      const href = match ? linkHref(match[2]) : null;
      if (match && href) out.push({ type: 'link', text: match[1], href });
      // An external or malformed link keeps its words and loses its markup.
      else if (match) out.push({ type: 'text', text: match[1] });
      else out.push({ type: 'text', text: piece });
    } else {
      out.push({ type: 'text', text: piece });
    }
  }

  return out;
}

/** A pipe table row, minus the outer pipes, trimmed. */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

const isDivider = (line: string): boolean => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('-');

/**
 * The whole answer, block by block.
 *
 * Written as a hand-rolled line walker rather than a grammar because the input
 * is half-finished for most of its life: this runs on every streamed delta, on
 * text that stops mid-word. Every branch here has to do something sensible with
 * a truncated line, which is why an unterminated code fence still produces a
 * code block and a table with only a header row still produces a table.
 */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  /** Consecutive non-blank lines that are not something else, as one paragraph. */
  const paragraph = () => {
    const held: string[] = [];
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) break;
      if (/^\s{0,3}(#{2,3}\s|>\s?|```|---\s*$|[-*+]\s|\d+[.)]\s)/.test(line)) break;
      if (line.includes('|') && lines[i + 1] !== undefined && isDivider(lines[i + 1])) break;
      held.push(line.trim());
      i++;
    }
    if (held.length) blocks.push({ type: 'para', text: parseInline(held.join(' ')) });
  };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code. Unterminated is normal here, because the answer may still be
    // arriving, so running out of lines closes it.
    if (/^\s{0,3}```/.test(line)) {
      i++;
      const held: string[] = [];
      while (i < lines.length && !/^\s{0,3}```/.test(lines[i])) held.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push({ type: 'code', text: held.join('\n') });
      continue;
    }

    if (/^\s{0,3}---+\s*$/.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }

    const heading = /^\s{0,3}(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length === 2 ? 2 : 3,
        text: parseInline(heading[2].trim()),
      });
      i++;
      continue;
    }

    if (/^\s{0,3}>\s?/.test(line)) {
      const held: string[] = [];
      while (i < lines.length && /^\s{0,3}>\s?/.test(lines[i])) {
        held.push(lines[i].replace(/^\s{0,3}>\s?/, '').trim());
        i++;
      }
      blocks.push({ type: 'quote', text: parseInline(held.join(' ')) });
      continue;
    }

    // A table is a line with pipes whose next line is the divider. Testing the
    // divider rather than the pipes is what stops a sentence containing a pipe
    // from becoming a one-column table.
    if (line.includes('|') && lines[i + 1] !== undefined && isDivider(lines[i + 1])) {
      const head = cells(line).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(cells(lines[i]).map(parseInline));
        i++;
      }
      blocks.push({ type: 'table', head, rows });
      continue;
    }

    const bullet = /^\s{0,3}([-*+]|\d+[.)])\s+/.exec(line);
    if (bullet) {
      const ordered = /\d/.test(bullet[1]);
      const items: Inline[][] = [];
      while (i < lines.length) {
        const item = /^\s{0,3}([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        // A list ends when the marker changes kind, so a numbered list following
        // a bulleted one is two blocks rather than one confused one.
        if (!item || /\d/.test(item[1]) !== ordered) break;
        i++;

        // Wrapped continuation lines belong to the item above them.
        const parts = [item[2].trim()];
        while (i < lines.length && lines[i].trim() && !/^\s{0,3}([-*+]|\d+[.)])\s/.test(lines[i])) {
          if (/^\s{0,3}(#{2,3}\s|>\s?|```)/.test(lines[i])) break;
          parts.push(lines[i].trim());
          i++;
        }
        items.push(parseInline(parts.join(' ')));
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const before = i;
    paragraph();
    // paragraph() always takes at least this line, since every other shape was
    // handled above. The guard is here because "always" is doing a lot of work
    // in a loop where being wrong means a hung tab rather than a wrong answer.
    if (i === before) i++;
  }

  return blocks;
}
