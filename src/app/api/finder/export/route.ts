import { NextResponse } from 'next/server';
import { requireFinder } from '@/lib/finder/gate';
import {
  EXPORT_ROW_CAP,
  buildCsv,
  buildXlsx,
  exportFilename,
  type ExportMeta,
} from '@/lib/finder/export';
import { logServerError } from '@/lib/errors/server';

/**
 * Download what is on screen.
 *
 * The rows come from the browser rather than being re-queried, which is the
 * point: exporting costs nothing, and the file contains exactly what somebody
 * ticked — including enrichment they have already paid for, which a re-query
 * would either lose or charge for again.
 *
 * Gated on `requireFinder` rather than `requireApollo`, because this route never
 * reaches Apollo and refusing it for want of a credential nobody needs would be
 * a refusal with no reason behind it.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const gate = await requireFinder();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  /*
   * Capped, because every other client-supplied collection in this tool is —
   * the working list at 500, history at 60 entries, bulk reveal at 50 — and
   * this was the one left open, so a client could post an arbitrarily large
   * array and have the server build the whole file in memory. Five thousand
   * covers a full working-list export with room to spare.
   */
  const rows = (Array.isArray(body?.rows) ? body.rows : [])
    .slice(0, EXPORT_ROW_CAP)
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object');

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Nothing selected to export.' }, { status: 400 });
  }

  const entity = body?.entity === 'companies' ? 'companies' : 'people';
  const format = String(body?.format ?? '').toLowerCase() === 'csv' ? 'csv' : 'xlsx';
  const filters =
    body?.filters && typeof body.filters === 'object'
      ? (body.filters as Record<string, unknown>)
      : {};
  const meta = (body?.meta && typeof body.meta === 'object' ? body.meta : {}) as ExportMeta;

  try {
    const payload =
      format === 'csv'
        ? Buffer.from(buildCsv({ entity, rows, filters, meta }), 'utf8')
        : buildXlsx({ entity, rows, filters, meta });

    return new NextResponse(new Uint8Array(payload), {
      headers: {
        'content-type':
          format === 'csv'
            ? 'text/csv; charset=utf-8'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${exportFilename(entity, format)}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    await logServerError({
      route: '/api/finder/export',
      message: error instanceof Error ? error.message : 'Unknown error building an export',
      stack: error instanceof Error ? error.stack : null,
      userEmail: gate.email,
    });
    return NextResponse.json({ error: 'That file could not be built.' }, { status: 500 });
  }
}
