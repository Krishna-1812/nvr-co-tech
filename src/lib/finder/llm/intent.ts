import { MODEL } from '@/lib/assist/config';
import { INTENT_SYSTEM, INTENT_VERIFY_SYSTEM } from './prompts';
import { call, toolInputOf, type Message } from './transport';

/**
 * A sentence, turned into a search.
 *
 * This is the one model call in the whole tool that spends **no** vendor credits
 * — it reads a sentence and writes a filter set, and nothing has been fetched
 * yet. So it is the safe place to get intent parsing right, and the reason "Fill
 * filters" exists as its own button: somebody can watch what their words become
 * before anything is bought.
 */

/** Exactly what the parser may return. Nothing outside this list reaches a filter. */
export type Intent = {
  intent: 'person_at_company' | 'people_list' | 'company_info' | 'unclear';
  titles: string[];
  job_titles: string[];
  seniorities: string[];
  company_name: string;
  /** What the user actually wrote. Present only when the parser changed it. */
  company_name_typed: string;
  person_locations: string[];
  company_locations: string[];
  industries: string[];
  technologies: string[];
  technologies_all: string[];
  exclude_technologies: string[];
  market_segments: string[];
  naics_codes: string[];
  sic_codes: string[];
  employee_min: number | null;
  employee_max: number | null;
  revenue_min: number | null;
  revenue_max: number | null;
  keywords: string;
  email_status: string;
  wants_contact_info: boolean;
  wants_count: boolean;
  max_results: number;
};

export const EMPTY_INTENT: Intent = {
  intent: 'unclear',
  titles: [],
  job_titles: [],
  seniorities: [],
  company_name: '',
  company_name_typed: '',
  person_locations: [],
  company_locations: [],
  industries: [],
  technologies: [],
  technologies_all: [],
  exclude_technologies: [],
  market_segments: [],
  naics_codes: [],
  sic_codes: [],
  employee_min: null,
  employee_max: null,
  revenue_min: null,
  revenue_max: null,
  keywords: '',
  email_status: '',
  wants_contact_info: false,
  wants_count: false,
  max_results: 10,
};

const strings = { type: 'array', items: { type: 'string' } } as const;

/**
 * The schema the parse is forced into.
 *
 * A forced tool rather than "reply in JSON", so the shape is guaranteed rather
 * than hoped for and there is no fenced-code-block or stray-preamble case to
 * survive. Nothing here searches the web, so there is no conflict with the tool
 * slot.
 */
const EXTRACT_TOOL = {
  name: 'extract_intent',
  description: 'Emit the structured intent for this request. Call this exactly once.',
  input_schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['person_at_company', 'people_list', 'company_info', 'unclear'],
      },
      titles: strings,
      job_titles: strings,
      seniorities: {
        type: 'array',
        items: {
          type: 'string',
          // Closed here as well as in the prompt: the value set is
          // case-sensitive and fixed at the vendor, so a word outside it is
          // dropped downstream anyway and is better never emitted.
          enum: ['owner', 'founder', 'c_suite', 'vp', 'director', 'manager', 'senior', 'entry', 'intern'],
        },
      },
      company_name: { type: 'string' },
      company_name_typed: { type: 'string' },
      person_locations: strings,
      company_locations: strings,
      industries: strings,
      technologies: strings,
      technologies_all: strings,
      exclude_technologies: strings,
      market_segments: strings,
      naics_codes: strings,
      sic_codes: strings,
      employee_min: { type: ['integer', 'null'] },
      employee_max: { type: ['integer', 'null'] },
      revenue_min: { type: ['integer', 'null'] },
      revenue_max: { type: ['integer', 'null'] },
      keywords: { type: 'string' },
      email_status: { type: 'string', enum: ['', 'verified', 'unavailable'] },
      wants_contact_info: { type: 'boolean' },
      wants_count: { type: 'boolean' },
      max_results: { type: 'integer' },
    },
    required: ['intent'],
  },
} as const;

const list = (v: unknown, cap = 12): string[] =>
  Array.isArray(v)
    ? [...new Set(v.map((x) => String(x ?? '').trim()).filter(Boolean))].slice(0, cap)
    : [];

const text = (v: unknown, cap: number): string => String(v ?? '').trim().slice(0, cap);

/**
 * A bound, or nothing.
 *
 * The empty cases are checked before the conversion, and that is the whole
 * point: `Number(null)` and `Number('')` are both **0**, so the obvious version
 * of this turns "no upper bound" into "at most zero employees" — a filter that
 * quietly empties every search it touches while looking like a number somebody
 * asked for.
 */
const int = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

/**
 * Whatever the model emitted, narrowed to the shape above.
 *
 * Exported because it is worth testing without a network call, and because the
 * reviewer's output goes through it too: a corrected parse is no more trusted
 * than the original one.
 */
export function normalizeIntent(raw: unknown): Intent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const kind = String(r.intent ?? '');

  return {
    intent:
      kind === 'person_at_company' || kind === 'people_list' || kind === 'company_info'
        ? kind
        : 'unclear',
    titles: list(r.titles),
    job_titles: list(r.job_titles),
    seniorities: list(r.seniorities, 9),
    company_name: text(r.company_name, 160),
    company_name_typed: text(r.company_name_typed, 160),
    person_locations: list(r.person_locations),
    company_locations: list(r.company_locations),
    industries: list(r.industries),
    technologies: list(r.technologies),
    technologies_all: list(r.technologies_all),
    exclude_technologies: list(r.exclude_technologies),
    market_segments: list(r.market_segments),
    naics_codes: list(r.naics_codes),
    sic_codes: list(r.sic_codes),
    employee_min: int(r.employee_min),
    employee_max: int(r.employee_max),
    revenue_min: int(r.revenue_min),
    revenue_max: int(r.revenue_max),
    keywords: text(r.keywords, 200),
    email_status:
      r.email_status === 'verified' || r.email_status === 'unavailable' ? r.email_status : '',
    wants_contact_info: Boolean(r.wants_contact_info),
    wants_count: Boolean(r.wants_count),
    max_results: Math.max(1, Math.min(int(r.max_results) ?? 10, 100)),
  };
}

const INTENT_TIMEOUT_MS = 30_000;

/** One sentence, plus whatever came before it, read into an intent. */
export async function parseIntent(question: string, history: Message[] = []): Promise<Intent> {
  const response = await call({
    system: INTENT_SYSTEM,
    // The conversation goes in as real turns rather than as a pasted transcript,
    // because the prompt's rules about carrying a company forward are written in
    // terms of "the latest message" and "the turn before".
    messages: [...history.slice(-8), { role: 'user', content: question.slice(0, 2000) }],
    maxTokens: 900,
    timeoutMs: INTENT_TIMEOUT_MS,
    tool: EXTRACT_TOOL,
  });

  return normalizeIntent(toolInputOf(response, EXTRACT_TOOL.name));
}

/**
 * A second read of the same request, checking the first.
 *
 * **Best-effort by design.** No key, a network failure, a reply that does not
 * call the tool: every one of them returns the original intent untouched. A
 * second opinion this function cannot obtain is exactly the same as not having
 * one, and never a reason to break the first answer.
 *
 * `history` matters more here than anywhere else. Without it, a field correctly
 * left blank because an earlier turn supplied it — a pinned company, a carried
 * title — reads to the reviewer as a dropped field and gets "corrected" into
 * something wrong. Fill filters deliberately passes none, because it has none.
 */
export async function verifyIntent(
  question: string,
  intent: Intent,
  history: Message[] = [],
): Promise<Intent> {
  try {
    const response = await call({
      system: INTENT_VERIFY_SYSTEM,
      messages: [
        ...history.slice(-8),
        {
          role: 'user',
          content: `Request: ${question.slice(0, 2000)}\n\nThe other model's extraction:\n${JSON.stringify(intent, null, 2)}`,
        },
      ],
      maxTokens: 900,
      timeoutMs: INTENT_TIMEOUT_MS,
      tool: EXTRACT_TOOL,
      /*
       * A different model where one is configured. On this platform the reviewer
       * defaults to the same model as the parser, which is weaker than the
       * cross-vendor check this is ported from — see the note on the prompt.
       */
      model: process.env.FINDER_VERIFY_MODEL?.trim() || MODEL,
    });

    const raw = toolInputOf(response, EXTRACT_TOOL.name);
    if (!raw || typeof raw !== 'object') return intent;
    return normalizeIntent(raw);
  } catch (error) {
    console.warn(
      `finder: intent review unavailable, keeping the first parse: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return intent;
  }
}

// ─── Intent to filter panel ──────────────────────────────────────────────────

/**
 * Seniority words dressed up as keywords.
 *
 * A backstop in code for the prompt's most expensive failure: the vendor's
 * keyword parameter is a **literal** text match, so nobody's title reads "top
 * executives", and ANDed against a correct seniority filter such a keyword
 * guarantees zero rows rather than narrowing anything. Reported live: a request
 * for "top executives in tech in san francisco" produced the right seniorities
 * AND the keyword, and the keyword alone emptied the search.
 */
const GENERIC_KEYWORD_PHRASES = new Set([
  'top executives',
  'executives',
  'senior executives',
  'decision makers',
  'decision-makers',
  'key decision makers',
  'leadership',
  'leadership team',
  'senior leaders',
  'senior leadership',
  'senior management',
  'management',
  'managers',
  'leaders',
  'key stakeholders',
  'stakeholders',
  'c-suite',
  'c suite',
  'csuite',
  'top management',
  'top brass',
]);

/**
 * Only the keys the filter panel actually has a control for.
 *
 * The parser answers a chat question and carries chat-shaped fields too — an
 * intent name, a max_results, whether contact details were asked for. Passing
 * those through would set filters somebody cannot see, which is the one thing
 * this must never do.
 */
const PANEL_KEYS = [
  'titles',
  'seniorities',
  'industries',
  'keywords',
  'person_locations',
  'company_locations',
  'technologies',
  'technologies_all',
  'exclude_technologies',
  'naics_codes',
  'sic_codes',
  'market_segments',
  'job_titles',
  'email_status',
] as const;

const NUMERIC_KEYS = ['employee_min', 'employee_max', 'revenue_min', 'revenue_max'] as const;

/** An intent, narrowed to values the filter panel can show. */
export function filtersFromIntent(intent: Intent): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const key of PANEL_KEYS) {
    const value = intent[key];
    if (Array.isArray(value)) {
      if (value.length > 0) out[key] = value;
    } else if (typeof value === 'string' && value.trim()) {
      out[key] = value.trim();
    }
  }

  const kw = out.keywords;
  if (typeof kw === 'string' && GENERIC_KEYWORD_PHRASES.has(kw.toLowerCase())) {
    delete out.keywords;
  }

  for (const key of NUMERIC_KEYS) {
    const value = intent[key];
    if (typeof value === 'number') out[key] = value;
  }

  /*
   * The company goes into the domain field, which accepts a name as well as a
   * domain and resolves it. Sent as typed rather than guessed at: the resolver
   * hands back a choice list when a name is ambiguous, which is a better answer
   * than a filter quietly scoped to the wrong business.
   */
  if (intent.company_name) out.company_domains = [intent.company_name];

  return out;
}
