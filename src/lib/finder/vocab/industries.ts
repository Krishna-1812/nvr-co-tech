import { ALIASES, FAMILIES, SEED_INDUSTRIES } from './industryData';
import { norm, PICKER_LIMIT, type PickerEntry, type PickerMeta } from './shared';

/**
 * Turning what somebody typed into industries Apollo actually uses.
 *
 * ── Why this module exists at all ──────────────────────────────────────────
 *
 * Apollo has no industry filter. The nearest parameter is a free-text relevance
 * match over a company's name and keyword tags, so asking for "Healthcare"
 * returns SCALE Healthcare, Hummingbird Healthcare and LiquidAgents Healthcare
 * on the people endpoint, all chosen for having the word in their name, and a
 * venture firm, a meditation app and a compliance vendor on the company one. The
 * parameter is still sent, as a net to widen recall, and the industry is then
 * enforced here against Apollo's own classification.
 *
 * That classification is the LinkedIn taxonomy, and nothing in it is spelled
 * "healthcare". The real values are "hospital & health care", "medical
 * practice", "pharmaceuticals" and six more. `FAMILIES` is the bridge across
 * that gap, and it is the reason a strict, honest filter does not simply return
 * nothing for every ordinary word.
 *
 * ── The learned half ───────────────────────────────────────────────────────
 *
 * `suggest` merges learned values over the seed at read time. Learned values are
 * harvested from every Apollo record this tool touches, so they are correct by
 * construction: Apollo returned them. Three consequences follow, and all three
 * are the point. If Apollo renames, adds or retires a value the picker follows
 * with no code change. A seed entry that never appears in real data is visibly
 * never `confirmed`. And a value Apollo really uses that this file never knew
 * about is offered anyway, because Apollo using it is stronger evidence than
 * anything written down here.
 */

export { norm, PICKER_LIMIT };
export { FAMILIES, SEED_INDUSTRIES };

/**
 * The family a typed term names, or "" if it names none.
 *
 * Looked up on the lightly-cleaned term rather than on `norm`, because both
 * tables are keyed by ordinary spellings with their spaces intact.
 */
export function familyFor(term: string | null | undefined): string {
  const t = String(term ?? '')
    .trim()
    .toLowerCase();
  if (!t) return '';
  const fam = ALIASES[t] ?? t;
  return fam in FAMILIES ? fam : '';
}

/**
 * The requested terms as the set of normalized values they mean.
 *
 * A term naming a family expands to that family's industries. A term that does
 * not is kept as itself, so an exact Apollo value picked from the dropdown and a
 * fragment somebody typed by hand both still work.
 */
export function expand(terms: readonly (string | null | undefined)[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const raw of terms ?? []) {
    const term = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!term) continue;
    out.add(norm(term));
    const fam = familyFor(term);
    if (fam) {
      out.add(norm(fam));
      for (const v of FAMILIES[fam]) out.add(norm(v));
    }
  }
  out.delete('');
  return out;
}

/**
 * The Apollo values a single typed term resolves to, for display.
 *
 * This is what makes the picker honest: choosing "healthcare" is choosing nine
 * Apollo industries, and the interface can name them instead of implying Apollo
 * holds a value spelled "healthcare".
 */
export function industriesFor(term: string | null | undefined): string[] {
  const fam = familyFor(term);
  if (fam) return [...FAMILIES[fam]];
  const t = norm(term);
  if (!t) return [];
  const exact = SEED_INDUSTRIES.filter((i) => norm(i) === t);
  if (exact.length > 0) return exact;
  return SEED_INDUSTRIES.filter((i) => norm(i).includes(t) || t.includes(norm(i)));
}

/**
 * A picker row plus the sort key that put it where it is.
 *
 * The key sits beside the entry rather than inside it, so the entry handed back
 * is the entry the caller sees — no field to remember to strip on the way out.
 */
type Ranked = { entry: PickerEntry; rank: [number, number, string] };

function byRank(a: Ranked, b: Ranked): number {
  return (
    a.rank[0] - b.rank[0] ||
    a.rank[1] - b.rank[1] ||
    (a.rank[2] < b.rank[2] ? -1 : a.rank[2] > b.rank[2] ? 1 : 0)
  );
}

/**
 * Ranked picker entries for a partly-typed query.
 *
 * Families rank above individual industries, and a prefix match above a
 * mid-string one, because somebody typing "heal" wants "healthcare" first and
 * "mental health care" after it, not whatever alphabetical order happens to
 * give.
 */
export function suggest(
  query: string,
  {
    learned = [],
    limit = PICKER_LIMIT,
    meta,
  }: { learned?: readonly string[]; limit?: number; meta?: Partial<PickerMeta> } = {},
): PickerEntry[] {
  const q = norm(query);

  const learnedNorm = new Map<string, string>();
  for (const v of learned) {
    const value = String(v ?? '').trim();
    if (value) learnedNorm.set(norm(value), value);
  }

  const out: Ranked[] = [];

  for (const fam of Object.keys(FAMILIES).sort()) {
    const covers = FAMILIES[fam];
    if (q && !norm(fam).includes(q) && !covers.some((v) => norm(v).includes(q))) continue;
    out.push({
      entry: { value: fam, kind: 'family', confirmed: false, covers: [...covers] },
      rank: [0, norm(fam).startsWith(q) ? 0 : 1, fam],
    });
  }

  /*
   * Seeds first so a value Apollo returned in some other casing does not
   * displace the spelling this file wrote down, then learned values that are not
   * in the seed list at all — those are real Apollo industries this code did not
   * know about, and they are offered rather than hidden.
   */
  const known = new Map<string, string>();
  for (const i of SEED_INDUSTRIES) known.set(norm(i), i);
  for (const [key, original] of learnedNorm) if (!known.has(key)) known.set(key, original);

  for (const [key, value] of [...known].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))) {
    if (q && !key.includes(q)) continue;
    out.push({
      entry: { value, kind: 'industry', confirmed: learnedNorm.has(key), covers: [] },
      rank: [1, key.startsWith(q) ? 0 : 1, value],
    });
  }

  out.sort(byRank);

  if (meta) {
    meta.total = out.length;
    meta.truncated = out.length > limit;
  }

  return out.slice(0, limit).map((r) => r.entry);
}
