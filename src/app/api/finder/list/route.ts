import { NextResponse } from 'next/server';
import { requireFinder } from '@/lib/finder/gate';
import { listAdd, listRemove, readList } from '@/lib/finder/history';

/**
 * The working list.
 *
 * Real prospecting is several searches feeding one list, and without this every
 * search discards the last: you can tick rows, reveal them and export them, but
 * only inside a single result set. This is the working set that survives across
 * searches, across the two tabs and across a reload.
 *
 * Stored on the server for the same reason revealed contacts are: it can hold
 * details that cost real money, and asking the browser to remember those means a
 * closed tab throws away a purchase.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireFinder();
  if (!gate.ok) return gate.response;

  const rows = await readList(gate.supabase);
  return NextResponse.json({
    rows: rows.map((r) => ({
      entity: r.entity,
      dedupe_key: r.dedupe_key,
      row: r.row,
      added_at: r.added_at,
    })),
    count: rows.length,
  });
}

export async function POST(request: Request) {
  const gate = await requireFinder();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const entity = body?.entity === 'companies' ? 'companies' : 'people';
  const rows = (Array.isArray(body?.rows) ? body.rows : []).filter(
    (r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object',
  );

  return NextResponse.json(await listAdd(gate.supabase, entity, rows));
}

export async function DELETE(request: Request) {
  const gate = await requireFinder();
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const entity = url.searchParams.get('entity') === 'companies' ? 'companies' : 'people';
  // No key means the whole list for that tab. A deliberate, explicit clear.
  const key = url.searchParams.get('key') ?? undefined;

  return NextResponse.json({ removed: await listRemove(gate.supabase, entity, key) });
}
