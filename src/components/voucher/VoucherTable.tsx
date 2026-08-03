import Link from 'next/link';
import type { CSSProperties } from 'react';
import { fmtDate, fmtRupees } from '@/lib/domain/voucher';
import type { VoucherStatus } from '@/lib/domain/workflow';
import { StatusBadge, STATUS_TONE } from '@/components/StatusBadge';
import { DataTable, Td, Th, Thead, Tr } from '@/components/ui/primitives';

/**
 * The register, wherever it appears.
 *
 * The dashboard and the voucher list were rendering the same table twice, with the
 * same six columns, the same mobile folding and the same hover treatment written
 * out separately. They had already drifted on one column. This is that table once.
 *
 * Two things it does that a plain table does not:
 *
 *   Every row carries a status rail in the gutter, so the shape of the register is
 *   readable as a column of colour before any word is read. A badge in the middle
 *   of a wide row does not do that.
 *
 *   Amounts are plotted as well as printed. A magnitude bar under each figure is
 *   drawn against the largest amount on the page, which is what makes the one
 *   payment worth twenty times the others findable at a glance. It is relative to
 *   the page and not to the register, and says so in the header.
 */
export type VoucherTableRow = {
  id: string;
  voucher_no: string | null;
  status: VoucherStatus;
  date: string | null;
  paid_to: string | null;
  grand_total: string | number;
  chapter?: { name: string } | null;
};

export function VoucherTable({
  rows,
  showChapter = false,
  caption,
}: {
  rows: VoucherTableRow[];
  showChapter?: boolean;
  caption?: string;
}) {
  const peak = Math.max(1, ...rows.map((r) => Math.abs(Number(r.grand_total ?? 0))));

  return (
    <DataTable>
      {caption && <caption className="sr-only">{caption}</caption>}
      <Thead>
        <tr>
          {/* The rail's gutter. Named for screen readers, invisible to everyone
              else — the colour repeats what the Status column already says. */}
          <Th className="w-1 px-0">
            <span className="sr-only">Status colour</span>
          </Th>
          <Th>Voucher</Th>
          <Th className="hidden md:table-cell">Payee</Th>
          {showChapter && <Th className="hidden lg:table-cell">Chapter</Th>}
          <Th className="hidden md:table-cell">Date</Th>
          <Th className="hidden sm:table-cell">Status</Th>
          <Th align="right" title="Bars are relative to the largest amount on this page">
            Amount
          </Th>
        </tr>
      </Thead>
      <tbody className="divide-y">
        {rows.map((v, i) => {
          const amount = Number(v.grand_total ?? 0);
          const tone = STATUS_TONE[v.status];

          return (
            <Tr
              key={v.id}
              style={{ '--tone': tone, animationDelay: `${Math.min(i, 12) * 25}ms` } as CSSProperties}
              className="group animate-[fade_0.4s_ease-out_backwards]"
            >
              <Td className="w-1 px-0">
                <span
                  aria-hidden
                  className="block h-9 w-[3px] rounded-r-full opacity-70 transition-opacity group-hover:opacity-100"
                  style={{ background: tone }}
                />
              </Td>

              <Td>
                <Link
                  href={`/vouchers/${v.id}`}
                  className="numeric font-medium transition group-hover:text-brand-600 group-hover:underline dark:group-hover:text-brand-300"
                >
                  {v.voucher_no ?? 'Draft'}
                </Link>
                {/*
                  Payee, chapter, date and status each get a column once there is
                  room. On a phone they fold in here, so the row is two columns
                  wide and the amount — the reason anyone opens this list — is
                  never the thing pushed off-screen.
                */}
                <p className="text-subtle mt-0.5 max-w-40 truncate text-xs md:hidden">
                  {[v.paid_to, showChapter ? v.chapter?.name : null, fmtDate(v.date)]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
                <div className="mt-1.5 sm:hidden">
                  <StatusBadge status={v.status} size="sm" />
                </div>
              </Td>

              <Td className="text-muted hidden max-w-48 truncate md:table-cell">
                {v.paid_to ?? '—'}
              </Td>

              {showChapter && (
                <Td className="text-muted hidden max-w-40 truncate lg:table-cell">
                  {v.chapter?.name ?? '—'}
                </Td>
              )}

              <Td className="text-muted numeric hidden whitespace-nowrap md:table-cell">
                {fmtDate(v.date) || '—'}
              </Td>

              <Td className="hidden sm:table-cell">
                <StatusBadge status={v.status} size="sm" />
              </Td>

              <Td align="right" className="whitespace-nowrap">
                <span className="amount font-semibold">{fmtRupees(amount)}</span>
                {/* Right-anchored so the bars share an edge with the figures and
                    can be compared down the column. */}
                <span
                  aria-hidden
                  className="a-track mt-1.5 ml-auto block h-[3px] w-20 overflow-hidden rounded-full"
                >
                  <span
                    className="a-fill-end ml-auto block h-full rounded-full"
                    style={{
                      width: `${Math.max(4, (Math.abs(amount) / peak) * 100)}%`,
                      background: tone,
                      animationDelay: `${Math.min(i, 12) * 25}ms`,
                    }}
                  />
                </span>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
