import { NextResponse } from 'next/server';
import { rateLimited, requireApollo } from '@/lib/finder/gate';
import { runCount } from '@/lib/finder/search';

/**
 * How many people match, while the filters are still being set.
 *
 * **Guaranteed to spend nothing.** Apollo's people search is free and reports
 * its own total, which is the whole reason this endpoint can exist; the three
 * things that could cost money are each refused by name, with a reason, rather
 * than returning a silent null that reads as "no matches".
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const gate = await requireApollo();
  if (!gate.ok) return gate.response;

  // Debounced client-side while typing, so this limit is generous. It exists
  // for the script that is not debounced.
  if (rateLimited('count', gate.userId)) {
    return NextResponse.json(
      { count: null, reason: 'Too many requests. Wait a moment and try again.' },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    entity?: unknown;
    filters?: unknown;
  } | null;

  const entity = body?.entity === 'companies' ? 'companies' : 'people';
  const filters = (body?.filters ?? {}) as Record<string, unknown>;

  return NextResponse.json(await runCount(gate.apiKey, entity, filters));
}
