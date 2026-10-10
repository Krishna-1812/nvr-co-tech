import Link from 'next/link';
import type { CSSProperties } from 'react';
import { fmtRupees } from '@/lib/domain/voucher';
import type { VoucherStatus } from '@/lib/domain/workflow';
import { STATUS_TONE } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

/**
 * The shape of the register page, above the filters that change it.
 *
 * A strip of status tiles and one split bar, the way True Property Cost shows
 * where its money came from: the bar answers "how much of this is still moving"
 * before any row is read, and each tile is a door into the filter for that
 * status. Built from the rows the page has already loaded, never from a second
 * query, which is why everything it says is qualified "on this page" — with
 * twenty-five rows to a page, a register-wide claim would be a guess.
 *
 * The two pending states are one tile. They are the same fact (with an approver)
 * and share a colour everywhere else; the filter it links to is the common one.
 */

type Group = {
  key: string;
  label: string;
  statuses: VoucherStatus[];
  /** The status filter the tile links to. */
  filter: VoucherStatus;
};

const GROUPS: Group[] = [
  { key: 'draft', label: 'Draft', statuses: ['draft'], filter: 'draft' },
  {
    key: 'pending',
    label: 'With approvers',
    statuses: ['pending_first', 'pending_second'],
    filter: 'pending_first',
  },
  { key: 'rejected', label: 'Sent back', statuses: ['rejected'], filter: 'rejected' },
  { key: 'approved', label: 'Approved', statuses: ['approved'], filter: 'approved' },
  { key: 'paid', label: 'Paid', statuses: ['paid'], filter: 'paid' },
];

export function RegisterSummary({
  rows,
  activeStatus,
}: {
  rows: { status: VoucherStatus; grand_total: string | number | null }[];
  /** The status filter currently applied, so its tile can say so. */
  activeStatus?: string;
}) {
  const groups = GROUPS.map((g) => {
    const mine = rows.filter((r) => g.statuses.includes(r.status));
    return {
      ...g,
      tone: STATUS_TONE[g.statuses[0]],
      count: mine.length,
      value: mine.reduce((s, r) => s + Number(r.grand_total ?? 0), 0),
    };
  });
  const total = groups.reduce((s, g) => s + g.value, 0);
  const present = groups.filter((g) => g.count > 0);

  return (
    <section
      aria-label="This page by status"
      className="surface-lit a-ring animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-3xl p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="a-label">On this page, by status</p>
        <p className="text-subtle text-[12px]">
          <span className="numeric font-medium text-[var(--text-c)]">{rows.length}</span>{' '}
          {rows.length === 1 ? 'voucher' : 'vouchers'} ·{' '}
          <span className="numeric font-medium text-[var(--text-c)]">{fmtRupees(total)}</span>
        </p>
      </div>

      {/* Value by status. A status with nothing in it takes no space; one with
          a zero-rupee draft still shows, as a sliver, because it exists. */}
      {total > 0 && (
        <div className="mt-4 flex h-3 gap-[2px] overflow-hidden rounded-full">
          {present.map((g, i) => (
            <span
              key={g.key}
              title={`${g.label}: ${fmtRupees(g.value)}`}
              className="a-fill h-full"
              style={{
                flexGrow: Math.max(g.value, total * 0.015),
                flexBasis: 0,
                background: g.tone,
                animationDelay: `${120 + i * 90}ms`,
              }}
            />
          ))}
        </div>
      )}

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {groups.map((g) => {
          const active = activeStatus ? g.statuses.includes(activeStatus as VoucherStatus) : false;
          return (
            <li key={g.key} className="min-w-0">
              <Link
                href={active ? '/vouchers' : `/vouchers?status=${g.filter}`}
                aria-current={active ? 'true' : undefined}
                style={{ '--tone': g.tone } as CSSProperties}
                className={cn(
                  'a-lift group block h-full min-w-0 rounded-2xl border px-4 py-3 transition',
                  active ? 'tinted' : 'surface-sunken',
                  g.count === 0 && !active && 'opacity-60',
                )}
              >
                <span className="a-label inline-flex items-center gap-1.5 truncate">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: g.tone }} />
                  {g.label}
                </span>
                <span className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-[1.15rem] font-semibold tracking-tight tabular-nums">
                    {g.count}
                  </span>
                  <span className="text-subtle truncate text-[12px] tabular-nums">
                    {g.count > 0 ? fmtRupees(g.value) : 'none'}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
