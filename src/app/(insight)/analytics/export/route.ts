import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAnalyticsAdmin } from '@/lib/analytics/admin';
import { istDay } from '@/lib/analytics/report';
import { OUTCOME_LABEL, viaLabel } from '@/lib/analytics/activity';
import type { AdminAccountRow, SiteChatRow, SiteViewRow, SiteVisitorRow } from '@/lib/supabase/types';

/**
 * Every recorded page view as a CSV, one row each, with the visitor and the
 * account it belongs to beside it: the Admin settings "Download" button. With
 * `?what=chats`, every question put to the chat instead, with its answer.
 *
 * Admins only, asked here because a route handler sits outside the layout's
 * gate. Read in pages of a thousand, the most Supabase returns at once.
 */
export async function GET(request: Request) {
  const chats = new URL(request.url).searchParams.get('what') === 'chats';
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

  const [views, visitors, accounts, asked] = await Promise.all([
    chats ? Promise.resolve([] as SiteViewRow[]) : all<SiteViewRow>((f, t) => supabase.from('site_views').select('*').order('started_at', { ascending: false }).range(f, t)),
    all<SiteVisitorRow>((f, t) => supabase.from('site_visitors').select('*').range(f, t)),
    supabase.rpc('admin_accounts'),
    chats ? all<SiteChatRow>((f, t) => supabase.from('site_chats').select('*').order('at', { ascending: false }).range(f, t)) : Promise.resolve([] as SiteChatRow[]),
  ]);
  const visitor = new Map(visitors.map((v) => [v.id, v]));
  const account = new Map(((accounts.data ?? []) as AdminAccountRow[]).map((a) => [a.id, a]));

  if (chats) {
    const rows = [['Date (IST)', 'Time (UTC)', 'Name', 'Email', 'Visitor ID', 'Signed in', 'Assistant', 'Page', 'Asked through', 'Question', 'Answer', 'Outcome', 'Error', 'Pages it used', 'Sums it did', 'First word (ms)', 'Whole answer (ms)', 'Model', 'Chat']];
    for (const c of asked) {
      const who = c.visitor_id ? visitor.get(c.visitor_id) : undefined;
      const uid = c.user_id ?? who?.user_id ?? null;
      const acct = uid ? account.get(uid) : undefined;
      rows.push([
        istDay(c.at),
        c.at,
        acct?.full_name ?? '',
        acct?.email ?? who?.email ?? '',
        c.visitor_id ?? '',
        uid ? 'Yes' : 'No',
        c.mode === 'member' ? 'Workspace' : 'Public',
        c.path ?? '',
        viaLabel(c.via),
        c.question,
        c.answer ?? '',
        OUTCOME_LABEL[c.outcome] ?? c.outcome,
        c.error ?? '',
        (c.sources ?? []).map((x) => x.title).join('; '),
        (c.tools ?? []).map((x) => `${x.label}: ${x.summary}`).join('; '),
        c.first_ms === null ? '' : String(c.first_ms),
        c.total_ms === null ? '' : String(c.total_ms),
        c.model ?? '',
        c.conversation ?? '',
      ]);
    }
    return csvResponse(rows, 'chats');
  }

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
  return csvResponse(lines, 'visits');
}

function csvResponse(lines: string[][], name: string) {
  // Quoted throughout, and a leading = + - @ neutralised, so a page title or a
  // typed value can never run as a formula when the file is opened in Excel.
  const cell = (s: string) => `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  const csv = '﻿' + lines.map((l) => l.map(cell).join(',')).join('\r\n');
  const today = istDay(new Date());

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}-${today}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
