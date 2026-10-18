import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAnalyticsAdmin } from '@/lib/analytics/admin';
import { istDay } from '@/lib/analytics/report';
import type { AdminAccountRow, SiteViewRow, SiteVisitorRow } from '@/lib/supabase/types';

/**
 * Every recorded page view as a CSV, one row each, with the visitor and the
 * account it belongs to beside it: the Admin settings "Download" button.
 *
 * Admins only, asked here because a route handler sits outside the layout's
 * gate. Read in pages of a thousand, the most Supabase returns at once.
 */
export async function GET() {
  if (!(await isAnalyticsAdmin())) return new NextResponse('Not found', { status: 404 });
  const supabase = await createClient();

  async function all<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; from < 200_000; from += 1000) {
      const { data } = await read(from, from + 999);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  }

  const [views, visitors, accounts] = await Promise.all([
    all<SiteViewRow>((f, t) => supabase.from('site_views').select('*').order('started_at', { ascending: false }).range(f, t)),
    all<SiteVisitorRow>((f, t) => supabase.from('site_visitors').select('*').range(f, t)),
    supabase.rpc('admin_accounts'),
  ]);
  const visitor = new Map(visitors.map((v) => [v.id, v]));
  const account = new Map(((accounts.data ?? []) as AdminAccountRow[]).map((a) => [a.id, a]));

  const head = ['Date (IST)', 'Time (UTC)', 'Page', 'Seconds', 'Visitor ID', 'Name', 'Email', 'Signed in', 'Country', 'Region', 'City', 'Device', 'Browser', 'OS', 'Came from', 'Campaign', 'IP'];
  const lines = [head];
  for (const v of views) {
    const who = visitor.get(v.visitor_id);
    const uid = v.user_id ?? who?.user_id ?? null;
    const acct = uid ? account.get(uid) : undefined;
    lines.push([
      istDay(v.started_at),
      v.started_at,
      v.path,
      String(v.seconds),
      v.visitor_id,
      acct?.full_name ?? '',
      acct?.email ?? who?.email ?? '',
      uid ? 'Yes' : 'No',
      who?.country ?? '',
      who?.region ?? '',
      who?.city ?? '',
      who?.device ?? '',
      who?.browser ?? '',
      who?.os ?? '',
      who?.first_referrer ?? '',
      who?.utm_campaign ?? who?.utm_source ?? '',
      who?.ip ?? '',
    ]);
  }
  // Quoted throughout, and a leading = + - @ neutralised, so a page title or a
  // typed value can never run as a formula when the file is opened in Excel.
  const cell = (s: string) => `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  const csv = '﻿' + lines.map((l) => l.map(cell).join(',')).join('\r\n');
  const today = istDay(new Date());

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="visits-${today}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
