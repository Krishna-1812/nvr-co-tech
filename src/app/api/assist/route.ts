import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/supabase/server';
import { PREVIEW } from '@/lib/preview';
import { MAX_QUESTION_CHARS, apiKey } from '@/lib/assist/config';
import { NO_KEY } from '@/lib/assist/errors';
import { runOffline } from '@/lib/assist/offline';
import { runAssist, type InputItem } from '@/lib/assist/openai';
import {
  contextBlock,
  instructions,
  latestQuestion,
  retrievalQuery,
  sourcesOf,
  trimHistory,
} from '@/lib/assist/prompt';
import { checkRate } from '@/lib/assist/ratelimit';
import { retrieveWithContext } from '@/lib/assist/retrieve';
import type { AssistEvent } from '@/lib/assist/types';

/**
 * The assistant, as one streaming endpoint.
 *
 * Streaming, because the alternative is a spinner for fifteen seconds and then a
 * wall of text, and the difference between those two is most of what makes a
 * chat window feel like it is working.
 *
 * Signed in only. Not because the answers are secret, but because an
 * unauthenticated endpoint that calls a paid API on somebody else's key is a
 * bill waiting to be run up by the first crawler that finds it.
 */

// The key is read here, and reasoning models can take a while, so this is not a
// candidate for the edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The one thing this endpoint is willing to be sent. */
type Body = {
  turns?: unknown;
  agent?: unknown;
};

type Turn = { role: 'user' | 'assistant'; content: string };

/**
 * Read the conversation out of the body, or say why it cannot be.
 *
 * The browser is the only thing that posts here today, which is exactly why this
 * is thorough: the reason to validate is not that a user might send something
 * strange, it is that a bug in the composer should fail here with a sentence
 * rather than three seconds later inside a model request that has already been
 * paid for.
 */
function readTurns(body: Body): { turns: Turn[] } | { error: string } {
  if (!Array.isArray(body.turns) || body.turns.length === 0) {
    return { error: 'No question was sent.' };
  }

  const turns: Turn[] = [];
  for (const raw of body.turns) {
    if (!raw || typeof raw !== 'object') return { error: 'That conversation could not be read.' };
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') {
      return { error: 'That conversation could not be read.' };
    }
    if (typeof content !== 'string') return { error: 'That conversation could not be read.' };
    turns.push({ role, content });
  }

  const last = turns[turns.length - 1];
  if (last.role !== 'user' || !last.content.trim()) {
    return { error: 'No question was sent.' };
  }
  if (last.content.length > MAX_QUESTION_CHARS) {
    return {
      error: `That question is too long. The limit is ${MAX_QUESTION_CHARS.toLocaleString('en-IN')} characters.`,
    };
  }

  return { turns };
}

/** One event, as an SSE frame. */
function frame(event: AssistEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: 'That request could not be read.' }, { status: 400 });

  const read = readTurns(body);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });

  const rate = checkRate(user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `That is a lot of questions in a short time. Try again in ${rate.retryAfterSeconds} seconds.`,
      },
      { status: 429, headers: { 'retry-after': String(rate.retryAfterSeconds) } },
    );
  }

  const agent = typeof body.agent === 'string' && body.agent ? body.agent : null;
  const turns = trimHistory(read.turns);

  /*
   * Retrieval runs on the question, not on the whole conversation, with the
   * previous question prepended when the current one is too short to stand up on
   * its own. See retrievalQuery for why.
   */
  const hits = retrieveWithContext(retrievalQuery(turns), { agent });
  const sources = sourcesOf(hits);

  const key = apiKey();
  const offline = PREVIEW && !key;

  // Nothing to answer with, and no sample to fall back on.
  if (!key && !offline) {
    return NextResponse.json({ error: NO_KEY }, { status: 503 });
  }

  const system = `${instructions({
    agent,
    // First name only. The model does not need somebody's surname to be polite,
    // and this text is sent to a third party.
    name: user.full_name?.trim().split(/\s+/)[0] ?? null,
    role: user.role,
  })}\n\n${contextBlock(hits)}`;

  const input: InputItem[] = turns.map((turn) => ({ role: turn.role, content: turn.content }));

  const events = offline
    ? runOffline(latestQuestion(turns), hits)
    : runAssist(system, input, request.signal);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Sources first, so the interface can show what it is reading from before
      // the first word of the answer lands.
      controller.enqueue(encoder.encode(frame({ type: 'sources', sources })));

      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(frame(event)));
        }
      } catch (error) {
        /*
         * runAssist turns its own failures into an error event, so reaching here
         * means something outside it broke. The reader still gets a sentence,
         * because a stream that simply stops looks exactly like an answer that
         * is still being written and never arrives.
         */
        controller.enqueue(
          encoder.encode(
            frame({
              type: 'error',
              message:
                error instanceof Error && error.message
                  ? error.message
                  : 'Something went wrong while answering.',
              note: 'error',
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      // no-transform matters as much as no-store: a proxy that "helpfully"
      // compresses or buffers this delivers the whole answer at once, which is
      // the one thing streaming exists to avoid.
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
