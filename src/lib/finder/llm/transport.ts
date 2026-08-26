import { ANTHROPIC_BASE_URL, MODEL, apiKey } from '@/lib/assist/config';

/**
 * One way to reach the model, for all six of this tool's prompts.
 *
 * ── A deliberate departure from the tool this is ported from ───────────────
 *
 * The original ran a chain of OpenAI models strongest-first, with an effort
 * ladder, a reasoning-token floor and a per-process dead-model list, and then
 * had **Claude** review the parse. Three quarters of that machinery existed to
 * survive a model chain, and this platform does not have one: it holds a single
 * Anthropic key, already configured for the assistant, and every other
 * model-backed feature here reads the same three constants. Reproducing a
 * fallback chain over one provider would be scaffolding around a building that
 * is not there.
 *
 * What is genuinely lost is the cross-provider second opinion, and that is worth
 * naming rather than papering over. See `verifyIntent`, which keeps the second
 * call and says exactly what it is now worth.
 *
 * ── Why the model is asked for JSON through a tool ─────────────────────────
 *
 * Where the shape matters, the call forces a tool with `tool_choice`, so the
 * output is guaranteed-shaped rather than hoped-for. Where the model must also
 * search the web, it is left to write prose and a separate call structures it:
 * a model doing both at once does both worse. This is the same two-call split
 * the company brief uses, for the same reason.
 */

export class LlmFailure extends Error {}

/** Whether there is a key to call with at all. */
export const llmConfigured = (): boolean => apiKey() !== null;

export const NO_MODEL_KEY =
  'This environment has no model key configured, so nothing could be read or written by one.';

export type ContentBlock =
  | { type: 'text'; text: string; citations?: { url?: string; title?: string }[] }
  | { type: 'web_search_tool_result'; content?: { title?: string; url?: string }[] }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: string; [key: string]: unknown };

export type MessagesResponse = {
  content?: ContentBlock[];
  model?: string;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export type Message = { role: 'user' | 'assistant'; content: string };

export type CallOptions = {
  system: string;
  messages: Message[];
  maxTokens: number;
  timeoutMs: number;
  /** Force this tool, and take its input as the answer. */
  tool?: { name: string; description: string; input_schema: Record<string, unknown> };
  /** Let the model search the web, at most this many times. */
  webSearchMaxUses?: number;
  /** Overrides the shared model. Used by the reviewer, and nowhere else. */
  model?: string;
};

async function post(options: CallOptions, key: string): Promise<MessagesResponse> {
  const body: Record<string, unknown> = {
    model: options.model ?? MODEL,
    max_tokens: options.maxTokens,
    system: options.system,
    messages: options.messages,
    stream: false,
  };

  if (options.tool) {
    body.tools = [options.tool];
    body.tool_choice = { type: 'tool', name: options.tool.name };
  } else if (options.webSearchMaxUses) {
    body.tools = [
      { type: 'web_search_20250305', name: 'web_search', max_uses: options.webSearchMaxUses },
    ];
  }

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
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    throw new LlmFailure(
      error instanceof Error && error.name === 'TimeoutError'
        ? 'The model took too long to answer.'
        : 'The model could not be reached.',
    );
  }

  if (!response.ok) {
    // The body is worth one log line and nothing more: it can carry the prompt
    // back, and the prompt can carry a company name somebody typed.
    console.warn(`finder: model answered ${response.status}`);
    throw new LlmFailure(
      response.status === 429
        ? 'The model is rate limited right now. Try again in a moment.'
        : `The model answered ${response.status}.`,
    );
  }

  return (await response.json()) as MessagesResponse;
}

/** The plain text of a reply, with every text block joined. */
export function textOf(response: MessagesResponse): string {
  return (response.content ?? [])
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n')
    .trim();
}

/** The forced tool's input, or null if the model did not call it. */
export function toolInputOf(response: MessagesResponse, name: string): unknown {
  const use = (response.content ?? []).find(
    (b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use' && b.name === name,
  );
  return use ? use.input : null;
}

/** Whether the model actually ran a web search, rather than answering from memory. */
export function usedWebSearch(response: MessagesResponse): boolean {
  return (response.content ?? []).some((b) => b.type === 'web_search_tool_result');
}

export type Citation = { title: string; url: string };

/** Every source the reply cited or read, de-duplicated by URL. */
export function citationsOf(response: MessagesResponse): Citation[] {
  const blocks = response.content ?? [];

  const fromText = blocks
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .flatMap((b) => b.citations ?? []);

  const fromResults = blocks
    .filter(
      (b): b is Extract<ContentBlock, { type: 'web_search_tool_result' }> =>
        b.type === 'web_search_tool_result',
    )
    .flatMap((b) => b.content ?? []);

  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of [...fromText, ...fromResults]) {
    const url = typeof c.url === 'string' ? c.url : '';
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title: c.title || url });
  }
  return out;
}

/**
 * One call.
 *
 * Throws `LlmFailure` on every failure path, including no key. Callers decide
 * what a failure means to them: for the parse it means falling back to the
 * user's raw words, for the reviewer it means keeping the first answer, and for
 * the answer itself it means saying nothing rather than guessing.
 */
export async function call(options: CallOptions): Promise<MessagesResponse> {
  const key = apiKey();
  if (!key) throw new LlmFailure(NO_MODEL_KEY);
  return post(options, key);
}

/**
 * The first JSON object in a reply, or null.
 *
 * Needed only where the model writes prose — a web-searching call cannot also be
 * forced to a tool — so a reply can arrive fenced in a code block, prefixed with
 * a sentence, or trailed by a citation list. Parsing the whole string throws on
 * all three.
 */
export function extractJson(text: string): Record<string, unknown> | null {
  const s = String(text ?? '').trim();
  if (!s) return null;

  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(s.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
