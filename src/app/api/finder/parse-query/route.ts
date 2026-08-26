import { NextResponse } from 'next/server';
import { rateLimited, requireFinder, TOO_MANY } from '@/lib/finder/gate';
import { filtersFromIntent, parseIntent, verifyIntent } from '@/lib/finder/llm/intent';
import { llmConfigured, NO_MODEL_KEY } from '@/lib/finder/llm/transport';
import { logServerError } from '@/lib/errors/server';

/**
 * A sentence, turned into filters.
 *
 * **This route spends zero vendor credits, guaranteed.** It reads words and
 * writes filter values; nothing is fetched, nobody is looked up, and the person
 * who typed the sentence sees exactly what it became before deciding to run it.
 * That is the whole reason it is a separate button rather than something the
 * search does on its way past.
 *
 * Gated on `requireFinder` rather than `requireApollo` for the same reason: a
 * missing contact-database credential is no obstacle to reading a sentence, and
 * refusing over it would be a refusal with nothing behind it.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Two model calls, the second reviewing the first. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const gate = await requireFinder();
  if (!gate.ok) return gate.response;

  if (rateLimited('parse-query', gate.userId)) return TOO_MANY;

  if (!llmConfigured()) return NextResponse.json({ error: NO_MODEL_KEY }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = String(body?.text ?? '').trim();

  if (!text) {
    return NextResponse.json({ error: 'Type what you are looking for first.' }, { status: 400 });
  }

  try {
    const first = await parseIntent(text);
    /*
     * No conversation history is passed, because Fill filters has none. That
     * matters: the reviewer is told a blank field may have been supplied by an
     * earlier turn, and handing it a history that does not exist is how a
     * correctly blank field gets "corrected" into something wrong.
     */
    const intent = await verifyIntent(text, first);

    const filters = filtersFromIntent(intent);

    return NextResponse.json({
      filters,
      /*
       * Reported so the panel can say which tab this belongs on. A question
       * about a company's own attributes is a Companies search; anything naming
       * a role or a person is a People one.
       */
      entity: intent.intent === 'company_info' ? 'companies' : 'people',
      /*
       * Only present when the parser changed the spelling. Saying "reading
       * thoughworks as Thoughtworks" is what makes a wrong correction visible
       * and fixable rather than a search that quietly answered about somebody
       * else's company.
       */
      read_company_as: intent.company_name_typed
        ? { typed: intent.company_name_typed, as: intent.company_name }
        : null,
      unclear: intent.intent === 'unclear' && Object.keys(filters).length === 0,
    });
  } catch (error) {
    await logServerError({
      route: '/api/finder/parse-query',
      message: error instanceof Error ? error.message : 'Unknown error parsing a query',
      stack: error instanceof Error ? error.stack : null,
      userEmail: gate.email,
    });
    return NextResponse.json(
      { error: 'That could not be read into filters. Setting them by hand still works.' },
      { status: 502 },
    );
  }
}
