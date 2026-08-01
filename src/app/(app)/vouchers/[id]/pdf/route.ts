import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderVoucherPdf, pdfFilename } from '@/lib/pdf/render';
import { VOUCHER_DETAIL_SELECT } from '@/lib/domain/rows';
import type { VoucherDetailRow } from '@/lib/domain/rows';

/**
 * GET /vouchers/:id/pdf — renders the voucher as a vector PDF.
 *
 * The document is generated server-side from the database row, so a voucher
 * downloaded today and the same voucher re-downloaded in three years are byte
 * for byte the same. v1 rebuilt the PDF from whatever the browser happened to
 * have in component state, which is how its re-downloaded copies silently lost
 * the event date.
 *
 * No authorisation logic lives here: the query runs as the signed-in user, so
 * RLS decides what they may read. A voucher they cannot see simply returns no
 * row, and they get a 404.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Not signed in', { status: 401 });

  const { data } = await supabase
    .from('vouchers')
    .select(VOUCHER_DETAIL_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) return new NextResponse('Voucher not found', { status: 404 });

  const voucher = data as unknown as VoucherDetailRow;

  try {
    const pdf = await renderVoucherPdf(voucher);
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        // `inline` so it opens in the browser's viewer; the download button on
        // the detail page adds its own `download` attribute when saving.
        'Content-Disposition': `inline; filename="${pdfFilename(voucher.voucher_no)}"`,
        'Content-Length': String(pdf.length),
        // A voucher's content changes only when the voucher does, and approved
        // ones never change — but staleness here would be confusing, so revalidate.
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (err) {
    console.error('[pdf] render failed', { voucherId: id, err });
    return new NextResponse('Could not generate the PDF', { status: 500 });
  }
}
