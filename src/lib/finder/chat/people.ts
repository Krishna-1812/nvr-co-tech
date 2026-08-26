import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { bulkMatchPeople, searchPeople } from '../apollo/client';
import type { ApolloRecord, PeopleFilters, SearchPerson } from '../apollo/types';
import { readPersonCache, writePersonCache } from '../enrich';
import { personProfile } from '../profile';
import type { Spend } from '../store';
import {
  displayName,
  functionSearchTitles,
  personFunctions,
  requestedFunctions,
  SENIORITY_ORDER,
  seniorityRank,
  titleMatches,
} from '../taxonomy';

/**
 * The people half of a conversational answer.
 *
 * Everything here exists to stop one of two sentences being written: naming
 * somebody who does not hold the role that was asked about, or asserting that
 * nobody does when nobody looked. Those are the only two ways a grounded answer
 * can lie while sounding perfectly reasonable.
 */

type Client = SupabaseClient<Database>;
type Person = Record<string, unknown>;

const s = (v: unknown): string => String(v ?? '').trim();

// ─── Names that are not yet names ────────────────────────────────────────────

/**
 * Does this row still need a paid lookup to have a usable full name?
 *
 * **Three** ways a free row falls short, and all three have to count or the
 * reveal skips the person it exists for: the surname was flagged as withheld,
 * no name came back at all, or a first name came back with no surname. The last
 * is the case this was built for — an answer that said "Sanjeev" about a person
 * named Sanjeev Dhanaraj — and it carries no masking flag whatsoever.
 */
export function nameIncomplete(p: Person): boolean {
  if (p.name_masked || !s(p.full_name)) return true;
  if (s(p.last_name)) return false;
  return s(p.full_name).split(/\s+/).length < 2;
}

/** How many masked names one answer will pay to un-mask. */
const REVEAL_CAP = 10;

/**
 * Patch each person's name, title and profile link with what enrichment returns.
 *
 * Only people whose name Apollo actually withheld, and at most ten of them.
 * Enriching a row whose surname already came back free spends a credit to learn
 * something already in hand, which is what a list answer once did for every row
 * it mentioned.
 *
 * Deliberately does **not** carry emails and phone numbers into the returned
 * rows. This feeds list-shaped answers, and the answer prompt should only ever
 * see contact fields when somebody actually asked for one.
 *
 * A person who cannot be enriched keeps their original, possibly masked fields
 * rather than disappearing: there is a real record behind them either way.
 */
export async function revealNames(
  supabase: Client,
  people: readonly Person[],
  apiKey: string,
  spend: Spend,
  cap = REVEAL_CAP,
): Promise<Person[]> {
  const rows = [...people];
  const needy = rows.filter((p) => s(p.id) && nameIncomplete(p));
  const ids = [...new Set(needy.map((p) => s(p.id)))].slice(0, cap);
  if (ids.length === 0) return rows;

  /*
   * Read as RAW records and normalised here. The tool this is ported from wrote
   * normalised profiles from this path and raw records from bulk enrich into the
   * same cache, then read one shape and got the other — so this path's cache
   * never hit and it re-bought people it already owned. One shape in the table,
   * one place that interprets it.
   */
  const cached = await readPersonCache(supabase, ids);
  const todo = ids.filter((id) => !(id in cached));

  let fresh: Record<string, ApolloRecord> = {};
  if (todo.length > 0) {
    try {
      const unreachable: string[] = [];
      fresh = await bulkMatchPeople(todo, apiKey, unreachable);
      if (unreachable.length > 0) {
        /*
         * Recorded rather than swallowed. A chunk that never got an answer
         * leaves those names masked, which the answer already renders honestly
         * as "Vivek Sh." — but in the log a silent partial failure reads exactly
         * like Apollo holding no better record, and the next reader of this code
         * should not have to guess which happened.
         */
        console.info(
          `finder: name reveal left ${unreachable.length} of ${todo.length} masked, unanswered`,
        );
      }
      // Apollo bills about one credit per id it actually matched; misses are free.
      spend.credits += Object.keys(fresh).length;
      if (Object.keys(fresh).length > 0) await writePersonCache(supabase, fresh);
    } catch (error) {
      console.warn(
        `finder: name reveal failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  const all: Record<string, ApolloRecord> = { ...cached, ...fresh };

  return rows.map((p) => {
    const raw = all[s(p.id)];
    if (!raw) return p;
    const profile = personProfile(raw);
    if (!profile.name) return p;

    const patched: Person = { ...p, full_name: profile.name };
    // The mask is gone, so the row must stop claiming it is there: the answer
    // prompt has a rule for a withheld surname and it would fire on a name that
    // has just been bought.
    patched.name_masked = false;
    if (profile.title) patched.title = profile.title;
    if (profile.linkedin) patched.linkedin_url = profile.linkedin;
    return patched;
  });
}

// ─── Printing a name that is still masked ────────────────────────────────────

/**
 * One row with its name made printable. A **copy**: the caller's row keeps the
 * raw Apollo name, which is what a later match should still be given.
 */
export function displayPerson(p: Person): Person {
  if (!s(p.full_name).includes('*')) return p;
  const out: Person = { ...p, full_name: displayName(s(p.full_name)) };
  if (s(out.last_name).includes('*')) out.last_name = displayName(s(out.last_name));
  return out;
}

export const displayPeople = (rows: readonly Person[]): Person[] => rows.map(displayPerson);

/**
 * What the answer is told about somebody offered as a same-function contact
 * rather than as the answer.
 *
 * Compact and ordered on purpose. The whole point of that list is "who they are
 * and what they do", and a full search row buries the title among twenty other
 * keys — which is how a list of six people came back with no titles at all.
 */
export function contactBrief(raw: Person): Record<string, unknown> {
  const p = displayPerson(raw ?? {});
  const brief: Record<string, unknown> = { name: s(p.full_name), title: s(p.title) };
  for (const [from, to] of [
    ['seniority', 'seniority'],
    ['city', 'city'],
    ['country', 'country'],
    ['linkedin_url', 'linkedin'],
  ] as const) {
    if (s(p[from])) brief[to] = s(p[from]);
  }
  if (p.name_masked || nameIncomplete(p)) brief.surname_withheld_until_enriched = true;
  return brief;
}

// ─── The button under an answer ──────────────────────────────────────────────

/** How many buttons one answer may offer. Past this the grid is the better tool. */
export const CHIP_CAP = 6;

export type EnrichChip = {
  type: 'person';
  name: string;
  label?: string;
  title: string;
  domain: string;
  apollo_id: string;
};

/**
 * Button metadata for one person an answer names, or null.
 *
 * The Apollo id is what makes the reveal exact, so a row without one is not
 * offered. **This is wiring for the interface, never a fact**, and it must never
 * be put in the facts block, where the model would read it as something to say.
 */
export function enrichChip(p: Person, fallbackDomain = ''): EnrichChip | null {
  if (!s(p.id)) return null;

  const name = s(p.full_name);
  const chip: EnrichChip = {
    type: 'person',
    name,
    title: s(p.title),
    domain: s(p.organization_domain) || fallbackDomain,
    apollo_id: s(p.id),
  };

  // The button shows an abbreviated name; the match is still given the raw one.
  // "Reveal Vivek Sh***a" on a button reads as broken.
  const label = displayName(name);
  if (label !== name) chip.label = label;
  return chip;
}

// ─── Checking the list actually answers the question ─────────────────────────

/**
 * Do the people in a list answer really hold something like the title asked for?
 *
 * The single-person branch has checked this for a long time, because presenting
 * a Marketing Manager as the CMO states something Apollo never said. A **list**
 * was never checked at all, so "list the VPs of sales at Acme" could answer with
 * account executives: the same error printed five times.
 *
 * Kept a little wider than the single-person check on purpose. A loosely worded
 * ask ("who runs marketing") is expanded by the parser into several candidate
 * titles, and somebody whose own title places them in the same **function** at
 * the same level or above is a legitimate answer even when no title string
 * matches word for word.
 *
 * **Both halves are needed.** Function alone is far too wide — an Account
 * Executive sits in sales exactly as a VP of Sales does — and seniority alone is
 * what made an earlier consolation list offer six senior strangers from
 * unrelated departments.
 */
export function verifyChatPeople(
  rows: readonly Person[],
  titles: readonly string[],
): { kept: Person[]; dropped: number } {
  if (titles.length === 0) return { kept: [...rows], dropped: 0 };

  /*
   * "executive" is dropped from the requested functions, and dropping it from
   * one side is enough because an intersection needs both. It is a catch-all
   * that the token "president" attaches to every VP title and that
   * `personFunctions` attaches to everyone at C-suite level, so leaving it in
   * would make any senior title match any other.
   */
  const wanted = requestedFunctions(titles);
  wanted.delete('executive');

  /*
   * The bar is the loosest of the titles asked about, and never stricter than
   * director: asking for the VP of Finance is asking about finance leadership,
   * so the finance director belongs, while the account executive (whose title
   * places them at no level at all) does not. A question that asks lower in so
   * many words ("sales managers") keeps its own looser bar.
   */
  const asked = titles
    .map((t) => seniorityRank({ title: t }))
    .filter((r) => r < SENIORITY_ORDER.length);
  const bar = Math.max(...asked, SENIORITY_ORDER.indexOf('director'));

  const kept: Person[] = [];
  let dropped = 0;

  for (const p of rows) {
    const functions = personFunctions(p as never);
    const shared = wanted.size > 0 && [...functions].some((f) => wanted.has(f));
    const sameFunction = shared && seniorityRank(p as never) <= bar;

    if (titleMatches(s(p.title), titles) || sameFunction) kept.push(p);
    else dropped += 1;
  }

  if (dropped > 0) {
    console.info(
      `finder: chat dropped ${dropped}/${rows.length} people whose titles did not match the request`,
    );
  }
  return { kept, dropped };
}

// ─── When nobody holds the title ─────────────────────────────────────────────

/** At most this many near-misses are offered instead of an answer. */
export const CONSOLATION_MAX = 5;

/**
 * The most senior people at this company **in the function that was asked
 * about**, or the most senior overall when the title cannot be classified.
 *
 * A question about the CFO used to come back with six unrelated executives. An
 * engineering VP and a marketing head are not a substitute for the finance lead,
 * and offering them as one wasted the reader's time and made the whole answer
 * look guessed.
 *
 * Searched by the function's canonical titles and then filtered **in code**
 * against each person's own function: Apollo runs with similar titles included,
 * so the search is a recall net rather than a guarantee. Deliberately not
 * filtered by seniority at the API, so a company whose most senior finance
 * person is a Finance Manager still gets an answer; the sort is what puts the
 * seniors first.
 *
 * Free, and no surname is un-masked here — see the note at the call site.
 */
export async function sameFunctionPeople(
  orgId: string,
  wantFunctions: ReadonlySet<string>,
  apiKey: string,
  limit = CONSOLATION_MAX,
): Promise<Person[]> {
  if (!orgId || !apiKey) return [];

  const filters: PeopleFilters = { organization_ids: [orgId], max_people: 25 };

  if (wantFunctions.size === 0) {
    // Nothing to scope to. A broad senior list beats no list at all when we
    // cannot tell what was asked for.
    filters.seniorities = ['c_suite', 'vp', 'director', 'owner', 'founder'];
  } else if (wantFunctions.size === 1 && wantFunctions.has('executive')) {
    // "Who is the CEO" asks for a level, not a specialism, so it is searched as
    // one. A title list would have to guess at every C-suite variant that
    // exists and would miss the ones it did not think of.
    filters.seniorities = ['c_suite', 'owner', 'founder'];
  } else {
    filters.titles = functionSearchTitles(wantFunctions);
  }

  let rows: SearchPerson[];
  try {
    rows = await searchPeople(filters, apiKey, { perPage: 25, strict: true });
  } catch (error) {
    console.warn(
      `finder: same-function fallback failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return [];
  }

  let people = rows as Person[];
  if (wantFunctions.size > 0) {
    const before = people.length;
    people = people.filter((r) => [...personFunctions(r as never)].some((f) => wantFunctions.has(f)));
    console.info(`finder: chat fallback kept ${people.length}/${before} rows actually in function`);
  }

  return people.sort((a, b) => seniorityRank(a as never) - seniorityRank(b as never)).slice(0, limit);
}

// ─── Is a publicly named person on file at all? ──────────────────────────────

/** Person name to comparison tokens, accents folded and honorifics dropped. */
export function personNameTokens(name: string): Set<string> {
  const folded = String(name ?? '')
    .normalize('NFKD')
    // The combining marks NFKD just split off, named by codepoint rather than
    // written literally: a literal here is invisible in a diff and survives
    // exactly one careless re-save.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

  const drop = new Set([
    'mr', 'mrs', 'ms', 'dr', 'prof', 'jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'mba', 'cfa', 'cpa',
  ]);
  return new Set(folded.split(' ').filter((w) => w && !drop.has(w)));
}

/**
 * Is this row the same person as the one public research named?
 *
 * The lookup below scopes on a keyword, which is a fuzzy relevance hint rather
 * than a filter, so a row coming back is **not** evidence that it is the person
 * asked about. Checked here in code, or a same-company namesake gets presented
 * as the published role holder.
 *
 * Every meaningful word of the wanted name must appear in the candidate's, so
 * "Heidi Bullock" matches "Heidi A. Bullock" but not "Heidi Chen". A one-word
 * wanted name is refused: a single token does not identify a person. A masked
 * row ("Heidi B.") fails this deliberately — it cannot be confirmed to be the
 * right person, and the caller offers a reveal for exactly that case.
 */
export function personNameMatches(candidate: string, wanted: string): boolean {
  const want = personNameTokens(wanted);
  if (want.size < 2) return false;
  const have = personNameTokens(candidate);
  return [...want].every((w) => have.has(w));
}

export type OnFileCheck = { ok?: boolean };

/**
 * The row for one **named** person at one employer domain, or null.
 *
 * Free, and the employer domain is enforced strictly in code, so a hit here is a
 * real hit at that exact company.
 *
 * This exists because an answer used to assert "our records do not have X" about
 * a publicly named person without anything ever having looked. The only search
 * that had run was filtered **by title**, which says nothing about whether that
 * person is on file under a different one — the common case when a company's
 * published CMO sits in the vendor's data as "SVP, Marketing".
 *
 * `checked.ok` is set once Apollo has actually answered. Returning null for both
 * "looked, not there" and "could not look" put that same unfounded claim back
 * one layer up: the caller turned a bare null into "we do not hold them", so a
 * timeout re-created word for word the assertion this was written to stop.
 */
export async function personOnFile(
  name: string,
  domain: string,
  apiKey: string,
  checked?: OnFileCheck,
): Promise<Person | null> {
  const who = s(name);
  const host = s(domain).toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/^www\./, '');
  if (!who || !host || !apiKey) return null;

  let rows: SearchPerson[];
  try {
    rows = await searchPeople(
      { keywords: who, company_domains: [host], max_people: 25 },
      apiKey,
      { perPage: 25, strict: true },
    );
  } catch (error) {
    // No personal data in the log line: a domain only.
    console.warn(
      `finder: on-file lookup failed domain=${host}: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return null;
  }

  // Apollo answered. Only now does "not in the rows" mean "not on file".
  if (checked) checked.ok = true;

  for (const r of rows) {
    if (personNameMatches(s((r as Person).full_name), who)) return r as Person;
  }
  return null;
}
