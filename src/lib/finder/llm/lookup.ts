import { titleMatches } from '../taxonomy';
import { COMPANY_IDENTIFY_SYSTEM, RESEARCH_SYSTEM, ROLE_LOOKUP_SYSTEM } from './prompts';
import { call, citationsOf, extractJson, textOf, usedWebSearch } from './transport';
import { cleanUrl } from './urls';

/**
 * The three things only the live web can answer.
 *
 * Each has the same shape: search, then throw away anything that cannot be
 * checked. A model asserting from background knowledge who holds a role *today*
 * is precisely the stale-hallucination risk these exist to close, and it cannot
 * produce a URL a reader can go and look at — so **no web search means no claim,
 * never a guessed one.**
 */

/** How many searches one lookup may run. A cost control, and a latency one. */
const SEARCH_MAX_USES = 4;
const LOOKUP_TIMEOUT_MS = 45_000;
const RESEARCH_TIMEOUT_MS = 60_000;

export type RoleHolder = {
  name: string;
  title: string;
  source: string;
  as_of: string;
  note: string;
  /**
   * Whether the published title is actually the one that was asked for.
   *
   * Computed in code with the same matcher the grid uses, rather than by asking
   * the model to re-judge its own output. It is what lets an answer distinguish
   * "here is your CMO" from "there is no CMO, but here is the closest published
   * title", and those are very different sentences.
   */
  exact_title_match: boolean;
};

/**
 * Who publicly holds this title at this company, or null.
 *
 * Returns something only when the model came back with a specific person AND a
 * real http(s) source URL, so an answer can attribute it to something the reader
 * can check.
 */
export async function roleLookup(
  titles: readonly string[],
  companyName: string,
  domain = '',
): Promise<RoleHolder | null> {
  const wanted = titles.map((t) => String(t ?? '').trim()).filter(Boolean);
  const company = companyName.trim();
  if (wanted.length === 0 || !company) return null;

  const ask = `Who is the current ${wanted.slice(0, 3).join(' or ')} at ${company}${domain ? ` (${domain})` : ''}? Search the web and answer as strict JSON.`;

  let response;
  try {
    response = await call({
      system: ROLE_LOOKUP_SYSTEM,
      messages: [{ role: 'user', content: ask.slice(0, 1000) }],
      maxTokens: 900,
      timeoutMs: LOOKUP_TIMEOUT_MS,
      webSearchMaxUses: SEARCH_MAX_USES,
    });
  } catch (error) {
    console.warn(
      `finder: role lookup failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return null;
  }

  // No search ran, so whatever came back is memory rather than a finding.
  if (!usedWebSearch(response)) return null;

  const data = extractJson(textOf(response));
  if (!data?.found) return null;

  const name = String(data.name ?? '').trim();
  const foundTitle = String(data.title ?? '').trim();
  const source = String(data.source ?? '').trim();

  // A claim about a named person with no checkable source is the one thing this
  // must never pass onward, however confident the model sounded.
  if (!name || !/^https?:\/\//i.test(source)) {
    console.info(`finder: role lookup discarded (named=${Boolean(name)} sourced=${Boolean(source)})`);
    return null;
  }

  return {
    name: name.slice(0, 120),
    title: foundTitle.slice(0, 160),
    // Cleaned here, not only on the way out: the source travels into the answer
    // prompt as a fact, and a model handed a tagged URL faithfully reproduces
    // the tag in prose the outbound sweep cannot always attribute to a URL.
    source: cleanUrl(source).slice(0, 400),
    as_of: String(data.as_of ?? '').trim().slice(0, 60),
    note: String(data.note ?? '').trim().slice(0, 400),
    exact_title_match: titleMatches(foundTitle, wanted),
  };
}

export type IdentifiedCompany = { name: string; domain: string; source: string; note: string };

/**
 * Which real company somebody meant by the name they typed, or null.
 *
 * The domain is what makes this safe to act on: it is verified exactly against
 * the vendor's own record afterwards, so a wrong guess here fails to resolve
 * rather than answering about the wrong business.
 */
export async function identifyCompany(typed: string): Promise<IdentifiedCompany | null> {
  const name = typed.trim();
  if (!name) return null;

  let response;
  try {
    response = await call({
      system: COMPANY_IDENTIFY_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Which company did the user mean by "${name.slice(0, 200)}"? Search the web and answer as strict JSON.`,
        },
      ],
      maxTokens: 700,
      timeoutMs: LOOKUP_TIMEOUT_MS,
      webSearchMaxUses: SEARCH_MAX_USES,
    });
  } catch (error) {
    console.warn(
      `finder: company identify failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return null;
  }

  if (!usedWebSearch(response)) return null;

  const data = extractJson(textOf(response));
  if (!data?.found) return null;

  const identified = String(data.name ?? '').trim();
  const domain = String(data.domain ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');

  /*
   * A value that is not actually domain-shaped — "n/a", "unknown", a URL that
   * still has a path on it — is dropped rather than forwarded. The vendor's
   * domain filter is fuzzy, so feeding it a non-domain quietly returns an
   * unrelated company instead of failing.
   */
  const shaped = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain);
  if (!identified || !shaped) return null;

  return {
    name: identified.slice(0, 160),
    domain,
    source: cleanUrl(String(data.source ?? '').trim()).slice(0, 400),
    note: String(data.note ?? '').trim().slice(0, 400),
  };
}

export type Research = { text: string; sources: { title: string; url: string }[] };

/**
 * A research brief on whatever was asked.
 *
 * Runs alongside the vendor lookups rather than after them, because it is the
 * slowest step and it needs none of their output. Returns empty text rather than
 * throwing: an answer with records and no research is still an answer, and an
 * answer that failed because the web was slow is not.
 */
export async function research(question: string, note = ''): Promise<Research> {
  try {
    const response = await call({
      system: RESEARCH_SYSTEM,
      messages: [
        { role: 'user', content: `${question.slice(0, 1500)}${note ? `\n\n${note.slice(0, 600)}` : ''}` },
      ],
      maxTokens: 1400,
      timeoutMs: RESEARCH_TIMEOUT_MS,
      webSearchMaxUses: SEARCH_MAX_USES,
    });

    return { text: textOf(response), sources: citationsOf(response) };
  } catch (error) {
    console.warn(`finder: research failed: ${error instanceof Error ? error.message : 'unknown'}`);
    return { text: '', sources: [] };
  }
}
