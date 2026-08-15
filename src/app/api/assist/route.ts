import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/supabase/server';
import { PREVIEW } from '@/lib/preview';
import { MAX_QUESTION_CHARS, apiKey } from '@/lib/assist/config';
import { NO_KEY } from '@/lib/assist/errors';
import { runOffline } from '@/lib/assist/offline';
import { runAssist } from '@/lib/assist/anthropic';
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
import { saveExchange } from '@/lib/assist/store';
import type { AssistEvent, ToolTrace, TurnNote } from '@/lib/assist/types';
import { logServerError } from '@/lib/errors/server';

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
  conversationId?: unknown;
};

type Turn = { role: 'user' | 'assistant'; content: string };

/**
 * The most turns one request may carry.
 *
 * Well above MAX_HISTORY_TURNS, which is what actually reaches the model — this
 * is not a modelling decision. Since conversations are saved, a long one can be
 * reopened and posted back whole, and this is the ceiling on how large that body
 * may get before it is refused rather than parsed.
 */
const MAX_POSTED_TURNS = 400;

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
  if (body.turns.length > MAX_POSTED_TURNS) {
    return { error: 'That conversation is too long to carry on. Start a new one.' };
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
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    // getCurrentUser() can throw when a session cannot be resolved to a
    // profile — a real, previously-seen fault (see src/lib/supabase/server.ts)
    // that used to surface as an endless redirect between here and /login
    // rather than a message anybody could act on.
    await logServerError({
      route: '/api/assist',
      message: error instanceof Error ? error.message : 'Could not resolve the session',
      stack: error instanceof Error ? error.stack : null,
    });
    return NextResponse.json({ error: 'Something went wrong while checking your session.' }, { status: 500 });
  }
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
   * Which saved conversation this belongs to, if the browser has been told one.
   * Not trusted beyond its shape: the store checks it is a conversation that
   * still exists and still belongs to this person, and starts a new one if not.
   */
  const conversationId =
    typeof body.conversationId === 'string' && body.conversationId ? body.conversationId : null;

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

  const events = offline
    ? runOffline(latestQuestion(turns), hits)
    : runAssist(system, turns, request.signal);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      /*
       * Sending is allowed to fail quietly, and only for one reason: the reader
       * can close the tab or press stop at any point, and a stream nobody is
       * holding throws on the next enqueue. That is not an error worth
       * reporting to anybody — there is no longer anybody to report it to — and
       * letting it propagate would abandon the work below, which still has an
       * answer to file away.
       */
      const send = (event: AssistEvent) => {
        try {
          controller.enqueue(encoder.encode(frame(event)));
        } catch {
          // Nobody is listening.
        }
      };

      // Sources first, so the interface can show what it is reading from before
      // the first word of the answer lands.
      send({ type: 'sources', sources });

      /*
       * The answer is assembled here as well as sent, so that it can be kept.
       *
       * Reading it off the stream rather than asking the browser to post it back
       * afterwards is the only version that cannot lie: what is written to the
       * history is byte for byte what was sent to the screen, and a tab that is
       * closed mid-answer cannot leave a different record behind.
       */
      let answer = '';
      const traces: ToolTrace[] = [];
      let note: TurnNote | undefined;
      let failed = false;

      try {
        for await (const event of events) {
          if (event.type === 'delta') answer += event.text;
          else if (event.type === 'tool') traces.push(event.trace);
          else if (event.type === 'note') note = event.note;
          else if (event.type === 'error') failed = true;

          send(event);
        }

        /*
         * Kept only when there is something worth keeping. A failed turn is
         * dropped: a rate limit or a dropped connection is something that
         * happened to the interface, not something that was said, and a history
         * full of them is a history nobody reads.
         *
         * An answer the reader stopped part way through is kept, because they
         * did read it, and it is stored exactly as much as arrived.
         */
        if (!failed && answer.trim()) {
          const saved = await saveExchange({
            conversationId,
            agent,
            question: latestQuestion(turns),
            answer,
            sources,
            tools: traces,
            note,
          });

          if (saved) send({ type: 'conversation', id: saved.id, title: saved.title });
        }
      } catch (error) {
        /*
         * runAssist turns its own failures into an error event, so reaching here
         * means something outside it broke. The reader still gets a sentence,
         * because a stream that simply stops looks exactly like an answer that
         * is still being written and never arrives — and this one is also worth
         * recording, since nothing about a stream failure otherwise reaches
         * anywhere an operator would see it.
         */
        await logServerError({
          route: '/api/assist',
          message: error instanceof Error ? error.message : 'Unknown error while answering',
          stack: error instanceof Error ? error.stack : null,
          userEmail: user.authEmail ?? user.email ?? null,
        });
        send({
          type: 'error',
          message:
            error instanceof Error && error.message
              ? error.message
              : 'Something went wrong while answering.',
          note: 'error',
        });
      } finally {
        // Same reason as `send`: closing a stream the reader has already walked
        // away from throws, and there is nothing left to do about it.
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
      // no-transform matters as much as no-store: a proxy that "helpfully"
      // compresses or buffers this delivers the whole answer at once, which is
      // the one thing streaming exists to avoid.
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
