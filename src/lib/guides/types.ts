/**
 * A guide: a page that answers one question people search for, in full, and
 * then points at the tool that does the work.
 *
 * Content is data rather than JSX so the same words feed the page, its
 * structured data, the sitemap and /llms-full.txt, and so a test can read the
 * worked examples and check them against the tools' own engines.
 */

export type Block =
  | { t: 'h2'; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'formula'; text: string }
  | { t: 'table'; caption: string; head: string[]; rows: string[][] }
  | { t: 'note'; title: string; text: string };

export type Guide = {
  slug: string;
  /**
   * `draft` is visible on preview deployments and locally, never in production,
   * never in the sitemap or llms files, and always noindex. A guide is set to
   * `published` only after the owner has read it.
   */
  status: 'draft' | 'published';
  /** The page's own heading. */
  title: string;
  /** How it is named in a search result; same limits as a tool's (seo.test.ts). */
  search: { title: string; description: string };
  /** The tool this guide leads to: an agent slug. */
  tool: string;
  /** ISO date the content was last checked. */
  updated: string;
  /** ISO date it was first published, when that differs from `updated`. */
  published?: string;
  /** A name of a few words, for lists short on room (the footer). */
  short: string;
  /** One or two sentences under the heading. */
  lead: string;
  /**
   * The question answered in under sixty words, first thing on the page. This is
   * what an answer engine quotes, so it has to stand on its own.
   */
  answer: string;
  blocks: Block[];
  faq: { q: string; a: string }[];
  /**
   * Where the rules the guide relies on are written down: the Act, the
   * regulator, the portal's own manual, the professional body's material. Shown
   * under "Sources" and named in the Article data as its citations. Only what
   * the guide actually rests on; a guide that is arithmetic throughout has
   * none, rather than a list of links for the look of it. Every address was
   * opened and read before it went in (guides.test.ts checks the form).
   */
  sources?: { name: string; publisher: string; url: string }[];
  /**
   * The one figure the guide is remembered by, rolled in on its card and in its
   * hero. Quoted from the guide itself (guides.test.ts checks it appears in the
   * text), so the headline number can never say something the page does not.
   */
  figure: { value: string; label: string };
  /** Which scene stands in the guide's doorway. */
  motif: 'tower' | 'voucher' | 'scales' | 'columns' | 'sundial' | 'ledger' | 'gate' | 'nest';
};
