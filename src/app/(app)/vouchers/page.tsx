import Link from 'next/link';
import { ChevronLeft, ChevronRight, FileText, Plus, Download } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { isAdmin, VOUCHER_STATUSES, STATUS_META } from '@/lib/domain/workflow';
import { parseFilters, applyVoucherFilters, hasFilters } from '@/lib/domain/voucherQuery';
import { fmtDate, fmtRupees } from '@/lib/domain/voucher';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/PageHeader';
import {
  buttonClass,
  Card,
  DataTable,
  EmptyState,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui/primitives';
import { VoucherFilters } from './VoucherFilters';
import type { VoucherListRow } from '@/lib/domain/rows';

export const metadata = { title: 'Vouchers' };

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
      <PageHeader
        eyebrow="Register"
        title="Vouchers"
        description={
          <>
            <span className="numeric font-semibold text-[var(--text-c)]">{total}</span> voucher
            {total === 1 ? '' : 's'}
            {isAdmin(user.role) ? ' across all users' : ''}
            {hasActiveFilters ? ' matching the current filters' : ''}.
          </>
        }
        action={
          <>
            {/*
              The export carries the active filters, so it downloads exactly the
              rows on screen. v1 had no filters and dumped everything.
            */}
            <a
              href={`/vouchers/export${exportQuery ? `?${exportQuery}` : ''}`}
              className={buttonClass()}
              aria-disabled={total === 0}
            >
              <Download className="size-4" aria-hidden />
              Export{hasActiveFilters ? ' these' : ''}
            </a>
            <Link
              href="/vouchers/new"
              className={buttonClass({ variant: 'primary', className: 'group' })}
            >
              <Plus className="size-4 transition-transform group-hover:rotate-90" aria-hidden />
              New voucher
            </Link>
          </>
        }
      />

      <VoucherFilters
        chapters={(chapters ?? []) as { id: string; name: string }[]}
        statuses={VOUCHER_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
      />

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-6" />}
            title={hasActiveFilters ? 'Nothing matches those filters' : 'No vouchers yet'}
            description={
              hasActiveFilters
                ? 'Try clearing the search or choosing a different status.'
                : 'Create your first payment voucher to get started.'
            }
            action={
              hasActiveFilters ? (
                <Link href="/vouchers" className={buttonClass()}>
                  Clear filters
                </Link>
              ) : (
                <Link href="/vouchers/new" className={buttonClass({ variant: 'primary' })}>
                  <Plus className="size-4" aria-hidden />
                  New voucher
                </Link>
              )
            }
          />
        ) : (
          <DataTable>
            <caption className="sr-only">
              Vouchers, newest first. Page {page} of {pages}.
            </caption>
            <Thead>
              <tr>
                <Th>Voucher</Th>
                <Th className="hidden md:table-cell">Payee</Th>
                <Th className="hidden lg:table-cell">Chapter</Th>
                <Th className="hidden md:table-cell">Date</Th>
                <Th className="hidden sm:table-cell">Status</Th>
                <Th align="right">Amount</Th>
              </tr>
            </Thead>
            <tbody className="divide-y">
              {rows.map((v) => (
                <Tr key={v.id} className="group">
                  <Td>
                    <Link
                      href={`/vouchers/${v.id}`}
                      className="numeric font-medium transition group-hover:text-brand-600 group-hover:underline dark:group-hover:text-brand-300"
                    >
                      {v.voucher_no ?? 'Draft'}
                    </Link>
                    {/*
                      Payee, chapter, date and status each get a column once
                      there is room. On a phone they fold into this cell, so the
                      row is two columns wide and the amount — the reason anyone
                      opens this list — is never the thing pushed off-screen.
                    */}
                    <p className="text-subtle mt-0.5 max-w-40 truncate text-xs md:hidden">
                      {[v.paid_to, v.chapter?.name, fmtDate(v.date)].filter(Boolean).join(' · ') ||
                        '—'}
                    </p>
                    <div className="mt-1.5 sm:hidden">
                      <StatusBadge status={v.status} size="sm" />
                    </div>
                  </Td>
                  <Td className="text-muted hidden max-w-48 truncate md:table-cell">
                    {v.paid_to ?? '—'}
                  </Td>
                  <Td className="text-muted hidden max-w-40 truncate lg:table-cell">
                    {v.chapter?.name ?? '—'}
                  </Td>
                  <Td className="text-muted numeric hidden whitespace-nowrap md:table-cell">
                    {fmtDate(v.date) || '—'}
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <StatusBadge status={v.status} size="sm" />
                  </Td>
                  <Td align="right" className="amount font-semibold whitespace-nowrap">
                    {fmtRupees(v.grand_total)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      {pages > 1 && (
        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
          {/*
            The row range matters more than the page number: it tells you where
            you are in the register, which "page 3 of 9" does not.
          */}
          <p className="text-muted text-sm">
            Showing <span className="numeric font-medium">{from + 1}</span>–
            <span className="numeric font-medium">{Math.min(from + PAGE_SIZE, total)}</span> of{' '}
            <span className="numeric font-medium">{total}</span>
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page === 1}
              tabIndex={page === 1 ? -1 : undefined}
              className={buttonClass({ size: 'sm', className: 'h-9 px-3 text-sm' })}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Link>
            <span className="text-subtle numeric px-1 text-sm">
              {page} / {pages}
            </span>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page === pages}
              tabIndex={page === pages ? -1 : undefined}
              className={buttonClass({ size: 'sm', className: 'h-9 px-3 text-sm' })}
            >
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
