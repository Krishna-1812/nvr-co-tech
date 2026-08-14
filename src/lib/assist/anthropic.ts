import {
  ANTHROPIC_BASE_URL,
  MAX_OUTPUT_TOKENS,
  MAX_TOOL_ROUNDS,
  MODEL,
  REQUEST_TIMEOUT_MS,
  apiKey,
} from './config';
import { describeApiFailure, describeStopReason, describeTransportFailure, NO_KEY } from './errors';
import { createSseParser, parsePayloads } from './sse';
import { toolByName, toolSchemas } from './tools';
import type { AssistEvent, ToolTrace } from './types';

/**
 * Talking to the model.
 *
 * This file reads the API key, and only the route handler imports it. It does
 * not carry a `server-only` guard, because the guarantee that matters is
 * already stronger than one: `ANTHROPIC_API_KEY` has no NEXT_PUBLIC_ prefix, so
 * Next replaces it with undefined in anything that reaches the browser. The key
 * cannot end up in a bundle even if somebody imports this from the wrong place.
 * Leaving the module importable is what lets the tool loop below be tested.
 *
 * Everything above this file is provider-agnostic: retrieval, the prompt, the
 * tools, the event stream, the markdown and the whole interface do not know or
 * care whose API answers a question. This is the only file that does.
 */

/** One turn of the conversation, as everything above this file thinks of it. */
export type Turn = { role: 'user' | 'assistant'; content: string };

type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
type ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/** A message in the conversation, in the shape the API takes it. */
type Message = { role: 'user' | 'assistant'; content: string | (ToolUseBlock | ToolResultBlock)[] };

type PendingCall = { id: string; name: string; args: Record<string, unknown> };

type Round = { calls: PendingCall[]; stop: string | null };

/**
 * One streamed event, in the small part of Anthropic's shape this code reads.
 *
 * A tool call's arguments do not arrive as one object. They stream as
 * fragments of JSON text against the `content_block` they belong to, and are
 * only ever complete once `content_block_stop` closes that block. That is why
 * the calls below are assembled in a map keyed by `index` rather than read
 * straight off the event.
 */
type StreamEvent =
  | { type: 'message_start' }
  | { type: 'content_block_start'; index: number; content_block: { type: string; id?: string; name?: string } }
  | { type: 'content_block_delta'; index: number; delta: { type: string; text?: string; partial_json?: string } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason?: string } }
  | { type: 'message_stop' }
  | { type: 'ping' }
  | { type: 'error'; error?: { message?: string } };

function requestBody(instructions: string, messages: Message[]) {
  return {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: instructions,
    messages,
    tools: toolSchemas(),
    stream: true,
  };
}

/** A failure already turned into a sentence for the reader. */
export class AssistFailure extends Error {}

/** Anthropic sends how long to wait as a response header, not in the body. */
function retryAfterSeconds(response: Response): number | null {
  const header = response.headers.get('retry-after');
  const seconds = header ? Number(header) : NaN;
  return Number.isFinite(seconds) ? Math.ceil(seconds) : null;
}

/**
 * One request, streamed.
 *
 * Yields the visible text as it is written and collects any tool calls, which
 * are returned rather than yielded: the caller cannot act on a call until the
 * request has finished, because the model may ask for several and they all
 * arrive in one reply.
 */
async function* streamOnce(
  instructions: string,
  messages: Message[],
  signal: AbortSignal,
): AsyncGenerator<{ text: string }, Round> {
  const key = apiKey();
  if (!key) throw new AssistFailure(NO_KEY);

  let response: Response;
  try {
    response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: 'POST',
      // The key goes in a header, not in the query string, so it cannot end up
      // in an access log or a referrer.
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody(instructions, messages)),
      signal,
    });
  } catch (error) {
    throw new AssistFailure(describeTransportFailure(error));
  }

  if (!response.ok || !response.body) {
    // The failure body is JSON in every case that matters and HTML in the ones
    // that do not, so a parse failure is itself information and is passed on as
    // null rather than thrown.
    const body = await response.json().catch(() => null);
    throw new AssistFailure(describeApiFailure(response.status, body, retryAfterSeconds(response)));
  }

  const parser = createSseParser();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();

  const blocks = new Map<number, { type: string; id?: string; name?: string; json: string }>();
  const calls: PendingCall[] = [];
  let stop: string | null = null;

  try {
    for (;;) {
      const { done, value } = await reader.read();

      const payloads = done
        ? parser.flush()
        : parser.push(decoder.decode(value, { stream: true }));

      for (const event of parsePayloads(payloads) as StreamEvent[]) {
        if (event.type === 'error') {
          throw new AssistFailure(
            event.error?.message
              ? `The model stopped: ${event.error.message}`
              : 'The model stopped partway through that answer.',
          );
        }

        if (event.type === 'content_block_start') {
          blocks.set(event.index, {
            type: event.content_block.type,
            id: event.content_block.id,
            name: event.content_block.name,
            json: '',
          });
          continue;
        }

        if (event.type === 'content_block_delta') {
          const block = blocks.get(event.index);
          if (!block) continue;

          if (event.delta.type === 'text_delta' && typeof event.delta.text === 'string') {
            yield { text: event.delta.text };
          }

          if (event.delta.type === 'input_json_delta' && typeof event.delta.partial_json === 'string') {
            block.json += event.delta.partial_json;
          }
          continue;
        }

        if (event.type === 'content_block_stop') {
          const block = blocks.get(event.index);
          if (block?.type === 'tool_use' && block.id && block.name) {
            let args: Record<string, unknown> = {};
            try {
              // An empty input arrives as an empty string here, not as "{}".
              const parsed = block.json ? JSON.parse(block.json) : {};
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed;
            } catch {
              // Malformed JSON from the model is treated as no arguments at
              // all, which the tool itself already reports as missing fields
              // rather than this code throwing over it.
            }
            calls.push({ id: block.id, name: block.name, args });
          }
          continue;
        }

        if (event.type === 'message_delta' && event.delta.stop_reason) {
          stop = event.delta.stop_reason;
        }
      }

      if (done) break;
    }
  } finally {
    // Abandoning a stream without this leaves the connection open until it
    // times out, which on a page somebody navigates away from is every
    // request.
    reader.cancel().catch(() => {});
  }

  return { calls, stop };
}

/**
 * The whole answer, including any tools it needs on the way.
 *
 * The loop is: ask, and if the model asked for tools, run them, append both the
 * request and the result to the conversation, and ask again. It ends when a
 * round comes back with no tool calls, which is the round that contains the
 * answer.
 *
 * Tools are run here rather than by the model, obviously, but the important part
 * is that their results are appended verbatim. The model is not told what the
 * answer is; it is told what the function returned, and it has to write the
 * sentence around it.
 */
export async function* runAssist(
  instructions: string,
  turns: Turn[],
  outerSignal?: AbortSignal,
): AsyncGenerator<AssistEvent> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  outerSignal?.addEventListener('abort', onAbort);

  const messages: Message[] = turns.map((turn) => ({ role: turn.role, content: turn.content }));

  let wroteSomething = false;
  let lastStop: string | null = null;

  try {
    /*
     * One extra round beyond the tool budget. The budget is on rounds that may
     * run tools; the extra one is the model's chance to answer having been told
     * it has none left. Without it, exhausting the budget ends the answer
     * mid-thought, which is the one outcome worse than a slow one.
     */
    for (let round = 0; round <= MAX_TOOL_ROUNDS + 1; round++) {
      const stream = streamOnce(instructions, messages, controller.signal);

      let result = await stream.next();
      while (!result.done) {
        wroteSomething = wroteSomething || result.value.text.trim().length > 0;
        yield { type: 'delta', text: result.value.text };
        result = await stream.next();
      }

      const { calls, stop } = result.value;
      lastStop = stop;
      if (calls.length === 0) break;

      const exhausted = round >= MAX_TOOL_ROUNDS;

      /*
       * Every call the model made goes back in one `assistant` turn, and every
       * result in one `user` turn after it. Splitting them into a turn each
       * would interleave calls and results, which the API rejects when the
       * model asked for several at once.
       */
      messages.push({
        role: 'assistant',
        content: calls.map((call) => ({ type: 'tool_use', id: call.id, name: call.name, input: call.args })),
      });

      const results: ToolResultBlock[] = [];

      for (const call of calls) {
        if (exhausted) {
          // Refused in the same channel a result would have arrived in, so the
          // model can see what happened and write around it.
          results.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content:
              'No more calculations are allowed for this question. Answer with what you already have, or say what you would still need.',
            is_error: true,
          });
          continue;
        }

        // `data` is what the model gets; the trace is what the reader gets. They
        // are separated here so the browser is never sent a payload it has no
        // use for and would have to be trusted not to render.
        const { data, ...trace } = runTool(call);
        yield { type: 'tool', trace };

        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify(trace.ok ? data : { error: trace.summary }),
          is_error: !trace.ok,
        });
      }

      messages.push({ role: 'user', content: results });
    }

    /*
     * An answer that ran out of room, or was cut off for some other reason, is
     * still worth reading. The note is appended to what was written rather than
     * replacing it.
     */
    const note = describeStopReason(lastStop);
    if (note) yield { type: 'delta', text: `\n\n*${note}*` };

    /*
     * A run that only ever asked for tools and never wrote a word. Rare, and it
     * has to say something: an empty answer is indistinguishable on screen from
     * one that is still arriving.
     */
    if (!wroteSomething && !note) {
      yield {
        type: 'delta',
        text: 'I could not get to an answer for that one. Try asking it a different way, or in smaller pieces.',
      };
    }

    yield { type: 'done' };
  } catch (error) {
    yield {
      type: 'error',
      message: error instanceof AssistFailure ? error.message : describeTransportFailure(error),
      note: 'error',
    };
  } finally {
    clearTimeout(timeout);
    outerSignal?.removeEventListener('abort', onAbort);
  }
}

/** The trace, plus the payload that goes back to the model. */
type RanTool = ToolTrace & { data: Record<string, unknown> };

/**
 * Run one call.
 *
 * Everything that can go wrong is turned into a result rather than an
 * exception: an unknown tool, or a tool that throws. The model gets told what
 * went wrong and can correct itself, which is a far better outcome than the
 * whole answer failing because it misspelled a field.
 */
function runTool(call: PendingCall): RanTool {
  const tool = toolByName(call.name);
  if (!tool) {
    return {
      name: call.name,
      label: call.name,
      args: {},
      summary: `There is no tool called ${call.name}.`,
      ok: false,
      data: {},
    };
  }

  try {
    const outcome = tool.run(call.args);
    return { name: tool.name, label: tool.label, args: call.args, ...outcome };
  } catch (error) {
    return {
      name: tool.name,
      label: tool.label,
      args: call.args,
      summary: error instanceof Error ? error.message : 'That calculation failed.',
      ok: false,
      data: {},
    };
  }
}
