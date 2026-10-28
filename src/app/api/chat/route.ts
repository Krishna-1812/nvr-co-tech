import { NextResponse } from 'next/server';
import { PREVIEW } from '@/lib/preview';
import {
  CHAT_EFFORT,
  CHAT_MAX_HISTORY_CHARS,
  CHAT_MAX_HISTORY_TURNS,
  CHAT_MAX_OUTPUT_TOKENS,
  CHAT_MAX_POSTED_TURNS,
  CHAT_MAX_QUESTION_CHARS,
  CHAT_MODEL,
  CHAT_TOOL_ROUNDS,
  apiKey,
} from '@/lib/assist/config';
import { runAssist } from '@/lib/assist/anthropic';
import { runOffline } from '@/lib/assist/offline';
import { latestQuestion, retrievalQuery, trimHistory } from '@/lib/assist/prompt';
import { checkVisitorRate } from '@/lib/assist/ratelimit';
import { fromThisSite, visitorAddress } from '@/lib/assist/request';
import { SITE_INDEX } from '@/lib/assist/site';
import { readTurns } from '@/lib/assist/turns';
import type { AssistEvent } from '@/lib/assist/types';
import { VISITOR_INSTRUCTIONS, visitorContext } from '@/lib/assist/visitor';
import { logServerError } from '@/lib/errors/server';

/**
 * The chat anybody can use: on every public page, and for a visitor in the
 * open workspace.
 *
 * The signed-in assistant (/api/assist) refuses anybody without an account,
 * for the reason it gives: an endpoint that spends a paid key for strangers is
 * a bill waiting to be run up. This one exists because the owner wants
 * visitors answered too, so it carries the controls that refusal stood in for,
 * in the order a request meets them:
 *
 * 1. It answers pages on this site only (fromThisSite).
 * 2. It takes a short question and a short history (config: CHAT_*).
 * 3. It counts questions per address and per instance, before any money is
 *    spent (checkVisitorRate).
 * 4. Its answers are capped in length and in calculator rounds, and the
 *    website it answers from is sent with a cache marker, so a question costs
 *    about a tenth of what the same text would uncached.
 *
 * Nothing a visitor types is kept: there is no account to keep it under, so it
 * is answered and forgotten. The conversation lives in their browser tab.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { turns?: unknown; page?: unknown };

/** One event, as an SSE frame. */
function frame(event: AssistEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  if (!fromThisSite(request)) {
    return NextResponse.json({ error: 'This chat answers on its own website only.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: 'That request could not be read.' }, { status: 400 });

  const read = readTurns(body.turns, {
    maxQuestionChars: CHAT_MAX_QUESTION_CHARS,
    maxPostedTurns: CHAT_MAX_POSTED_TURNS,
  });
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });

  const rate = checkVisitorRate(visitorAddress(request));
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `That is a lot of questions in a short time. Try again in ${
          rate.retryAfterSeconds >= 120 ? `${Math.ceil(rate.retryAfterSeconds / 60)} minutes` : `${rate.retryAfterSeconds} seconds`
        }.`,
      },
      { status: 429, headers: { 'retry-after': String(rate.retryAfterSeconds) } },
    );
  }

  const turns = trimHistory(read.turns, { maxTurns: CHAT_MAX_HISTORY_TURNS, maxChars: CHAT_MAX_HISTORY_CHARS });

  const key = apiKey();
  const offline = PREVIEW && !key;

  if (!key && !offline) {
    // The operator's sentence (NO_KEY) names an environment variable, which
    // means nothing to a visitor. Not logged either: that would be a database
    // write per anonymous request, for a fact the owner learns the first time
    // they ask it anything.
    return NextResponse.json(
      { error: 'The assistant is not available just now. You can write to the team from the contact page.' },
      { status: 503 },
    );
  }

  const events = offline
    ? runOffline(latestQuestion(turns), SITE_INDEX.retrieve(retrievalQuery(turns), { limit: 3 }))
    : runAssist(
        [
          // Everything that never changes, cached; then the page and the date.
          { type: 'text', text: VISITOR_INSTRUCTIONS, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: visitorContext(body.page) },
        ],
        turns,
        request.signal,
        {
          model: CHAT_MODEL,
          maxTokens: CHAT_MAX_OUTPUT_TOKENS,
          effort: CHAT_EFFORT || undefined,
          toolRounds: CHAT_TOOL_ROUNDS,
        },
      );

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // A reader who closes the tab mid-answer makes the next enqueue throw;
      // there is nobody left to tell, so it is dropped (as in /api/assist).
      const send = (event: AssistEvent) => {
        try {
          controller.enqueue(encoder.encode(frame(event)));
        } catch {
          // Nobody is listening.
        }
      };

      try {
        for await (const event of events) send(event);
      } catch (error) {
        await logServerError({
          route: '/api/chat',
          message: error instanceof Error ? error.message : 'Unknown error while answering',
          stack: error instanceof Error ? error.stack : null,
        });
        send({ type: 'error', message: 'Something went wrong while answering.', note: 'error' });
      } finally {
        try {
          controller.close();
        } catch {
          // Already gone.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      // no-transform as well as no-store: a proxy that buffers or compresses
      // this delivers the whole answer at once, which defeats the stream.
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
