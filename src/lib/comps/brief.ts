import { ANTHROPIC_BASE_URL, MODEL, apiKey } from '@/lib/assist/config';
import { describeApiFailure, describeTransportFailure, NO_KEY } from '@/lib/assist/errors';

/**
 * The company brief: one call to Anthropic, with web search, for one company.
 *
 * This is deliberately not `runAssist`. That function runs a client-side tool
 * loop — ask, run our own tool, hand back the result, ask again — because its
 * tools (`gst_split`, `tds_deduction`, ...) are ours to run. Web search is not:
 * `web_search_20250305` is a *server* tool, which means Anthropic runs the
 * search itself and hands back the finished turn, searches and citations and
 * all, inside one response. There is nothing here for this code to execute, so
 * there is nothing here for it to loop over — one request, not streamed, is
 * the whole shape.
 */

/** One citation the model actually used. */
export type Citation = { title: string; url: string };

export type CompanyBrief = {
  markdown: string;
  citations: Citation[];
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export class BriefFailure extends Error {}

/** How long a brief may take. Longer than a chat answer: search adds rounds
 *  Anthropic runs on its own side, and there is no partial answer to show
 *  while it does. */
const REQUEST_TIMEOUT_MS = 45_000;

/** The ceiling on one brief. Enough for four short sections, not a memo. */
const MAX_OUTPUT_TOKENS = 1_600;

/** How many searches the model may run for one brief. A cost control. */
const WEB_SEARCH_MAX_USES = 3;

const INSTRUCTIONS = `You are preparing a short research note on one company for a valuation reviewer inside a financial analysis tool.

You will be given verified figures for this company from the platform's own registry. Treat those as ground truth: never restate them differently, and never let a web search result override them. Use web search only for what the registry cannot carry — what the company actually does, how it makes money, what has happened to it recently, and how it is positioned against its competitors.

Write the note as markdown with exactly these four sections, in this order, using level-2 headings:

## Overview
## Recent developments
## Competitive position
## Key risks

Keep the whole note under 450 words. Write in plain, direct sentences — no filler, no hype, no price targets or investment advice. If a search turns up nothing substantive or recent, say so plainly in Recent developments rather than padding it with generic description.`;

type ContentBlock =
  | { type: 'text'; text: string; citations?: { url?: string; title?: string }[] }
  | { type: 'web_search_tool_result'; content?: { title?: string; url?: string }[] }
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

/**
 * One company, one brief.
 *
 * Not streamed, and not a tool loop: `web_search_20250305` is a server tool,
 * so the search happens on Anthropic's side and the response that comes back
 * already carries the finished text and its citations. There is nothing left
 * for this function to run.
 */
export async function generateCompanyBrief(company: CompanyContext): Promise<CompanyBrief> {
  const key = apiKey();
  if (!key) throw new BriefFailure(NO_KEY);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: INSTRUCTIONS,
        messages: [
          {
            role: 'user',
            content: `${dataBlock(company)}\n\nResearch this company with web search where it genuinely adds something, and write the note.`,
          },
        ],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES }],
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    throw new BriefFailure(describeTransportFailure(error));
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new BriefFailure(describeApiFailure(response.status, body, retryAfterSeconds(response)));
  }

  const data = (await response.json()) as MessagesResponse;
  const blocks = data.content ?? [];

  const markdown = blocks
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n')
    .trim();

  if (!markdown) {
    throw new BriefFailure('The model did not write anything for this company. Try again.');
  }

  const fromText = blocks
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .flatMap((b) => b.citations ?? [])
    .filter((c): c is { url: string; title?: string } => typeof c.url === 'string' && c.url.length > 0)
    .map((c) => ({ url: c.url, title: c.title || c.url }));

  const fromResults = blocks
    .filter((b): b is Extract<ContentBlock, { type: 'web_search_tool_result' }> => b.type === 'web_search_tool_result')
    .flatMap((b) => b.content ?? [])
    .filter((r): r is { url: string; title?: string } => typeof r.url === 'string' && r.url.length > 0)
    .map((r) => ({ url: r.url, title: r.title || r.url }));

  return {
    markdown,
    citations: dedupeCitations([...fromText, ...fromResults]),
    model: data.model ?? MODEL,
    inputTokens: data.usage?.input_tokens ?? null,
    outputTokens: data.usage?.output_tokens ?? null,
  };
}
