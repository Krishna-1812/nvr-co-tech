import { NextResponse } from 'next/server';
import { rateLimited, requireApollo, TOO_MANY } from '@/lib/finder/gate';
import { readRequest, runSearch } from '@/lib/finder/search';
import { logServerError } from '@/lib/errors/server';

/**
 * One page of the grid.
 *
 * People are free to find; describing their employers costs a credit per page
 * unless the 30-day cache already holds them. A company search costs a credit
 * per call that returns anything. All of that is decided inside `runSearch` and
 * reported back on the response, so the number in the header and the number
 * written to the ledger are the same variable.
 *
 * The route itself is thin on purpose: the pipeline is long and every step of it
 * is worth testing without a request object in the way.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A people search can make two Apollo calls back to back — the free search, then
 * the paid employer lookup — and a company-name resolution adds a third in front
 * of them. Each retries with backoff across two base URLs. A default serverless
 * timeout is not built for that.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  const gate = await requireApollo();
  if (!gate.ok) return gate.response;

  if (rateLimited('search', gate.userId)) return TOO_MANY;

  const body = await request.json().catch(() => null);

  try {
    return NextResponse.json(await runSearch(gate.supabase, gate.apiKey, readRequest(body)));
  } catch (error) {
    /*
     * `runSearch` already turns a failed Apollo call into an honest
     * `search_failed` answer, so anything reaching here is a bug in this code
     * rather than an outage in theirs — and must not be reported as one.
     */
    await logServerError({
      route: '/api/finder/search',
      message: error instanceof Error ? error.message : 'Unknown error running a contact search',
      stack: error instanceof Error ? error.stack : null,
      userEmail: gate.email,
    });
    return NextResponse.json(
      { results: [], has_more: false, error: 'Something went wrong running that search.' },
      { status: 500 },
    );
  }
}
