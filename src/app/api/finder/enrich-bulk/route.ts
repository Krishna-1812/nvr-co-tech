import { NextResponse } from 'next/server';
import { rateLimited, requireApollo, TOO_MANY } from '@/lib/finder/gate';
import { bulkEnrich } from '@/lib/finder/enrich';
import { saveHistory } from '@/lib/finder/history';
import { newSpend, recordSpend } from '@/lib/finder/store';
import { logServerError } from '@/lib/errors/server';

/**
 * Reveal a ticked set of people, in one batch.
 *
 * The biggest purchase this screen can make — up to fifty credits in a click —
 * and for a long time it was the only purchase that went unrecorded, while a
 * single reveal of one person always was. A closed tab therefore lost exactly
 * the contacts that had cost the most to get.
 *
 * Saved under its own kind, because these rows are already in the flat search-row
 * shape: the entry reopens straight into the grid and exports like any other
 * saved search.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Fifty ids go to Apollo as five chunks of ten, each with its own retries. */
export const maxDuration = 90;

export async function POST(request: Request) {
  const gate = await requireApollo();
  if (!gate.ok) return gate.response;

  if (rateLimited('enrich', gate.userId)) return TOO_MANY;

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.map((i) => String(i ?? '')) : [];

  const spend = newSpend();

  try {
    const out = await bulkEnrich({
      supabase: gate.supabase,
      apiKey: gate.apiKey,
      ids,
      spend,
    });

    const rows = Object.values(out.profiles);
    if (rows.length > 0) {
      const named = rows.map((r) => String(r.full_name ?? '')).filter(Boolean);
      let label = `${rows.length} contact${rows.length === 1 ? '' : 's'} revealed`;
      if (named.length > 0) {
        label += `: ${named.slice(0, 3).join(', ')}`;
        if (named.length > 3) label += ` +${named.length - 3} more`;
      }

      await saveHistory(gate.supabase, {
        entity: 'revealed',
        label,
        rows,
        total: rows.length,
        // What this click cost, not what the entry holds: the cached ones were
        // paid for earlier, and counting them again would inflate every total
        // the drawer reports.
        credits: out.fetched,
        filters: { from_cache: out.cached },
      });
    }

    await recordSpend(gate.supabase, 'enrich-bulk', spend.credits);
    return NextResponse.json(out);
  } catch (error) {
    // The credits are gone by the time anything can throw here, so they are
    // recorded before the failure is reported.
    await recordSpend(gate.supabase, 'enrich-bulk', spend.credits);
    await logServerError({
      route: '/api/finder/enrich-bulk',
      message: error instanceof Error ? error.message : 'Unknown error revealing contacts',
      stack: error instanceof Error ? error.stack : null,
      userEmail: gate.email,
    });
    return NextResponse.json(
      { profiles: {}, fetched: 0, cached: 0, error: 'Something went wrong revealing those.' },
      { status: 500 },
    );
  }
}
