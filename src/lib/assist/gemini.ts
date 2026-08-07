import {
  GEMINI_BASE_URL,
  MAX_OUTPUT_TOKENS,
  MAX_TOOL_ROUNDS,
  MODEL,
  REQUEST_TIMEOUT_MS,
  THINKING_LEVEL,
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
 * already stronger than one: `GEMINI_API_KEY` has no NEXT_PUBLIC_ prefix, so
 * Next replaces it with undefined in anything that reaches the browser. The key
 * cannot end up in a bundle even if somebody imports this from the wrong place.
 * Leaving the module importable is what lets the tool loop below be tested.
 *
 * Everything above this file is provider-agnostic and stayed that way when the
 * platform moved from OpenAI to Gemini: retrieval, the prompt, the tools, the
 * event stream, the markdown and the whole interface did not change. This is the
 * only file that knows whose API it is talking to, which is the point of it.
 *
 * Three things here were found by sending requests rather than by reading the
 * documentation, and each is noted where it bites.
 */

/** One turn of the conversation, as everything above this file thinks of it. */
export type Turn = { role: 'user' | 'assistant'; content: string };

/**
 * A piece of a model reply.
 *
 * `thought` marks the model's own reasoning, which arrives interleaved with the
 * answer and must never be shown: it is draft thinking, it contradicts itself on
 * the way to being right, and a reader cannot tell it from the answer.
 *
 * `thoughtSignature` is the one that has to survive a round trip. See below.
 */
type Part = {
  text?: unknown;
  thought?: unknown;
  thoughtSignature?: unknown;
  functionCall?: { name?: unknown; args?: unknown; id?: unknown };
};

/** A message in the conversation, in the shape the API takes it. */
type Content = { role: 'user' | 'model'; parts: unknown[] };

type PendingCall = {
  /**
   * The whole part, kept verbatim rather than rebuilt from its pieces.
   *
   * A function call comes back carrying a `thoughtSignature`, and echoing the
   * call back WITHOUT it is a hard 400: "Function call is missing a
   * thought_signature in functionCall parts". It is an opaque blob that only
   * means anything to the model, so the only correct thing to do with it is to
   * hand it back untouched. Reconstructing the part from name and args, which is
   * the obvious way to write this, fails every time.
   */
  part: Part;
  name: string;
  args: Record<string, unknown>;
  id?: string;
};

type Round = { calls: PendingCall[]; stop: string | null };

/** What one streamed frame can carry that this code acts on. */
type Frame = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: unknown }[];
  promptFeedback?: { blockReason?: unknown };
  error?: { message?: unknown; status?: unknown };
};

function requestBody(instructions: string, contents: Content[]) {
  return {
    systemInstruction: { parts: [{ text: instructions }] },
    contents,
    tools: toolSchemas(),
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      /*
       * Only sent when somebody has set it. Unset means whatever the model does
       * by default, which is always valid. A word is a thinking level and a
       * number is a token budget, which is the split between the 3.x and 2.5
       * families; both were checked against the live API.
       */
      ...(THINKING_LEVEL
        ? {
            thinkingConfig: /^\d+$/.test(THINKING_LEVEL)
              ? { thinkingBudget: Number(THINKING_LEVEL) }
              : { thinkingLevel: THINKING_LEVEL },
          }
        : {}),
    },
  };
}

/** A failure already turned into a sentence for the reader. */
export class AssistFailure extends Error {}

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
  contents: Content[],
  signal: AbortSignal,
): AsyncGenerator<{ text: string }, Round> {
  const key = apiKey();
  if (!key) throw new AssistFailure(NO_KEY);

  let response: Response;
  try {
    response = await fetch(
      `${GEMINI_BASE_URL}/models/${encodeURIComponent(MODEL)}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        // The key goes in a header, not in the query string, so it cannot end up
        // in an access log or a referrer.
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(requestBody(instructions, contents)),
        signal,
      },
    );
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
  let stop: string | null = null;

  try {
    for (;;) {
      const { done, value } = await reader.read();

      const payloads = done
        ? parser.flush()
        : parser.push(decoder.decode(value, { stream: true }));

      for (const frame of parsePayloads(payloads) as Frame[]) {
        // An error can arrive as a frame rather than as a status, once the
        // stream has already started.
        if (frame.error) {
          throw new AssistFailure(
            typeof frame.error.message === 'string'
              ? `The model stopped: ${frame.error.message}`
              : 'The model stopped partway through that answer.',
          );
        }

        // The prompt itself was refused, so there is no candidate to read.
        if (frame.promptFeedback?.blockReason) {
          throw new AssistFailure(
            `That question was refused by Google's safety filters (${String(frame.promptFeedback.blockReason)}). Rewording it usually gets past this.`,
          );
        }

        const candidate = frame.candidates?.[0];
        if (candidate?.finishReason) stop = String(candidate.finishReason);

        for (const part of candidate?.content?.parts ?? []) {
          // Thinking, not answer. Dropped rather than shown.
          if (part.thought) continue;

          if (typeof part.text === 'string' && part.text) {
            yield { text: part.text };
          }

          if (part.functionCall && typeof part.functionCall.name === 'string') {
            const args = part.functionCall.args;
            calls.push({
              part,
              name: part.functionCall.name,
              // Already an object here, unlike the JSON string other APIs send.
              args: args && typeof args === 'object' && !Array.isArray(args)
                ? (args as Record<string, unknown>)
                : {},
              id: typeof part.functionCall.id === 'string' ? part.functionCall.id : undefined,
            });
          }
        }
      }

      if (done) break;
    }
  } finally {
    // Abandoning a stream without this leaves the connection open until it times
    // out, which on a page somebody navigates away from is every request.
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

  // "assistant" everywhere else in this codebase, "model" here. Translated at
  // the boundary rather than leaking Gemini's vocabulary upwards.
  const contents: Content[] = turns.map((turn) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.content }],
  }));

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
      const stream = streamOnce(instructions, contents, controller.signal);

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
       * Every call the model made goes back in one `model` turn, and every
       * result in one `user` turn after it. Splitting them into a turn each
       * would interleave calls and results, which the API rejects when the model
       * asked for several at once.
       */
      contents.push({ role: 'model', parts: calls.map((call) => call.part) });

      const responses: unknown[] = [];

      for (const call of calls) {
        if (exhausted) {
          // Refused in the same channel a result would have arrived in, so the
          // model can see what happened and write around it.
          responses.push({
            functionResponse: {
              name: call.name,
              id: call.id,
              response: {
                error:
                  'No more calculations are allowed for this question. Answer with what you already have, or say what you would still need.',
              },
            },
          });
          continue;
        }

        // `data` is what the model gets; the trace is what the reader gets. They
        // are separated here so the browser is never sent a payload it has no
        // use for and would have to be trusted not to render.
        const { data, ...trace } = runTool(call);
        yield { type: 'tool', trace };

        responses.push({
          functionResponse: {
            name: call.name,
            // Carried back so a reply can be matched to its call when the model
            // asked for several at once.
            id: call.id,
            response: trace.ok ? data : { error: trace.summary },
          },
        });
      }

      contents.push({ role: 'user', parts: responses });
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
