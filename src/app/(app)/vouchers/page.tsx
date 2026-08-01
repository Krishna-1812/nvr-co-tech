import Link from 'next/link';
import { FileText, Plus, Download } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { isAdmin, VOUCHER_STATUSES, STATUS_META } from '@/lib/domain/workflow';
import { parseFilters, applyVoucherFilters, hasFilters } from '@/lib/domain/voucherQuery';
import { fmtDate, fmtRupees } from '@/lib/domain/voucher';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, EmptyState } from '@/components/ui/primitives';
import { VoucherFilters } from './VoucherFilters';
import type { VoucherListRow } from '@/lib/domain/rows';

export const metadata = { title: 'Vouchers · NVR Voucher' };

const PAGE_SIZE = 25;

/**
 * The voucher list. v1 loaded every row with no search, filter, sort or
 * pagination — unusable past a few hundred vouchers. This filters and paginates
 * server-side, so the browser only ever receives one page.
 */
export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; chapter?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  // The same filter builder the Excel export uses, so the file you download
  // always matches the rows you are looking at.
  const filters = parseFilters(sp);
  const query = applyVoucherFilters(
    supabase
      .from('vouchers')
      .select('*, chapter:chapters!vouchers_chapter_id_fkey(name)', { count: 'exact' })
      .is('deleted_at', null),
    filters,
    { id: user.id, role: user.role },
  );

  const [{ data, count }, { data: chapters }] = await Promise.all([
    query.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1),
    supabase.from('chapters').select('id, name').eq('is_active', true).order('name'),
  ]);

  const rows = (data ?? []) as unknown as VoucherListRow[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasActiveFilters = hasFilters(filters);
  const exportQuery = new URLSearchParams(
    Object.entries({ status: filters.status, chapter: filters.chapter, q: filters.q })
      .filter(([, v]) => Boolean(v))
      .map(([k, v]) => [k, v as string]),
  ).toString();

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (sp.status) p.set('status', sp.status);
    if (sp.q) p.set('q', sp.q);
    if (sp.chapter) p.set('chapter', sp.chapter);
    p.set('page', String(n));
    return `/vouchers?${p}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vouchers</h1>
          <p className="text-muted mt-1 text-sm">
            {total} voucher{total === 1 ? '' : 's'}
            {isAdmin(user.role) ? ' across all users' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {/*
            The export carries the active filters, so it downloads exactly the
            rows on screen. v1 had no filters and dumped everything.
          */}
          <a
            href={`/vouchers/export${exportQuery ? `?${exportQuery}` : ''}`}
            className="surface inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm transition hover:bg-[var(--surface-sunken)] aria-disabled:pointer-events-none aria-disabled:opacity-50"
            aria-disabled={total === 0}
          >
            <Download className="size-4" aria-hidden />
            Export{hasActiveFilters ? ' these' : ''}
          </a>
          <Link
            href="/vouchers/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Plus className="size-4" aria-hidden />
            New voucher
          </Link>
        </div>
      </header>

      <VoucherFilters
        chapters={(chapters ?? []) as { id: string; name: string }[]}
        statuses={VOUCHER_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
      />

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-8" />}
            title={sp.q || sp.status ? 'Nothing matches those filters' : 'No vouchers yet'}
            description={
              sp.q || sp.status
                ? 'Try clearing the search or choosing a different status.'
                : 'Create your first payment voucher to get started.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="surface-sunken text-subtle text-xs">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Voucher</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Payee</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Chapter</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((v) => (
                  <tr key={v.id} className="transition hover:bg-[var(--surface-sunken)]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/vouchers/${v.id}`}
                        className="numeric font-medium hover:text-brand-600 hover:underline"
                      >
                        {v.voucher_no ?? 'Draft'}
                      </Link>
                    </td>
                    <td className="text-muted max-w-48 truncate px-4 py-3">{v.paid_to ?? '—'}</td>
                    <td className="text-muted px-4 py-3">{v.chapter?.name ?? '—'}</td>
                    <td className="text-muted px-4 py-3">{fmtDate(v.date) || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={v.status} size="sm" />
                    </td>
                    <td className="numeric px-4 py-3 text-right font-semibold">
                      {fmtRupees(v.grand_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <p className="text-muted text-sm">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="surface inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition hover:bg-[var(--surface-sunken)]"
              >
                Previous
              </Link>
            )}
            {page < pages && (
              <Link
                href={pageHref(page + 1)}
                className="surface inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition hover:bg-[var(--surface-sunken)]"
              >
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
