import { NextResponse } from 'next/server';
import { rateLimited, requireApollo, TOO_MANY } from '@/lib/finder/gate';
import { runChat, type ChatReply } from '@/lib/finder/chat/run';
import { saveHistory } from '@/lib/finder/history';
import { llmConfigured, NO_MODEL_KEY } from '@/lib/finder/llm/transport';
import { recordSpend } from '@/lib/finder/store';
import { logServerError } from '@/lib/errors/server';
import type { Message } from '@/lib/finder/llm/transport';

/**
 * One turn of the conversation.
 *
 * The route is thin because the pipeline is long, and because everything worth
 * getting right in it — which lookups to make, whether a name is ambiguous,
 * whether an absence was actually checked — belongs in code that can be tested
 * without a request object in the way.
 *
 * What lives here is what only a route can do: the gate, the limit, recording
 * what was spent, and saving the exchange. The save happens **once**, after the
 * answer, for every branch. Threading it through a dozen return statements is
 * how some answers silently stop being recorded.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A single question can make two model calls to parse it, a web research call, a
 * public role lookup, a company search, two people searches and an enrichment.
 * Most finish in well under half of this; the ceiling is for the worst case, not
 * the normal one.
 */
export const maxDuration = 120;

function readHistory(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((h): h is { role: string; content: string } => Boolean(h) && typeof h === 'object')
    .filter((h) => (h.role === 'user' || h.role === 'assistant') && Boolean(h.content))
    .map((h) => ({ role: h.role as 'user' | 'assistant', content: String(h.content) }));
}

export async function POST(request: Request) {
  const gate = await requireApollo();
  if (!gate.ok) return gate.response;

  if (rateLimited('chat', gate.userId)) return TOO_MANY;

  if (!llmConfigured()) return NextResponse.json({ answer: NO_MODEL_KEY }, { status: 503 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const message = String(body?.message ?? '').trim();

  if (!message) {
    return NextResponse.json({ answer: 'Ask me something, like “Who is the CMO of Acme?”' });
  }

  const text = (key: string) => String(body?.[key] ?? '').trim();

  let out: ChatReply;
  try {
    out = await runChat(gate.supabase, gate.apiKey, {
      message,
      history: readHistory(body?.history),
      selected_org_id: text('selected_org_id'),
      selected_domain: text('selected_domain'),
      selected_name: text('selected_name'),
      context_org_id: text('context_org_id'),
      context_domain: text('context_domain'),
      context_name: text('context_name'),
    });
  } catch (error) {
    await logServerError({
      route: '/api/finder/chat',
      message: error instanceof Error ? error.message : 'Unknown error answering a question',
      stack: error instanceof Error ? error.stack : null,
      userEmail: gate.email,
    });
    return NextResponse.json(
      { answer: 'Something went wrong answering that. Try again in a moment.' },
      { status: 500 },
    );
  }

  const credits = out.credits ?? 0;

  /*
   * Both of these run after the answer is in hand and neither may break it. The
   * credits are already spent by the time this executes, so failing to record
   * them must not turn an answer somebody paid for into an error.
   */
  await recordSpend(gate.supabase, 'chat', credits);

  /*
   * A disambiguation turn is a question back to the asker, not an answer to
   * theirs, and they are about to re-ask and get the real one. Recording both
   * would put two entries in the drawer for one thing somebody asked.
   */
  if (!out.choices) {
    await saveHistory(gate.supabase, {
      entity: 'chat',
      label: message,
      answer: out.answer,
      credits,
      // Who the answer named, which is exactly what the buttons already
      // describe, so this needs no extra plumbing to collect.
      rows: (out.enrich ?? []).map((p) => ({
        name: p.name,
        title: p.title,
        domain: p.domain,
        apollo_id: p.apollo_id,
      })),
      total: out.enrich?.length ?? 0,
      filters: {
        question: message,
        company: out.context?.name ?? '',
        domain: out.context?.domain ?? '',
        /*
         * Both halves of the provenance note, so a reopened answer can say how
         * it was produced instead of guessing. Storing only "researched" made
         * every replay claim "background knowledge, no live web" even when the
         * original had cited a live source, which is a false statement about our
         * own answer.
         */
        researched: Boolean(out.researched),
        web_search: Boolean(out.web_search),
      },
    });
  }

  return NextResponse.json(out);
}
