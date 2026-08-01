import { NextResponse } from 'next/server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { parseFilters, hasFilters, voucherQuery } from '@/lib/domain/voucherQuery';
import { buildVoucherXlsx } from '@/lib/export/workbook';
import { exportFilename } from '@/lib/export/columns';
import type { ExportRow } from '@/lib/export/columns';

/**
 * GET /vouchers/export — the current view, as .xlsx.
 *
 * It takes the same query string as the list page and runs it through the same
 * filter builder, so you always get exactly the rows you were looking at. v1's
 * export ignored filters because it had none, and dumped every voucher.
 *
 * The query runs as the signed-in user, so RLS scopes it: a member exports their
 * own vouchers, an admin exports everyone's.
 */

/** Guard against someone hand-editing the URL into a monstrous export. */
const MAX_ROWS = 5000;

const SELECT = `
  voucher_no, status, date, sponsored,
  event_name, event_narration,
  type_of_supporting, type_of_payment,
  invoice_no, invoice_date, invoice_received_date,
  basic_value, cgst, sgst, igst, vat, net_total,
  tds, advance, tips, discount, grand_total,
  paid_to, payment_date, beneficiary_name, utr_ref, pan_number, gst_number,
  submitted_at, approved_1_at, approved_2_at, paid_at,
  chapter:chapters!vouchers_chapter_id_fkey(name),
  paid_by:chapters!vouchers_paid_by_chapter_id_fkey(name),
  initiator:profiles!vouchers_initiated_by_fkey(full_name, email),
  first_approver:profiles!vouchers_approver_1_fkey(full_name, email),
  second_approver:profiles!vouchers_approver_2_fkey(full_name, email),
  voucher_attachments(id)
`;

export async function GET(req: Request) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse('Not signed in', { status: 401 });

  const supabase = await createClient();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const filters = parseFilters(sp);

  const { data, error } = await voucherQuery(supabase, SELECT, filters, viewer)
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    console.error('[export] query failed', error);
    return new NextResponse('Could not build the export', { status: 500 });
  }

  const rows = (data ?? []) as unknown as ExportRow[];

  try {
    const xlsx = buildVoucherXlsx(rows);
    const filename = exportFilename(new Date(), hasFilters(filters) ? 'filtered' : undefined);

    return new NextResponse(xlsx as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(xlsx.length),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[export] build failed', err);
    return new NextResponse('Could not build the export', { status: 500 });
  }
}
