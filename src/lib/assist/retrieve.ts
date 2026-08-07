import { DOCS, type Doc } from './knowledge';

/**
 * Finding the handful of documents an answer should be built from.
 *
 * Deliberately lexical rather than embeddings, and the reason is not cost.
 *
 * The corpus is about thirty documents written by us, and retrieval over it has
 * to be reproducible: the same question must reach the same documents on Monday
 * and on Friday, on this machine and on the deployed one, or a test asserting
 * that "how do approvals work" retrieves the approvals document is asserting
 * about the weather. Embeddings mean a network call at build or at query time,
 * a model version that moves underneath you, and a similarity score nobody can
 * explain when it goes wrong. Scoring here is arithmetic over words, so a bad
 * result can be read off and fixed by adding a keyword.
 *
 * The one thing a lexical index is genuinely bad at is vocabulary: somebody
 * types BRS and every document says bank reconciliation statement. That is what
 * the `keywords` field on a document is for, and it is the fix for nearly every
 * retrieval miss found while testing this.
 */

export type Hit = { doc: Doc; score: number };

/**
 * Words carrying no signal in a corpus about finance software.
 *
 * "Voucher", "tax" and "ledger" are deliberately NOT here even though they are
 * everywhere: they are common in the corpus, so the inverse document frequency
 * below already discounts them, and it does it in proportion rather than by
 * throwing the word away. This list is only for words that mean nothing
 * anywhere.
 */
const STOP = new Set([
  'a', 'about', 'after', 'all', 'also', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'done', 'for', 'from', 'get',
  'give', 'had', 'has', 'have', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its',
  'just', 'me', 'my', 'no', 'not', 'of', 'on', 'one', 'only', 'or', 'other', 'our',
  'out', 'over', 'please', 'say', 'she', 'so', 'some', 'such', 'than', 'that',
  'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'to',
  'up', 'us', 'use', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while',
  'who', 'why', 'will', 'with', 'would', 'you', 'your',
]);

/**
 * A very small stemmer.
 *
 * Only the endings that actually cost a match in this corpus: plurals, and the
 * two verb endings that turn "match" into "matching" and "matched". Anything
 * more aggressive starts folding words that mean different things, and a
 * stemmer that turns "advance" into "advanc" and "advances" into "advanc" has
 * gained nothing a plural rule did not already give.
 *
 * The length guards are what stop it eating short words: "less" must not become
 * "les", and "paid" must not become "pa".
 */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && (word.endsWith('ses') || word.endsWith('xes'))) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  return word;
}

/**
 * Text to terms.
 *
 * Digits are kept and are not stemmed, because a section number is a word here:
 * 194J, 26Q, 2B, 0008. Splitting on non-alphanumerics means 194J survives as one
 * token while "gstr-2b" becomes two, which is why the keyword lists spell both
 * forms.
 */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (/\d/.test(w) ? w : stem(w)));
}

/**
 * A document as the index holds it: how often each term occurs, weighted by
 * where it occurred.
 *
 * A word in the title counts for six occurrences and a keyword for five, which
 * is what makes "roles" find the roles document rather than the four other
 * documents that mention roles in passing. The weights are high because the
 * title is a handful of words against a body of several hundred, so without them
 * a title match is arithmetically invisible.
 */
type Indexed = { doc: Doc; terms: Map<string, number>; length: number };

function indexDoc(doc: Doc): Indexed {
  const terms = new Map<string, number>();
  const add = (text: string, weight: number) => {
    for (const term of tokenise(text)) terms.set(term, (terms.get(term) ?? 0) + weight);
  };

  add(doc.title, 6);
  add((doc.keywords ?? []).join(' '), 5);
  add(doc.body, 1);

  let length = 0;
  for (const n of terms.values()) length += n;
  return { doc, terms, length };
}

const INDEX: Indexed[] = DOCS.map(indexDoc);

/**
 * Inverse document frequency, computed once.
 *
 * The +1s are the usual smoothing, and they matter more than usual in a corpus
 * this small: without them a term appearing in every document would score zero
 * and a term appearing in none would divide by zero.
 */
const IDF = new Map<string, number>();
for (const entry of INDEX) {
  for (const term of entry.terms.keys()) IDF.set(term, (IDF.get(term) ?? 0) + 1);
}
for (const [term, docs] of IDF) {
  IDF.set(term, Math.log(1 + INDEX.length / (1 + docs)));
}

/** The mean document length, for the length normalisation below. */
const AVG_LENGTH = INDEX.reduce((sum, e) => sum + e.length, 0) / Math.max(INDEX.length, 1);

/**
 * How much a document is favoured for belonging to the tool the reader is
 * looking at.
 *
 * Multiplicative rather than additive, so it reorders documents that are already
 * relevant instead of dragging in an irrelevant one. Somebody sitting inside
 * Ledger Reconciliation asking "how do I start" means that tool, but somebody in
 * there asking about GST does not want a reconciliation answer, and an additive
 * bonus would have given them one.
 */
const AGENT_BOOST = 1.6;

/** Below this a document is noise, and a wrong document is worse than none. */
const FLOOR = 0.35;

export function retrieve(
  query: string,
  { agent = null, limit = 6 }: { agent?: string | null; limit?: number } = {},
): Hit[] {
  const terms = tokenise(query);
  if (terms.length === 0) return [];

  // The same term twice in a question is emphasis, and counting it twice is the
  // honest reading of that.
  const wanted = new Map<string, number>();
  for (const term of terms) wanted.set(term, (wanted.get(term) ?? 0) + 1);

  const hits: Hit[] = [];

  for (const entry of INDEX) {
    let score = 0;

    for (const [term, asked] of wanted) {
      const found = entry.terms.get(term);
      if (!found) continue;

      /*
       * Saturating term frequency, as BM25 does it. The tenth mention of
       * "reconciliation" in a document about reconciliation says nothing the
       * third did not, and without saturation the longest document wins every
       * query that touches its subject.
       */
      const tf = found / (found + 1.2 * (0.25 + 0.75 * (entry.length / AVG_LENGTH)));
      score += (IDF.get(term) ?? 0) * tf * asked;
    }

    if (score <= 0) continue;
    if (agent && entry.doc.agent === agent) score *= AGENT_BOOST;
    hits.push({ doc: entry.doc, score });
  }

  hits.sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));

  const best = hits[0]?.score ?? 0;
  return hits.filter((h) => h.score >= Math.max(FLOOR, best * 0.18)).slice(0, limit);
}

/**
 * The tool the reader is inside, always included.
 *
 * Retrieval answers "what is this question about"; this answers "what is on
 * their screen". They are different questions, and the second one has a right
 * answer that does not depend on how the first was worded. Without this, "how do
 * I use this" inside Ledger Reconciliation retrieves nothing useful, because
 * neither "use" nor "this" is a word.
 */
export function retrieveWithContext(
  query: string,
  { agent = null, limit = 6 }: { agent?: string | null; limit?: number } = {},
): Hit[] {
  const hits = retrieve(query, { agent, limit });
  if (!agent) return hits;
  if (hits.some((h) => h.doc.agent === agent)) return hits;

  const overview = INDEX.find((e) => e.doc.id === `agent-${agent}`);
  if (!overview) return hits;

  return [{ doc: overview.doc, score: 0 }, ...hits].slice(0, limit);
}
