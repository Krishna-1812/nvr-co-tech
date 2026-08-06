import { AMOUNT_KEYS, PARTICULAR_KEYS } from './columns';
import type { RawSheet } from './sheet';

/**
 * PDF, into rows of strings.
 *
 * The hardest of the three formats by a distance, because most bank statements
 * are BORDERLESS tables: there are no ruled lines to find, only text at
 * coordinates that happen to line up. So the table is reconstructed from where
 * the words are. Words are clustered into visual lines, the header line's words
 * are grouped into columns by the gaps between them, and every other word is
 * dropped into the column it horizontally overlaps.
 *
 * Rows are then anchored rather than taken one text line at a time. A ledger row
 * routinely spans two printed lines — a wrapped narration, or "Opening" above
 * "Balance" — and a second voucher under the same date has an amount but no date
 * of its own. Anchoring on "has a date OR carries its own amount" keeps both of
 * those as one row each, instead of shattering the first and swallowing the
 * second.
 *
 * Scanned PDFs have no text layer and cannot be read at all. There is no OCR
 * here, and the upload screen says so rather than returning an empty ledger.
 */

type Word = { text: string; x0: number; x1: number; top: number; height: number };
type Column = { x0: number; x1: number; text: string };

/** Anything that looks like a date, in any of the forms a ledger prints. */
const DATEISH =
  /\d{1,2}[-/.\s][A-Za-z]{3,}(?:[-/.\s]\d{2,4})?|[A-Za-z]{3,}[-/.\s]\d{1,2}(?:[-/.\s]\d{2,4})?|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/;

const AMOUNT_TOKEN = /\d[\d,]*(?:\.\d+)?/;

/** An opening or closing balance line, wherever on the row the label landed. */
export const BALANCE_LINE = /\b(opening|closing)\s+balance\b|\bbalance\s+[bc]\/[fd]\b/i;

/**
 * Loading pdf.js.
 *
 * The LEGACY build, not the default one, and that is a considered choice. The
 * default build assumes a browser with DOMMatrix and refuses to run under Node,
 * which would mean the hardest parser in this codebase — the coordinate
 * reconstruction below — could only ever be checked by hand. The legacy build
 * runs in both, so there is one code path and a test that actually reads a PDF.
 * The size it costs lands only on people who drop a PDF, because the whole
 * module is imported on demand.
 *
 * The worker is set only in a browser. pdf.js does its parsing off the main
 * thread there, and the bundler has to be told where that second file lives;
 * `new URL(..., import.meta.url)` is the form Turbopack and webpack both
 * recognise as "emit this asset and give me its URL". Under Node it runs
 * in-process, and a URL pointing at a bundler output would simply fail to load.
 */
async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  }
  return pdfjs;
}

export class PdfParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfParseError';
  }
}

export async function readPdf(data: ArrayBuffer): Promise<RawSheet> {
  const pdfjs = await loadPdfJs();
  // The loading task, not just the document: tearing down the worker is on the
  // task, and leaving one running per file would leak a thread per upload.
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;

  const rows: string[][] = [];
  const textParts: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();

      // One page's worth of vertical space, offset so page two can never
      // cluster into page one's last line.
      const offset = pageNumber * 100_000;
      const words: Word[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        words.push(...itemWords(item.str, item.transform, item.width, item.height, offset));
      }

      const lines = clusterLines(words);
      for (const line of lines) textParts.push(line.map((w) => w.text).join(' '));

      // The header repeats on every page of a long statement. Only the first
      // one is kept, or the parser would read it as a transaction each time.
      const pageRows = reconstruct(lines);
      rows.push(...(rows.length === 0 ? pageRows : pageRows.slice(1)));
    }
  } finally {
    await task.destroy();
  }

  const text = textParts.join('\n');

  if (!text.trim()) {
    throw new PdfParseError(
      'This PDF has no text in it, so it is almost certainly a scan or a photograph. ' +
        'Ask for it as Excel or CSV, or export it again from the source as a text PDF.',
    );
  }

  // If reconstruction found no table, fall back to splitting each printed line.
  // Cruder, but a plain text statement is better read badly than not at all.
  if (score(rows) === 0) {
    const naive = text.split('\n').map(splitTextRow);
    if (score(naive) > 0) return { rows: naive, text };
  }

  return { rows, text };
}

/**
 * One text run, split into words with a box each.
 *
 * pdf.js hands back runs, not words, and a run can be a whole printed line. The
 * per-word x positions are interpolated across the run by character count, which
 * is an approximation in a proportional font — but the error is a fraction of a
 * character, and the columns it has to choose between are centimetres apart.
 */
function itemWords(
  str: string,
  transform: number[],
  width: number,
  height: number,
  offset: number,
): Word[] {
  if (!str.trim()) return [];

  const x0 = transform[4];
  // PDF y grows upward; everything here wants it growing downward.
  const top = offset - transform[5];
  const perChar = str.length && width ? width / str.length : 0;

  // No width reported: keep the run whole rather than piling every word on one
  // x coordinate, which would put them all in the same column anyway.
  if (perChar === 0) {
    return [{ text: str.trim(), x0, x1: x0, top, height }];
  }

  const words: Word[] = [];
  for (const match of str.matchAll(/\S+/g)) {
    const start = match.index ?? 0;
    words.push({
      text: match[0],
      x0: x0 + start * perChar,
      x1: x0 + (start + match[0].length) * perChar,
      top,
      height,
    });
  }
  return words;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Group words into printed lines by vertical position. */
function clusterLines(words: Word[]): Word[][] {
  if (words.length === 0) return [];

  const heights = words.map((w) => w.height).filter((h) => h > 0);
  const tolerance = heights.length ? Math.max(2, 0.5 * median(heights)) : 3;

  const ordered = [...words].sort((a, b) => a.top - b.top || a.x0 - b.x0);
  const lines: { centre: number; words: Word[] }[] = [];

  for (const word of ordered) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(word.top - last.centre) <= tolerance) {
      last.words.push(word);
      last.centre = (last.centre * (last.words.length - 1) + word.top) / last.words.length;
    } else {
      lines.push({ centre: word.top, words: [word] });
    }
  }

  return lines.map((l) => l.words.sort((a, b) => a.x0 - b.x0));
}

/**
 * The header's words, merged into column cells.
 *
 * Split only at wide gaps, so "Opening Balance" and "Debit (₹)" stay one cell
 * each while a real column boundary starts a new one.
 */
function headerColumns(words: Word[]): Column[] {
  const heights = words.map((w) => w.height).filter((h) => h > 0);
  const threshold = heights.length ? Math.max(6, 0.6 * median(heights)) : 8;

  const cells: Column[] = [];
  for (const word of [...words].sort((a, b) => a.x0 - b.x0)) {
    const last = cells[cells.length - 1];
    if (last && word.x0 - last.x1 <= threshold) {
      last.text += ` ${word.text}`;
      last.x1 = Math.max(last.x1, word.x1);
    } else {
      cells.push({ x0: word.x0, x1: word.x1, text: word.text });
    }
  }
  return cells.map((c) => ({ ...c, text: c.text.trim() }));
}

/**
 * Which column a word belongs to.
 *
 * Most overlap wins. Where a word overlaps no header at all it is sitting in the
 * whitespace between two, which happens constantly: amount columns are
 * right-aligned while their headers are left-aligned, so a figure drifts right
 * of its own header. Splitting the difference between header centres would then
 * pull a debit into the credit column. Attaching it to the nearest header that
 * STARTS at or before it keeps a right-aligned figure under its own heading.
 */
function columnFor(word: Word, columns: Column[]): number {
  let best = -1;
  let bestOverlap = 0;
  for (let i = 0; i < columns.length; i += 1) {
    const overlap = Math.min(word.x1, columns[i].x1) - Math.max(word.x0, columns[i].x0);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = i;
    }
  }
  if (best >= 0) return best;

  const centre = (word.x0 + word.x1) / 2;
  let candidate = 0;
  for (let i = 0; i < columns.length; i += 1) {
    if (columns[i].x0 <= centre) candidate = i;
    else break;
  }
  return candidate;
}

/** Rebuild one page's table from its clustered lines. */
function reconstruct(lines: Word[][]): string[][] {
  const headerIndex = lines.findIndex((line) => {
    const joined = line.map((w) => w.text.toLowerCase()).join(' ');
    return joined.includes('date') && PARTICULAR_KEYS.some((p) => joined.includes(p));
  });
  if (headerIndex === -1) return [];

  const columns = headerColumns(lines[headerIndex]);
  if (columns.length < 2) return [];

  const headerRow = columns.map((c) => c.text);
  const width = columns.length;

  const dateColumn = Math.max(
    0,
    columns.findIndex((c) => c.text.toLowerCase().includes('date')),
  );
  const amountColumns = columns
    .map((c, i) => ({ i, low: c.text.toLowerCase() }))
    .filter(({ low }) => AMOUNT_KEYS.some((k) => low.includes(k)))
    .map(({ i }) => i);

  const hasAmount = (cells: string[]) =>
    amountColumns.some((i) => i < cells.length && AMOUNT_TOKEN.test(cells[i] ?? ''));

  // Every line below the header, as cells, keeping its vertical position so a
  // wrapped fragment can be reattached to the row it belongs to.
  const placed: { top: number; cells: string[] }[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const cells = Array.from({ length: width }, () => '');
    for (const word of line) {
      const column = columnFor(word, columns);
      cells[column] = cells[column] ? `${cells[column]} ${word.text}` : word.text;
    }
    placed.push({ top: line[0]?.top ?? 0, cells });
  }
  if (placed.length === 0) return [headerRow];

  /*
   * An anchor is a real ledger row: it has a date, OR it carries an amount of
   * its own, OR it is a balance line. The middle test is what keeps a
   * continuation voucher — printed under the same date with its own figure — as
   * a row rather than being absorbed into the one above it. Lines with none of
   * the three are wrapped fragments and get merged into the nearest anchor,
   * which works whether the fragment sits above or below the line with the
   * figure on it.
   *
   * The balance test is there because of what happens without it. A closing
   * balance printed under the table is usually one run of text with no date and
   * nothing in an amount column, so it looked like a wrapped fragment and was
   * glued onto the last transaction — leaving a statement line reading "Entry
   * only in Ledger B: INTEREST CREDITED (as on 30-Apr-2026): 10,32,700 Cr".
   * The figures survived that, because the balance is also read from the file's
   * text, but the narration did not, and narration is what matching runs on.
   */
  const isAnchor = (cells: string[]) =>
    DATEISH.test(cells[dateColumn] ?? '') || hasAmount(cells) || BALANCE_LINE.test(cells.join(' '));

  const anchors = placed.map((p, i) => (isAnchor(p.cells) ? i : -1)).filter((i) => i >= 0);
  if (anchors.length === 0) return [headerRow, ...placed.map((p) => p.cells)];

  const groups = new Map<number, { top: number; cells: string[] }[]>();
  for (const anchor of anchors) groups.set(anchor, []);
  for (const line of placed) {
    const nearest = anchors.reduce((best, a) =>
      Math.abs(placed[a].top - line.top) < Math.abs(placed[best].top - line.top) ? a : best,
    );
    groups.get(nearest)!.push(line);
  }

  const out: string[][] = [headerRow];
  let lastDate = '';
  for (const anchor of anchors) {
    const members = (groups.get(anchor) ?? []).sort((a, b) => a.top - b.top);
    const combined = Array.from({ length: width }, () => '');
    for (const member of members) {
      for (let i = 0; i < width; i += 1) {
        const token = (member.cells[i] ?? '').trim();
        if (!token) continue;
        combined[i] = combined[i] ? `${combined[i]} ${token}` : token;
      }
    }

    /*
     * Carry the running date onto continuation rows that have none of their own
     * — a second voucher printed under one date leaves the cell empty.
     *
     * Only when the cell IS empty. Filling it whenever it merely fails to look
     * like a date overwrites whatever was there, and what is there is sometimes
     * a label: a closing balance line whose "Closing Balance" landed in the date
     * column came out as a dated transaction with a narration of "(as on
     * 30-Apr-2026): 10,32,700 Cr", because the words identifying it had been
     * replaced by the date above it.
     */
    if (DATEISH.test(combined[dateColumn] ?? '')) lastDate = combined[dateColumn];
    else if (lastDate && !(combined[dateColumn] ?? '').trim()) combined[dateColumn] = lastDate;

    out.push(combined);
  }
  return out;
}

/** How many rows look like real ledger lines: a date AND a figure. */
function score(rows: string[][]): number {
  return rows.filter(
    (row) => row.some((c) => DATEISH.test(c)) && row.some((c) => AMOUNT_TOKEN.test(c)),
  ).length;
}

/** Last resort: pull a date off the front and figures off the end of a line. */
function splitTextRow(line: string): string[] {
  const text = line.trim();
  if (!text) return [''];

  const dateMatch = /^(\d{1,2}[-/\s][A-Za-z]{3,}[-/\s]?\d{0,4})\s+(.*)$/.exec(text);
  const [dateToken, rest] = dateMatch ? [dateMatch[1], dateMatch[2]] : ['', text];

  const amounts = rest.match(/[\d,]+\.\d{2}|[\d,]+/g) ?? [];
  const particular = rest.replace(/[\d,]+\.\d{2}|[\d,]+/g, '').replace(/^[\s\-|]+|[\s\-|]+$/g, '');

  if (amounts.length >= 2) {
    return [dateToken, particular, amounts[amounts.length - 2], amounts[amounts.length - 1]];
  }
  return [dateToken, particular, amounts[0] ?? '', ''];
}
