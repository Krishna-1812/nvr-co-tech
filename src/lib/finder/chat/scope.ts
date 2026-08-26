import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { searchCompanies } from '../apollo/client';
import type { ApolloRecord, CompanyFilters, SearchMeta } from '../apollo/types';
import type { Intent } from '../llm/intent';
import { normName } from '../resolve';
import { learnFrom, readLearnedVocab, type Spend } from '../store';
import { VERIFY_LABELS, verifyRows, type VerifyFilters } from '../verify';
import { industriesFor } from '../vocab/industries';
import { hint as codeHint, splitValid, suggest as suggestVocab } from '../vocab/codes';
import { norm as vocabNorm } from '../vocab/shared';

/**
 * The employer half of a conversational question, and the guard that stops one
 * conversation answering two different questions.
 *
 * An industry, a size, a revenue band, an HQ or a technology constrains the
 * **employer**, and none of it can be honoured against a free people row: that
 * row carries no industry, no headcount and no HQ. So companies are established
 * first and the people search is scoped to the ones that really do match.
 *
 * This direction, not the other. Searching people first and paying to describe
 * their employers afterwards costs the same credit and answers a worse question,
 * because it can only filter the employers Apollo happened to return.
 */

type Client = SupabaseClient<Database>;

/** How many verified companies a scoped question searches inside. */
export const CHAT_SCOPE_MAX = 25;

const intOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

/**
 * The NAICS and SIC codes in a parsed question, and the malformed ones.
 *
 * These live on the **people** search as well as the company one and Apollo
 * applies both strictly, so a coded question stays free: there is nothing to
 * verify afterwards and no reason to pay for a company lookup to honour it.
 *
 * Malformed codes are separated out rather than sent. NAICS is taken at two to
 * five digits, so a question quoting a real six-digit code would otherwise be
 * answered with an empty page and no explanation.
 */
export function chatCodes(intent: Intent): {
  filters: Record<string, string[]>;
  rejected: Record<string, { codes: string[]; hint: string }>;
} {
  const filters: Record<string, string[]> = {};
  const rejected: Record<string, { codes: string[]; hint: string }> = {};

  for (const [key, kind] of [
    ['naics_codes', 'naics'],
    ['sic_codes', 'sic'],
  ] as const) {
    const raw = intent[key].slice(0, 6);
    if (raw.length === 0) continue;
    const [good, bad] = splitValid(kind, raw);
    if (good.length > 0) filters[key] = good;
    if (bad.length > 0) rejected[kind] = { codes: bad, hint: codeHint(kind) };
  }

  return { filters, rejected };
}

/**
 * The employer constraints, as company-search filters.
 *
 * Empty for a question that constrains nothing about the employer, which is the
 * common case and has to stay free: no employer constraint, no paid call.
 */
export function chatEmployerFilters(intent: Intent): CompanyFilters {
  const out: CompanyFilters = {};

  if (intent.industries.length > 0) out.industries = intent.industries.slice(0, 6);
  if (intent.technologies.length > 0) out.technologies = intent.technologies.slice(0, 6);
  if (intent.company_locations.length > 0) {
    // The company search calls the HQ filter "locations"; the people search
    // calls the same thing "company_locations". This dict is for the company call.
    out.locations = intent.company_locations.slice(0, 4);
  }

  for (const key of ['employee_min', 'employee_max', 'revenue_min', 'revenue_max'] as const) {
    const n = intOrNull(intent[key]);
    if (n !== null) out[key] = n;
  }

  return out;
}

/** Does anything about this question constrain the employer? */
export function hasEmployerConstraints(filters: CompanyFilters): boolean {
  return Object.keys(filters).length > 0;
}

/**
 * Words that point back at a company named earlier in the conversation.
 *
 * "do they have a CFO", "is it in healthcare", "who works there" are all still
 * about the pinned company, so they must not trip the population guard below.
 *
 * **"there" is only counted in the phrasings where it means "at that company".**
 * English also uses it as a bare placeholder, and "are there any healthcare
 * companies in Texas" is exactly the question this guard exists to let through:
 * reading that "there" as a reference would put the previous company straight
 * back on the search.
 */
export const CHAT_BACKREF =
  /\b(they|them|their|theirs|it|its)\b|\b(that|this|the|the same) (company|firm|org|organisation|organization)\b|\b(work|works|working|worked|else|anyone|anybody|employed) there\b/i;

/**
 * Does this message itself name that company?
 *
 * Compared as a **contiguous run of normalised tokens**, not as a substring: the
 * normaliser strips "co" and "company" to a bare token, and a substring test
 * would then read "co" out of the middle of "coffee" and conclude somebody had
 * named a company they never mentioned.
 *
 * Several names are accepted because the parser rewrites what was typed — a
 * corrected spelling, an expanded abbreviation — and only the verbatim string is
 * in the message.
 */
export function namesCompany(message: string, ...names: (string | null | undefined)[]): boolean {
  const haystack = normName(message).split(' ').filter(Boolean);
  if (haystack.length === 0) return false;

  for (const name of names) {
    const want = normName(name).split(' ').filter(Boolean);
    if (want.length === 0) continue;
    for (let i = 0; i + want.length <= haystack.length; i += 1) {
      if (want.every((w, j) => haystack[i + j] === w)) return true;
    }
  }
  return false;
}

/**
 * Is this question about a SET of companies rather than about one company?
 *
 * An industry, a technology, an HQ, a size band, a revenue band or a
 * classification code describes companies by attribute. Nobody asks for
 * "healthcare companies in Texas" and means the one company they were reading
 * about a moment ago, so a company carried over from an earlier turn has to be
 * dropped when this is true. Otherwise the earlier company silently becomes the
 * entire search — which is the bug this exists to prevent: "list VPs of Sales at
 * healthcare companies in Texas" answered "nobody in sales at Snowflake",
 * because Snowflake was still pinned from the question before it.
 *
 * `person_locations` is deliberately **not** counted. It constrains where the
 * PEOPLE are, not which companies they work for, so "any of them in Texas?" is a
 * legitimate follow-up about the company already being discussed.
 */
export function asksAboutAPopulation(intent: Intent): boolean {
  if (hasEmployerConstraints(chatEmployerFilters(intent))) return true;
  return Object.keys(chatCodes(intent).filters).length > 0;
}

/**
 * The companies that genuinely match, and why the others did not.
 *
 * One paid company search, then the same verification the results grid runs — so
 * a company matched on its NAME containing the industry word is dropped here
 * instead of being reported as an answer.
 */
export async function companyScope(
  supabase: Client,
  employer: CompanyFilters,
  apiKey: string,
  spend: Spend,
): Promise<{ orgs: ApolloRecord[]; rejected: Record<string, number> }> {
  /*
   * Two pages' worth asked for, one page's worth kept: the verification below
   * drops rows, and asking for exactly the cap would leave a short list every
   * time the relevance match brought back companies in other industries.
   */
  const meta: SearchMeta = {};
  const orgs = await searchCompanies({ ...employer }, apiKey, {
    perPage: Math.min(CHAT_SCOPE_MAX * 2, 100),
    strict: true,
    meta,
  });

  // Billed on what Apollo served, not on what survived our own industry check:
  // a search that returned twenty companies and kept none still cost a credit.
  if ((meta.returned ?? orgs.length) > 0) {
    // Billed per call, not per company, and nothing at all for an empty result.
    spend.credits += 1;
    // Every paid record teaches the pickers one more value Apollo genuinely uses.
    await learnFrom(supabase, orgs);
  }

  const verified = verifyRows(orgs, employer as VerifyFilters, false);
  return { orgs: verified.kept.slice(0, CHAT_SCOPE_MAX) as ApolloRecord[], rejected: verified.dropped };
}

/** "200 to 500", "under 50", "1000 or more", or "" for no bounds at all. */
export function rangeWords(lo: unknown, hi: unknown): string {
  const a = lo === null || lo === undefined || lo === '' ? null : lo;
  const b = hi === null || hi === undefined || hi === '' ? null : hi;
  if (a !== null && b !== null) return `${a} to ${b}`;
  if (a !== null) return `${a} or more`;
  if (b !== null) return `up to ${b}`;
  return '';
}

/**
 * The employer constraints in plain words, so the answer can say which ones it
 * applied instead of leaving the reader to assume all of them were.
 */
export function constraintNote(employer: CompanyFilters): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, label] of [
    ['industries', 'industry'],
    ['technologies', 'technology'],
    ['locations', 'headquarters'],
  ] as const) {
    const values = employer[key];
    if (Array.isArray(values) && values.length > 0) out[label] = values.map(String).join(', ');
  }

  const size = rangeWords(employer.employee_min, employer.employee_max);
  if (size) out.employees = size;

  const revenue = rangeWords(employer.revenue_min, employer.revenue_max);
  if (revenue) out['annual revenue'] = `$${revenue.replace(' to ', ' to $')}`;

  return out;
}

/** `{reason: n}` in the words the reader gets, biggest reason first. */
export function rejectNote(rejected: Record<string, number>): Record<string, number> {
  const pairs = Object.entries(rejected ?? {})
    .filter(([, n]) => n)
    .map(([k, n]) => [VERIFY_LABELS[k] ?? k, n] as const)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  return Object.fromEntries(pairs);
}

/**
 * Constraint values that are not in any vocabulary Apollo is known to use.
 *
 * Only consulted when a constrained question found **no** companies at all,
 * because that is the moment the two possible explanations diverge and matter:
 * "no company on file is like that" is a fact about the world, and "that is not
 * a value the vendor has" is a fact about the request. Measured on a live
 * account, an invented technology and an invented place both return zero and
 * look identical from here — so a model writing "SFDC" produced an answer that
 * read as though nobody uses Salesforce.
 *
 * Absence from these lists is a **hint, never a verdict**: the seeds are not
 * exhaustive, which is why the wording this feeds says the value could not be
 * confirmed rather than that it does not exist.
 */
export async function unknownVocabValues(
  supabase: Client,
  employer: CompanyFilters,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  for (const [key, kind, label] of [
    ['technologies', 'technology', 'technology'],
    ['locations', 'location', 'headquarters'],
  ] as const) {
    const values = (employer[key] ?? []).map(String).filter(Boolean);
    if (values.length === 0) continue;

    // Read once per kind rather than once per value: the learned list is the
    // same for all of them, and this runs on a path that is already slow.
    const learned = await readLearnedVocab(supabase, kind);

    const odd: string[] = [];
    for (const value of values) {
      const known = suggestVocab(kind, value, { learned, limit: 5 });
      if (!known.some((e) => vocabNorm(e.value) === vocabNorm(value))) odd.push(value);
    }
    if (odd.length > 0) out[label] = odd.slice(0, 4).join(', ');
  }

  const industries = (employer.industries ?? []).map(String).filter(Boolean);
  if (industries.length > 0) {
    const unmapped = industries.filter((i) => industriesFor(i).length === 0);
    if (unmapped.length > 0) out.industry = unmapped.slice(0, 4).join(', ');
  }

  return out;
}
