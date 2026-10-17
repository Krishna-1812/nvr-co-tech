import { Font } from '@react-pdf/renderer';

/**
 * The faces a PDF drawn in the browser can print in, and how to ask for them.
 *
 * ── Why not Helvetica ──────────────────────────────────────────────────────
 *
 * The standard PDF fonts cover Western European text and nothing else. A
 * character outside that set is not substituted, it is simply not drawn: a ₹
 * typed into a payment label came out as a stray superscript, and a label
 * written in Hindi came out as "A?". Nothing failed and nothing warned, so the
 * printed schedule just said something other than the one on the screen. For a
 * document a CA files, that is a correctness bug, not a cosmetic one.
 *
 * So the text is set in Figtree, the product's own face, which has the rupee
 * sign and everything a Latin-script schedule uses, with one fallback face for
 * each of the nine major Indian scripts behind it. react-pdf picks, character
 * by character, the first face in the list that has the glyph.
 *
 * ── Why the fallbacks are chosen per document ──────────────────────────────
 *
 * Every family named in a style is fetched before the first page is laid out,
 * whether a single character uses it or not, and the nine script faces come to
 * about 2.6 MB. `fontStack` therefore names only the scripts the document's own
 * text contains: an all-English schedule loads Figtree's 36 KB and nothing else.
 *
 * ── Why three of them are Anek rather than Noto ────────────────────────────
 *
 * fontkit, the shaper react-pdf uses, throws on the current Noto Sans Gurmukhi
 * and Noto Sans Malayalam (a mark anchor it reads as null), which would fail the
 * whole document, and it detaches Odia's vowel signs from Noto Sans Oriya. The
 * Anek faces for those three scripts shape correctly, so they are used instead.
 *
 * Not covered: scripts outside these (Urdu and other right-to-left text, which
 * react-pdf cannot order anyway, CJK, emoji). Those characters still print as
 * nothing; they are rare enough in a payment schedule not to justify the weight.
 *
 * The files live in public/fonts/pdf with their licence (SIL OFL 1.1).
 */

export const PDF_SANS = 'Figtree';

const SCRIPTS = [
  { family: 'PDF Devanagari', file: 'devanagari', chars: /[ऀ-ॿ꣠-ꣿ]/ },
  { family: 'PDF Bengali', file: 'bengali', chars: /[ঀ-৿]/ },
  { family: 'PDF Gurmukhi', file: 'gurmukhi', chars: /[਀-੿]/ },
  { family: 'PDF Gujarati', file: 'gujarati', chars: /[઀-૿]/ },
  { family: 'PDF Odia', file: 'odia', chars: /[଀-୿]/ },
  { family: 'PDF Tamil', file: 'tamil', chars: /[஀-௿]/ },
  { family: 'PDF Telugu', file: 'telugu', chars: /[ఀ-౿]/ },
  { family: 'PDF Kannada', file: 'kannada', chars: /[ಀ-೿]/ },
  { family: 'PDF Malayalam', file: 'malayalam', chars: /[ഀ-ൿ]/ },
] as const;

/**
 * Where the font files are: the site's own /fonts/pdf in the browser, and the
 * same folder on disk when a document is rendered under Node (tests, scripts),
 * which run from the repository root.
 */
function defaultBase(): string {
  return typeof window !== 'undefined' ? `${window.location.origin}/fonts/pdf` : `${process.cwd()}/public/fonts/pdf`;
}

let registered: string | null = null;

/** Registers every face once. Registering only says where a file is; nothing is fetched until a document asks for it. */
export function registerPdfFonts(base: string = defaultBase()): void {
  if (registered === base) return;
  Font.register({
    family: PDF_SANS,
    fonts: [400, 600, 700].map((fontWeight) => ({ src: `${base}/figtree-${fontWeight}.ttf`, fontWeight })),
  });
  for (const s of SCRIPTS) {
    Font.register({
      family: s.family,
      fonts: [400, 700].map((fontWeight) => ({ src: `${base}/${s.file}-${fontWeight}.ttf`, fontWeight })),
    });
  }
  // Labels and names are not English prose, and a hyphen dropped into the
  // middle of one ("podi-um") reads as part of it. Wrap at spaces only.
  Font.registerHyphenationCallback((word) => [word]);
  registered = base;
}

/** The font list for a document whose text is `texts`: Figtree, then the script faces that text needs. */
export function fontStack(texts: readonly string[]): string[] {
  const all = texts.join(' ');
  return [PDF_SANS, ...SCRIPTS.filter((s) => s.chars.test(all)).map((s) => s.family)];
}

/**
 * The font list for one piece of typed text, such as a payment's label.
 *
 * When the text is in an Indian script, that script's face goes first for the
 * whole string, so its Latin letters, digits and ₹ come from the same face as
 * the script. Otherwise the string is split into runs at every change of face,
 * and the line breaker treats a run boundary as a place it may break and
 * hyphenate: "(बुकिंग)" came out as "(-" on one line and "बुकिंग)" on the next.
 * Undefined means "inherit the page's list", which is right for Latin text.
 */
export function textFont(text: string): string[] | undefined {
  const script = SCRIPTS.find((s) => s.chars.test(text));
  return script ? [script.family, PDF_SANS] : undefined;
}

// ── Long words ──────────────────────────────────────────────────────────────

/*
 * Figtree's advance widths for printable ASCII (space to tilde), in thousandths
 * of an em, read from the font files in public/fonts/pdf. Regular, then bold.
 */
const ADVANCE = {
  regular: [247,298,320,629,563,786,644,200,352,352,481,623,226,417,208,389,641,413,559,544,621,575,566,537,614,566,253,259,623,623,623,504,989,677,611,721,688,592,543,760,751,271,515,610,520,846,774,776,579,780,626,614,552,707,693,960,614,604,641,324,389,324,551,438,221,510,586,541,586,546,369,587,558,232,269,485,220,851,558,580,591,578,338,466,378,558,520,784,475,526,491,385,257,385,567],
  bold: [238,312,412,631,554,813,647,245,382,382,488,632,257,408,248,432,648,422,579,556,633,581,580,556,612,580,301,305,632,632,632,513,992,714,612,725,700,589,554,743,750,289,552,666,537,857,773,787,603,789,645,607,584,704,722,985,679,647,632,344,432,344,581,434,263,533,596,546,595,554,393,601,570,262,291,538,246,872,568,581,601,592,379,466,402,568,556,835,536,576,477,394,256,394,667],
};

/** A Latin-script word, the only kind it is safe to cut between any two characters. */
const LATIN_WORD = /^[\u0020-\u024F\u2010-\u2027\u20B9]+$/;

function widthOf(text: string, size: number, bold: boolean): number {
  const table = bold ? ADVANCE.bold : ADVANCE.regular;
  let units = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    // Anything outside the table is taken as wide, so a guess errs towards fitting.
    units += c >= 32 && c < 127 ? table[c - 32] : 700;
  }
  return (units / 1000) * size;
}

/**
 * Text with any word too wide for its box broken onto lines that fit.
 *
 * The line breaker only breaks at spaces (see registerPdfFonts), so a label
 * with none — a demand letter's reference, "DL/2026/04/4512-tower-B-podium" —
 * was laid out as one line and ran straight across the next columns of the
 * table, printed over the date and the source. Such a word is cut here instead,
 * after a / - _ . where it can be so the pieces still read as the reference,
 * and the pieces are joined with line breaks. Words that fit, and words in an
 * Indian script, whose characters cannot be cut between, are left alone.
 *
 * `width` is the space for the text in points; `size` its font size.
 */
export function fitWords(text: string, width: number, size: number, bold = false): string {
  const room = width * 0.96;
  return text
    .split(/( +)/)
    .map((word) => {
      if (!word.trim() || !LATIN_WORD.test(word) || widthOf(word, size, bold) <= room) return word;
      const lines: string[] = [];
      let line = '';
      for (const ch of word) {
        if (line && widthOf(line + ch, size, bold) > room) {
          const cut = Math.max(...['/', '-', '_', '.'].map((sep) => line.lastIndexOf(sep)));
          if (cut > 0 && cut < line.length - 1) {
            lines.push(line.slice(0, cut + 1));
            line = line.slice(cut + 1);
          } else {
            lines.push(line);
            line = '';
          }
        }
        line += ch;
      }
      lines.push(line);
      return lines.join('\n');
    })
    .join('');
}

