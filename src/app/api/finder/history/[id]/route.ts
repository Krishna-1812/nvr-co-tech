import { NextResponse } from 'next/server';
import { requireFinder } from '@/lib/finder/gate';
import { deleteHistoryEntry, readHistoryEntry } from '@/lib/finder/history';

/**
 * One saved entry: reopened, or thrown away.
 *
 * There is no ownership check in this file and that is deliberate, not an
 * omission. The policy on the table is `user_id = auth.uid()`, so an id
 * belonging to somebody else matches no row at all — which is a stronger
 * guarantee than fetching a row and then deciding whether to hand it over.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function idOf(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireFinder();
  if (!gate.ok) return gate.response;

  const id = idOf((await ctx.params).id);
  if (!id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const entry = await readHistoryEntry(gate.supabase, id);
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    // The id travels back so the client can keep growing this same entry if the
    // reopened search is paged further.
    id: entry.id,
    entity: entry.entity,
    label: entry.label,
    filters: entry.filters ?? {},
    total: entry.total,
    rows: Array.isArray(entry.rows) ? entry.rows : [],
    answer: entry.answer ?? '',
    credits: entry.credits,
    created_at: entry.created_at,
  });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireFinder();
  if (!gate.ok) return gate.response;

  const id = idOf((await ctx.params).id);
  if (!id) return NextResponse.json({ deleted: false }, { status: 404 });

  return NextResponse.json({ deleted: await deleteHistoryEntry(gate.supabase, id) });
}
