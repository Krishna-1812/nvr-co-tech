import {
  MAX_OUTPUT_TOKENS,
  MAX_TOOL_ROUNDS,
  MODEL,
  OPENAI_BASE_URL,
  REASONING_EFFORT,
  REQUEST_TIMEOUT_MS,
  apiKey,
} from './config';
import { describeApiFailure, describeTransportFailure, NO_KEY } from './errors';
import { createSseParser, parsePayloads } from './sse';
import { toolByName, toolSchemas } from './tools';
import type { AssistEvent, ToolTrace } from './types';

/**
 * Talking to the model.
 *
 * This file reads the API key, and only the route handler imports it. It does
 * not carry a `server-only` guard, because the guarantee that matters is
 * already stronger than one: `OPENAI_API_KEY` has no NEXT_PUBLIC_ prefix, so
 * Next replaces it with undefined in anything that reaches the browser. The key
 * cannot end up in a bundle even if somebody imports this from the wrong place.
 * Leaving the module importable is what lets the tool loop below be tested.
 *
 * The Responses API is used rather than chat completions, because tool calls,
 * streaming and the reasoning models all live there now. Nothing is stored at
 * OpenAI (`store: false`), which means the whole conversation is resent on each
 * round of the tool loop instead of being referred to by id. That is the correct
 * trade here: these are questions about somebody's books, and the alternative is
 * leaving them on a third party's servers to save re-sending a few kilobytes.
 */

/** One item in the model's input list. */
export type InputItem =
  | { role: 'user' | 'assistant' | 'developer'; content: string }
  | { type: 'function_call'; call_id: string; name: string; arguments: string }
  | { type: 'function_call_output'; call_id: string; output: string };

type PendingCall = { call_id: string; name: string; arguments: string };

/** What one streamed request produced. */
type Round = {
  /** Function calls the model asked for, in the order it asked. */
  calls: PendingCall[];
};

/**
 * Everything the model can send back that this code acts on.
 *
 * Narrowed by hand rather than by a generated client, because the interesting
 * property is what happens to an event this does not recognise: it is ignored.
 * The API adds event types, and an assistant that fell over when it met one
 * would break on a day nobody deployed anything.
 */
type StreamEvent = {
  type?: unknown;
  delta?: unknown;
  message?: unknown;
  item?: { type?: unknown; call_id?: unknown; name?: unknown; arguments?: unknown };
  response?: {
    error?: { message?: unknown } | null;
    incomplete_details?: { reason?: unknown } | null;
  };
};

function requestBody(instructions: string, input: InputItem[]) {
  return {
    model: MODEL,
    instructions,
    input,
    tools: toolSchemas(),
    tool_choice: 'auto',
    stream: true,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    // Nothing about this conversation is kept at OpenAI.
    store: false,
    /*
     * Only sent when somebody has set it. The reasoning parameter has moved
     * between model families more than once, and a field the chosen model does
     * not accept is a 400 rather than a slightly different answer. Absent is
     * always valid and means "whatever this model does by default".
     */
    ...(REASONING_EFFORT ? { reasoning: { effort: REASONING_EFFORT } } : {}),
  };
}

/**
 * One request, streamed.
 *
 * Yields the text as it is written and collects any tool calls, which are
 * returned rather than yielded: the caller cannot act on a call until the
 * request has finished, because the model may ask for several and they all go in
 * one reply.
 */
async function* streamOnce(
  instructions: string,
  input: InputItem[],
  signal: AbortSignal,
): AsyncGenerator<{ text: string }, Round> {
  const key = apiKey();
  if (!key) throw new AssistFailure(NO_KEY);

  let response: Response;
  try {
    response = await fetch(`${OPENAI_BASE_URL}/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(requestBody(instructions, input)),
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
    throw new AssistFailure(describeApiFailure(response.status, body));
  }

  const parser = createSseParser();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  const calls: PendingCall[] = [];

  try {
    for (;;) {
      const { done, value } = await reader.read();

      const payloads = done
        ? parser.flush()
        : parser.push(decoder.decode(value, { stream: true }));

      for (const event of parsePayloads(payloads) as StreamEvent[]) {
        switch (event.type) {
          /*
           * A refusal is text the reader has to see. Treating it as an error
           * would replace the model's explanation of why it will not answer
           * with our guess at what went wrong.
           */
          case 'response.output_text.delta':
          case 'response.refusal.delta':
            if (typeof event.delta === 'string' && event.delta) yield { text: event.delta };
            break;

          case 'response.output_item.done':
            if (
              event.item?.type === 'function_call' &&
              typeof event.item.call_id === 'string' &&
              typeof event.item.name === 'string'
            ) {
              calls.push({
                call_id: event.item.call_id,
                name: event.item.name,
                // An empty argument list arrives as '' rather than '{}'.
                arguments: typeof event.item.arguments === 'string' ? event.item.arguments : '{}',
              });
            }
            break;

          case 'response.failed':
            throw new AssistFailure(
              typeof event.response?.error?.message === 'string'
                ? `OpenAI could not finish that answer: ${event.response.error.message}`
                : 'OpenAI could not finish that answer.',
            );

          case 'response.incomplete':
            // Not thrown. Whatever was written before it ran out is still worth
            // showing, so this is appended to the answer instead of replacing it.
            yield {
              text:
                event.response?.incomplete_details?.reason === 'max_output_tokens'
                  ? '\n\n*That answer was cut short because it reached its length limit. Ask for the rest and it will carry on.*'
                  : '\n\n*That answer stopped early.*',
            };
            break;

          case 'error':
            throw new AssistFailure(
              typeof event.message === 'string'
                ? `OpenAI reported a problem: ${event.message}`
                : 'OpenAI reported a problem.',
            );
        }
      }

      if (done) break;
    }
  } finally {
    // Abandoning a stream without this leaves the connection open until it times
    // out, which on a page somebody navigates away from is every request.
    reader.cancel().catch(() => {});
  }

  return { calls };
}

/** A failure already turned into a sentence for the reader. */
export class AssistFailure extends Error {}

/**
 * The whole answer, including any tools it needs on the way.
 *
 * The loop is: ask, and if the model asked for tools, run them, append both the
 * request and the result to the input, and ask again. It ends when a round comes
 * back with no tool calls, which is the round that contains the answer.
 *
 * Tools are run here rather than by the model, obviously, but the important part
 * is that their results are appended verbatim. The model is not told what the
 * answer is; it is told what the function returned, and it has to write the
 * sentence around it.
 */
export async function* runAssist(
  instructions: string,
  input: InputItem[],
  outerSignal?: AbortSignal,
): AsyncGenerator<AssistEvent> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  outerSignal?.addEventListener('abort', onAbort);

  const conversation = [...input];
  let wroteSomething = false;

  try {
    /*
     * One extra round beyond the tool budget. The budget is on rounds that may
     * run tools; the extra one is the model's chance to answer having been told
     * it has none left. Without it, exhausting the budget ends the answer
     * mid-thought, which is the one outcome worse than a slow one.
     */
    for (let round = 0; round <= MAX_TOOL_ROUNDS + 1; round++) {
      const stream = streamOnce(instructions, conversation, controller.signal);

      let result = await stream.next();
      while (!result.done) {
        wroteSomething = wroteSomething || result.value.text.trim().length > 0;
        yield { type: 'delta', text: result.value.text };
        result = await stream.next();
      }

      const { calls } = result.value;
      if (calls.length === 0) break;

      const exhausted = round >= MAX_TOOL_ROUNDS;

      for (const call of calls) {
        conversation.push({ type: 'function_call', ...call });

        if (exhausted) {
          // Refused in the same channel a result would have arrived in, so the
          // model can see what happened and write around it.
          conversation.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify({
              error:
                'No more calculations are allowed for this question. Answer with what you already have, or say what you would still need.',
            }),
          });
          continue;
        }

        // `data` is what the model gets; the trace is what the reader gets. They
        // are separated here so the browser is never sent a payload it has no
        // use for and would have to be trusted not to render.
        const { data, ...trace } = runTool(call);
        yield { type: 'tool', trace };

        conversation.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(trace.ok ? data : { error: trace.summary }),
        });
      }
    }

    /*
     * A run that only ever asked for tools and never wrote a word. Rare, and it
     * has to say something: an empty answer is indistinguishable on screen from
     * one that is still arriving.
     */
    if (!wroteSomething) {
      yield {
        type: 'delta',
        text: 'I could not get to an answer for that one. Try asking it a different way, or in smaller pieces.',
      };
    }

    yield { type: 'done' };
  } catch (error) {
    yield {
      type: 'error',
      message:
        error instanceof AssistFailure ? error.message : describeTransportFailure(error),
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
 * exception: an unknown tool, unparseable arguments, or a tool that throws.
 * The model gets told what went wrong and can correct itself, which is a far
 * better outcome than the whole answer failing because it misspelled a field.
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

  let args: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(call.arguments || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      args = parsed as Record<string, unknown>;
    }
  } catch {
    return {
      name: tool.name,
      label: tool.label,
      args: {},
      summary: 'The arguments for that calculation could not be read.',
      ok: false,
      data: {},
    };
  }

  try {
    const outcome = tool.run(args);
    return { name: tool.name, label: tool.label, args, ...outcome };
  } catch (error) {
    return {
      name: tool.name,
      label: tool.label,
      args,
      summary: error instanceof Error ? error.message : 'That calculation failed.',
      ok: false,
      data: {},
    };
  }
}
