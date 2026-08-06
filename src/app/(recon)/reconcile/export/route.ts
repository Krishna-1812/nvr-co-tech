import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildReconXlsx } from '@/lib/recon/export/workbook';
import { renderReconPdf } from '@/lib/recon/export/pdf';
import type { ReconResult } from '@/lib/recon/types';

/**
 * POST /reconcile/export — the statement as a PDF or a workbook.
 *
 * A POST with the result in the body, rather than a GET against a saved row.
 * That is the only shape that works here, and it is the right one: the
 * reconciliation is computed in the browser from two files the server has never
 * seen, so at the moment somebody wants a PDF the server has nothing to render
 * from unless they send it. It also means exporting works before saving, and
 * still works if history has not been switched on for the project at all.
 *
 * The rendering has to be here rather than in the browser because both
 * generators are heavy — @react-pdf/renderer and the spreadsheet writer are
 * several hundred kilobytes each, and neither belongs in a bundle that most
 * people will never trigger.
 *
 * Nothing is stored and nothing is read. The response is a rendering of exactly
 * what the caller sent, so there is no row here that could belong to anyone else.
 */

/** Enough for a very large reconciliation, and far short of a memory problem. */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Not signed in', { status: 401 });

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return new NextResponse('That reconciliation is too large to export', { status: 413 });
  }

  let body: { format?: string; result?: ReconResult };
  try {
    body = await req.json();
  } catch {
    return new NextResponse('Malformed request', { status: 400 });
  }

  const result = body.result;
  const format = body.format === 'xlsx' ? 'xlsx' : 'pdf';

  if (!result?.statement?.reconciliationDate) {
    return new NextResponse('Nothing to export', { status: 400 });
  }

  // Whose name goes at the foot of the working paper. Read from the session
  // rather than taken from the body, so it is the person who actually ran it.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();
  const preparedBy = profile?.full_name ?? user.email ?? 'Finance Intelligence';

  const base = `reconciliation-${result.statement.reconciliationDate}`;

  try {
    if (format === 'xlsx') {
      const workbook = buildReconXlsx(result, preparedBy);
      return new NextResponse(workbook as unknown as BodyInit, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${base}.xlsx"`,
          'Content-Length': String(workbook.length),
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const pdf = await renderReconPdf(result, preparedBy);
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        // `inline`, so it opens in the browser's own viewer. The button that
        // saves it adds its own download attribute.
        'Content-Disposition': `inline; filename="${base}.pdf"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[recon-export] render failed', { format, err });
    return new NextResponse('Could not build that file', { status: 500 });
  }
}
