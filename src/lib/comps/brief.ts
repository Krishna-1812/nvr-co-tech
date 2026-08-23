import { ANTHROPIC_BASE_URL, MODEL, apiKey } from '@/lib/assist/config';
import { describeApiFailure, describeTransportFailure, NO_KEY } from '@/lib/assist/errors';

/**
 * The company brief: two calls to Anthropic, for one company.
 *
 * Two calls rather than one, and that split is the whole design. The first is
 * unconstrained and searches the web — `web_search_20250305` is a *server*
 * tool, so the search happens on Anthropic's side and the response that comes
 * back already carries the finished text and its citations, nothing here has
 * to loop over. But a model that is both searching the web and trying to hit
 * an exact JSON shape at the same time tends to do both worse than a model
 * doing one at a time — so the first call is left free to write plain research
 * notes, and a second, small, search-free call is *forced* (`tool_choice`) to
 * turn those notes into the structured shape the drawer renders. The second
 * call never touches the network beyond Anthropic, so it is fast and its
 * output is guaranteed to match the schema rather than hoped to.
 */

/** One citation the model actually used. */
export type Citation = { title: string; url: string };

export type Tone = 'positive' | 'neutral' | 'negative';
export type Severity = 'low' | 'medium' | 'high';

export type Highlight = { label: string; value: string };
export type Development = { title: string; detail: string; when: string; tone: Tone };
export type CompetitivePosition = { summary: string; strengths: string[]; challenges: string[] };
export type Risk = { risk: string; detail: string; severity: Severity };

/** The structured shape the drawer renders. Nothing here is free-form prose
 *  meant to be read as a document — every field is sized for a card, a tile
 *  or a list row. */
export type BriefContent = {
  overview: string;
  highlights: Highlight[];
  recentDevelopments: Development[];
  competitivePosition: CompetitivePosition;
  keyRisks: Risk[];
};

export type CompanyBrief = {
  content: BriefContent;
  citations: Citation[];
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export class BriefFailure extends Error {}

/** How long the research call may take. Search adds rounds Anthropic runs on
 *  its own side, and there is no partial answer to show while it does. */
const RESEARCH_TIMEOUT_MS = 45_000;

/** The structuring call does no search, so it is fast — this is a ceiling, not
 *  an expectation. */
const STRUCTURE_TIMEOUT_MS = 30_000;

/** Generous for a page of working notes. Not a polished memo — the second
 *  call is what turns this into something worth reading. */
const RESEARCH_MAX_TOKENS = 1_400;

/** A handful of short strings and arrays, not prose. */
const STRUCTURE_MAX_TOKENS = 1_400;

/** How many searches the model may run for one brief. A cost control. */
const WEB_SEARCH_MAX_USES = 4;

const RESEARCH_INSTRUCTIONS = `You are researching one company for a valuation reviewer inside a financial analysis tool. You will be given verified figures for it from the platform's own registry — treat those as ground truth, never restate them differently, and never let a web search result override them.

Use web search to find what the registry cannot carry:
- What the company actually does and how it makes money, in plain terms.
- Firmographic facts worth knowing at a glance: roughly when it was founded, where it is headquartered, its approximate employee count, its CEO or top leadership, and its best-known products or brands. Skip any of these you cannot find — do not guess.
- What has genuinely happened to it recently (product launches, leadership changes, litigation, M&A, regulatory action, notable results) — with a rough sense of when. If nothing recent and substantive turns up, say so plainly rather than padding this out with generic description.
- Who it competes with and how it is positioned against them — genuine strengths and genuine challenges, not a marketing summary.
- Real risks facing the business — operational, competitive, regulatory or financial. Not price risk or anything that reads as investment advice.

Write plain working notes covering all of the above. No markdown formatting, no headings needed — this text is read by another step, not by a person. Be concrete and specific; a fact with no source is worth less than admitting you found nothing.`;

const STRUCTURE_INSTRUCTIONS = `You turn research notes about a company into a structured brief by calling the emit_brief tool exactly once. Do not search the web — everything you need is in the notes you are given.

Rules for the fields:
- Plain prose only. No markdown syntax anywhere (no **, no bullet dashes, no headings) — every field is rendered inside its own card or list row, not as a document.
- Never invent a fact the notes do not support. An empty array or a short "not enough to say" sentence is correct when the notes have nothing — that is more honest than filling space.
- highlights: at most 6 short {label, value} facts a reader would want at a glance (e.g. Founded, Headquarters, Employees, CEO, Key products). Only include ones the notes actually support.
- recentDevelopments: at most 4 items, newest first, each a genuine event with a rough "when" (a month/year, quarter, or "Recent" if undated). tone is how a plain reader would read the event itself — positive, neutral or negative — never a stock call.
- competitivePosition: one short summary sentence or two, plus up to 4 genuine strengths and up to 4 genuine challenges.
- keyRisks: at most 4 real risks, each with a one-line detail and a severity (low, medium, high) reflecting how material it looks, not how likely.

Never give investment advice, a rating, or a price target anywhere.`;

type ContentBlock =
  | { type: 'text'; text: string; citations?: { url?: string; title?: string }[] }
  | { type: 'web_search_tool_result'; content?: { title?: string; url?: string }[] }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: string; [key: string]: unknown };

type MessagesResponse = {
  content?: ContentBlock[];
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/** What to hand the model about the company. Only known fields — an unknown
 *  figure is simply left out rather than sent as null, so the prompt reads
 *  like a briefing rather than a database dump. */
export type CompanyContext = {
  name: string;
  legalName?: string | null;
  country: string;
  listingStatus: string;
  industry?: string | null;
  sector?: string | null;
  businessDescription?: string | null;
  identifiers: Record<string, string>;
  financials: {
    periodEnd: string;
    basis: string;
    currency: string;
    revenue?: number | null;
    ebitda?: number | null;
    pat?: number | null;
  } | null;
  quote: {
    asOf: string;
    marketCap?: number | null;
    currency: string;
  } | null;
};

function dataBlock(company: CompanyContext): string {
  const lines: string[] = [
    `Name: ${company.name}`,
    ...(company.legalName && company.legalName !== company.name ? [`Legal name: ${company.legalName}`] : []),
    `Country: ${company.country}`,
    `Listing status: ${company.listingStatus}`,
    ...(company.industry ? [`Industry: ${company.industry}`] : []),
    ...(company.sector ? [`Sector: ${company.sector}`] : []),
  ];

  const ids = Object.entries(company.identifiers).filter(([, v]) => v);
  if (ids.length > 0) lines.push(`Identifiers: ${ids.map(([k, v]) => `${k} ${v}`).join(', ')}`);

  if (company.financials) {
    const f = company.financials;
    const figures = [
      f.revenue != null ? `revenue ${f.revenue.toLocaleString('en-IN')}` : null,
      f.ebitda != null ? `EBITDA ${f.ebitda.toLocaleString('en-IN')}` : null,
      f.pat != null ? `PAT ${f.pat.toLocaleString('en-IN')}` : null,
    ].filter(Boolean);
    lines.push(
      `Latest filed figures (${f.basis}, ${f.currency}, period ended ${f.periodEnd}): ${
        figures.length > 0 ? figures.join(', ') : 'none on file'
      }`,
    );
  } else {
    lines.push('Latest filed figures: none on file.');
  }

  if (company.quote?.marketCap != null) {
    lines.push(
      `Market capitalisation as of ${company.quote.asOf}: ${company.quote.marketCap.toLocaleString('en-IN')} ${company.quote.currency}`,
    );
  }

  if (company.businessDescription) {
    lines.push(`On file as its business description: ${company.businessDescription}`);
  }

  return lines.join('\n');
}

/** Collapse duplicate sources by URL, keeping the first title seen for it. */
function dedupeCitations(found: Citation[]): Citation[] {
  const byUrl = new Map<string, Citation>();
  for (const c of found) {
    if (c.url && !byUrl.has(c.url)) byUrl.set(c.url, c);
  }
  return [...byUrl.values()];
}

function retryAfterSeconds(response: Response): number | null {
  const header = response.headers.get('retry-after');
  const seconds = header ? Number(header) : NaN;
  return Number.isFinite(seconds) ? Math.ceil(seconds) : null;
}

/** One call to /messages. Shared by both steps so the timeout, abort and
 *  error-shaping logic exists exactly once. */
async function postMessages(body: Record<string, unknown>, timeoutMs: number, key: string): Promise<MessagesResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new BriefFailure(describeTransportFailure(error));
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new BriefFailure(describeApiFailure(response.status, errorBody, retryAfterSeconds(response)));
  }

  return (await response.json()) as MessagesResponse;
}

/** The schema `emit_brief` must match. Forcing `tool_choice` to this tool is
 *  what makes the second call's output guaranteed-shaped rather than hoped-for. */
const EMIT_BRIEF_TOOL = {
  name: 'emit_brief',
  description: 'Emit the finished, structured brief for this company. Call this exactly once.',
  input_schema: {
    type: 'object',
    properties: {
      overview: {
        type: 'string',
        description: '2-4 plain sentences: what the company does and how it makes money.',
      },
      highlights: {
        type: 'array',
        maxItems: 6,
        items: {
          type: 'object',
          properties: { label: { type: 'string' }, value: { type: 'string' } },
          required: ['label', 'value'],
        },
      },
      recentDevelopments: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            detail: { type: 'string' },
            when: { type: 'string' },
            tone: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          },
          required: ['title', 'detail', 'when', 'tone'],
        },
      },
      competitivePosition: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          strengths: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          challenges: { type: 'array', items: { type: 'string' }, maxItems: 4 },
        },
        required: ['summary', 'strengths', 'challenges'],
      },
      keyRisks: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            risk: { type: 'string' },
            detail: { type: 'string' },
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
          required: ['risk', 'detail', 'severity'],
        },
      },
    },
    required: ['overview', 'highlights', 'recentDevelopments', 'competitivePosition', 'keyRisks'],
  },
};

const isString = (v: unknown): v is string => typeof v === 'string';
const isTone = (v: unknown): v is Tone => v === 'positive' || v === 'neutral' || v === 'negative';
const isSeverity = (v: unknown): v is Severity => v === 'low' || v === 'medium' || v === 'high';

/**
 * Turn whatever `emit_brief` was called with (or whatever is sitting in the
 * database) into a `BriefContent` a reader can trust — dropping any item that
 * does not match its shape rather than letting one bad entry break the whole
 * card. The model is well-behaved against a forced schema, but this is the
 * same defensiveness `citationsOf` in the API route already applies, and it
 * is what protects the drawer from a shape that predates this one.
 */
export function parseBriefContent(raw: unknown): BriefContent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.overview)) return null;

  const highlights = Array.isArray(r.highlights)
    ? r.highlights
        .filter(
          (h): h is Highlight =>
            !!h && typeof h === 'object' && isString((h as Highlight).label) && isString((h as Highlight).value),
        )
        .slice(0, 6)
    : [];

  const recentDevelopments = Array.isArray(r.recentDevelopments)
    ? r.recentDevelopments
        .filter((d): d is Development => {
          if (!d || typeof d !== 'object') return false;
          const dev = d as Development;
          return isString(dev.title) && isString(dev.detail) && isString(dev.when) && isTone(dev.tone);
        })
        .slice(0, 4)
    : [];

  const cp = r.competitivePosition as Partial<CompetitivePosition> | undefined;
  const competitivePosition: CompetitivePosition = {
    summary: cp && isString(cp.summary) ? cp.summary : '',
    strengths: cp && Array.isArray(cp.strengths) ? cp.strengths.filter(isString).slice(0, 4) : [],
    challenges: cp && Array.isArray(cp.challenges) ? cp.challenges.filter(isString).slice(0, 4) : [],
  };

  const keyRisks = Array.isArray(r.keyRisks)
    ? r.keyRisks
        .filter((k): k is Risk => {
          if (!k || typeof k !== 'object') return false;
          const risk = k as Risk;
          return isString(risk.risk) && isString(risk.detail) && isSeverity(risk.severity);
        })
        .slice(0, 4)
    : [];

  return { overview: r.overview, highlights, recentDevelopments, competitivePosition, keyRisks };
}

/** One company, one brief: research, then structure. */
export async function generateCompanyBrief(company: CompanyContext): Promise<CompanyBrief> {
  const key = apiKey();
  if (!key) throw new BriefFailure(NO_KEY);

  const research = await postMessages(
    {
      model: MODEL,
      max_tokens: RESEARCH_MAX_TOKENS,
      system: RESEARCH_INSTRUCTIONS,
      messages: [
        {
          role: 'user',
          content: `${dataBlock(company)}\n\nResearch this company with web search where it genuinely adds something, and write your working notes.`,
        },
      ],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES }],
      stream: false,
    },
    RESEARCH_TIMEOUT_MS,
    key,
  );

  const researchBlocks = research.content ?? [];

  const notes = researchBlocks
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n')
    .trim();

  if (!notes) {
    throw new BriefFailure('The model did not find anything to say about this company. Try again.');
  }

  const fromText = researchBlocks
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .flatMap((b) => b.citations ?? [])
    .filter((c): c is { url: string; title?: string } => typeof c.url === 'string' && c.url.length > 0)
    .map((c) => ({ url: c.url, title: c.title || c.url }));

  const fromResults = researchBlocks
    .filter((b): b is Extract<ContentBlock, { type: 'web_search_tool_result' }> => b.type === 'web_search_tool_result')
    .flatMap((b) => b.content ?? [])
    .filter((r): r is { url: string; title?: string } => typeof r.url === 'string' && r.url.length > 0)
    .map((r) => ({ url: r.url, title: r.title || r.url }));

  const citations = dedupeCitations([...fromText, ...fromResults]);

  const structure = await postMessages(
    {
      model: MODEL,
      max_tokens: STRUCTURE_MAX_TOKENS,
      system: STRUCTURE_INSTRUCTIONS,
      messages: [
        {
          role: 'user',
          content: `${dataBlock(company)}\n\nResearch notes:\n${notes}`,
        },
      ],
      tools: [EMIT_BRIEF_TOOL],
      tool_choice: { type: 'tool', name: 'emit_brief' },
      stream: false,
    },
    STRUCTURE_TIMEOUT_MS,
    key,
  );

  const toolUse = (structure.content ?? []).find(
    (b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use' && b.name === 'emit_brief',
  );

  const content = toolUse ? parseBriefContent(toolUse.input) : null;
  if (!content) {
    throw new BriefFailure('The model could not put together a structured brief for this company. Try again.');
  }

  return {
    content,
    citations,
    model: structure.model ?? MODEL,
    inputTokens: (research.usage?.input_tokens ?? 0) + (structure.usage?.input_tokens ?? 0),
    outputTokens: (research.usage?.output_tokens ?? 0) + (structure.usage?.output_tokens ?? 0),
  };
}
