import { NextResponse } from 'next/server';
import { requireFinder } from '@/lib/finder/gate';
import { readHistory, saveHistory } from '@/lib/finder/history';
import { historyLabel } from '@/lib/finder/label';

/**
 * What was looked up, and getting back to it without paying again.
 *
 * That is the whole reason this exists. A company search costs a credit per
 * page and a revealed contact costs one per person, so a result set somebody
 * already has is worth keeping — reopening it is free, and re-running it is not.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Rows kept per entry. Enough to reopen a search, not enough to store a corpus. */
const MAX_ROWS = 120;

export async function GET() {
  const gate = await requireFinder();
  if (!gate.ok) return gate.response;

  return NextResponse.json({ entries: await readHistory(gate.supabase) });
}

export async function POST(request: Request) {
  const gate = await requireFinder();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const rows = (Array.isArray(body?.rows) ? body.rows : []).filter(
    (r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object',
  );
  if (rows.length === 0) return NextResponse.json({ saved: false });

  const entity = body?.entity === 'companies' ? 'companies' : 'people';
  const filters =
    body?.filters && typeof body.filters === 'object'
      ? (body.filters as Record<string, unknown>)
      : {};

  /*
   * A paged search that outgrows the per-entry cap used to be truncated here
   * with nothing to show for it: the drawer would reopen 120 rows and call it
   * the whole search. Reported back instead, so somebody paging deep enough to
   * hit it finds out from the page rather than from noticing the count is short.
   */
  const kept = rows.slice(0, MAX_ROWS);
  const truncated = rows.length > MAX_ROWS;

  const id = await saveHistory(gate.supabase, {
    entity,
    label: historyLabel(entity, filters),
    filters,
    total: typeof body?.total === 'number' ? body.total : null,
    rows: kept,
    // A "Load more" is the same search getting longer, not a new one, so the
    // client sends back the id it was given and the entry grows in place.
    replaceId: Number(body?.replace_id ?? 0) || null,
  });

  return NextResponse.json({
    saved: id != null,
    id,
    ...(truncated ? { truncated: true, kept: MAX_ROWS, of: rows.length } : {}),
  });
}
