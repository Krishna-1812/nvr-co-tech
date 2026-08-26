import { CODE_ALIASES, LOCATIONS, NAICS, SIC, TECHNOLOGIES } from './codeData';
import { norm, PICKER_LIMIT, type PickerEntry, type PickerMeta } from './shared';

/**
 * The other four vocabularies: NAICS, SIC, technologies and places.
 *
 * Same purpose as the industry module next door, and the same rule: a picker may
 * only offer values Apollo really uses, because a dropdown offering a value the
 * matcher would reject is worse than no dropdown. Two mechanisms live here that
 * the industry module does not need.
 *
 * ── Shape validation, because Apollo enforces one ──────────────────────────
 *
 * NAICS is 2 to 5 digits, prefix-matched, so shorter is broader. SIC is exactly
 * 4. The trap is that real NAICS codes are six digits, so pasting 541511 from
 * any official source is rejected by Apollo's own schema. `splitValid` hands the
 * rejects back rather than dropping them, so a caller can tell somebody their
 * code was not sent instead of running a search that silently ignored half of
 * what they asked for.
 *
 * Technologies and places have no shape and accept anything non-empty. A wrong
 * technology name fails by matching nothing rather than by being malformed, and
 * a guess about which technology names exist is exactly the guess the picker is
 * here to remove, not something to enforce against.
 *
 * ── Code aliases, because official titles use the government's words ───────
 *
 * See CODE_ALIASES in ./codeData. They only reorder; they never invent.
 *
 * ── What is not learned here ───────────────────────────────────────────────
 *
 * Technologies and locations grow from what Apollo returns, like industries.
 * NAICS and SIC do not, and cannot: the free people search does not return those
 * fields, so there is nothing to learn from and those two pickers stay
 * seed-only. That is a limitation of the plan, not an oversight.
 */

export { norm, PICKER_LIMIT };

export type VocabKind = 'naics' | 'sic' | 'technology' | 'location';

type KindSpec = {
  /** The shape Apollo enforces, or null where it enforces none. */
  pattern: RegExp | null;
  /** Whether the seed carries an official title beside each value. */
  labelled: boolean;
  /** Whether Apollo returns this on records, so the vocabulary grows by itself. */
  learned: boolean;
  /** The format rule in plain words, shown when a typed value is rejected. */
  hint: string;
};

const KINDS: Readonly<Record<VocabKind, KindSpec>> = {
  naics: {
    pattern: /^[0-9]{2,5}$/,
    labelled: true,
    learned: true,
    hint:
      'NAICS codes are 2 to 5 digits here. Official codes are 6 digits, so drop the last one or two: 541511 becomes 54151.',
  },
  sic: {
    pattern: /^[0-9]{4}$/,
    labelled: true,
    learned: true,
    hint: 'SIC codes are exactly 4 digits.',
  },
  technology: { pattern: null, labelled: false, learned: true, hint: '' },
  location: { pattern: null, labelled: false, learned: true, hint: '' },
};

/** Seeds as [value, note] pairs, so one loop reads both labelled and unlabelled kinds. */
const SEEDS: Readonly<Record<VocabKind, readonly (readonly [string, string])[]>> = {
  naics: NAICS,
  sic: SIC,
  technology: TECHNOLOGIES.map((t) => [t, ''] as const),
  location: LOCATIONS.map((l) => [l, ''] as const),
};

/** The vocabulary names this module serves, for callers validating a request. */
export function kinds(): VocabKind[] {
  return (Object.keys(KINDS) as VocabKind[]).sort();
}

export function isVocabKind(value: unknown): value is VocabKind {
  return typeof value === 'string' && value in KINDS;
}

/** The format rule for this kind in plain words, or "" where it has none. */
export function hint(kind: string): string {
  return isVocabKind(kind) ? KINDS[kind].hint : '';
}

/** Whether a value is even the right shape for Apollo to consider. */
export function validate(kind: string, value: unknown): boolean {
  if (!isVocabKind(kind)) return false;
  const text = String(value ?? '').trim();
  const { pattern } = KINDS[kind];
  return pattern ? pattern.test(text) : text.length > 0;
}

/** `[accepted, rejected]` for a list of typed values. Blanks are neither. */
export function splitValid(
  kind: string,
  values: readonly (string | null | undefined)[] | null | undefined,
): [string[], string[]] {
  const ok: string[] = [];
  const bad: string[] = [];
  for (const raw of values ?? []) {
    const v = String(raw ?? '').trim();
    if (!v) continue;
    (validate(kind, v) ? ok : bad).push(v);
  }
  return [ok, bad];
}

/**
 * Codes an alias names, split into exact and partial hits.
 *
 * The two are kept apart because pooling them ranks nonsense first: "hospital"
 * is a partial hit on "hospitality", so one pooled list put eating places and
 * hotels above 8062, general medical and surgical hospitals, whose own official
 * title contains the word. Exact hits outrank a title match; partial hits rank
 * below one.
 *
 * The position inside an alias is carried through so an alias lists its codes
 * best-first rather than having them re-sorted into numeric order.
 */
function aliasCodes(kind: VocabKind, query: string): { exact: Map<string, number>; loose: Set<string> } {
  const q = norm(query);
  const exact = new Map<string, number>();
  const loose = new Set<string>();
  if (!q) return { exact, loose };

  for (const [word, codes] of Object.entries(CODE_ALIASES[kind] ?? {})) {
    const w = norm(word);
    if (w === q) {
      codes.forEach((c, i) => {
        if (!exact.has(c)) exact.set(c, i);
      });
    } else if (w.includes(q) || q.includes(w)) {
      for (const c of codes) loose.add(c);
    }
  }
  return { exact, loose };
}

/** The sort key sits beside the entry, so nothing has to be stripped on the way out. */
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
 * A code kind matches on its digits and on its title, which is the whole point:
 * nobody knows that computer systems design is 5415, but everybody can type
 * "software" or "consulting".
 */
export function suggest(
  kind: string,
  query: string,
  {
    learned = [],
    limit = PICKER_LIMIT,
    meta,
  }: { learned?: readonly string[]; limit?: number; meta?: Partial<PickerMeta> } = {},
): PickerEntry[] {
  if (!isVocabKind(kind)) return [];

  const q = String(query ?? '')
    .trim()
    .toLowerCase();
  const qn = norm(query);
  const { labelled } = KINDS[kind];

  const learnedNorm = new Map<string, string>();
  for (const v of learned) {
    const value = String(v ?? '').trim();
    if (value) learnedNorm.set(norm(value), value);
  }

  const { exact: aliasExact, loose: aliasLoose } = labelled
    ? aliasCodes(kind, query)
    : { exact: new Map<string, number>(), loose: new Set<string>() };

  const seen = new Set<string>();
  const out: Ranked[] = [];

  const add = (value: string, note: string, confirmed: boolean, rank: number, within = 0) => {
    const key = norm(value);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      entry: { value, kind, confirmed, covers: [], note },
      rank: [rank, within, value.toLowerCase()],
    });
  };

  for (const [value, note] of SEEDS[kind]) {
    let rank = 0;
    let within = 0;

    if (q) {
      const hay = labelled ? norm(note) : norm(value);
      /*
       * A code matches its digits by PREFIX, so typing "54" offers 54 and 5415
       * but not 6154, which contains those digits by accident.
       */
      const codeHit = labelled && value.toLowerCase().startsWith(q.replace(/ /g, ''));
      const titleHit = qn.length > 0 && hay.includes(qn);

      if (!codeHit && !aliasExact.has(value) && !titleHit && !aliasLoose.has(value)) continue;

      // Digits typed directly, then codes an exact alias names, then titles, and
      // only then codes reached by a partial alias word.
      if (codeHit) {
        rank = 0;
      } else if (aliasExact.has(value)) {
        rank = 1;
        within = aliasExact.get(value) ?? 0;
      } else if (titleHit) {
        rank = hay.startsWith(qn) ? 2 : 3;
      } else {
        rank = 4;
      }
    }

    add(value, note, learnedNorm.has(norm(value)), rank, within);
  }

  // Values Apollo has really returned that are not written down in the seed.
  // Offered rather than hidden: Apollo using it is stronger evidence than a file.
  const learnedSorted = [...learnedNorm].sort((a, b) =>
    a[1].toLowerCase() < b[1].toLowerCase() ? -1 : a[1].toLowerCase() > b[1].toLowerCase() ? 1 : 0,
  );
  for (const [key, original] of learnedSorted) {
    if (q && !key.includes(qn)) continue;
    add(original, '', true, 2);
  }

  out.sort(byRank);

  if (meta) {
    meta.total = out.length;
    meta.truncated = out.length > limit;
  }

  return out.slice(0, limit).map((r) => r.entry);
}
