import Link from 'next/link';
import { STATUS_META, type VoucherStatus } from '@/lib/domain/workflow';
import { fmtRupees } from '@/lib/domain/voucher';

/**
 * Where a person's vouchers currently sit, as one bar.
 *
 * The dashboard previously showed four counts with no sense of flow. This is the
 * same data arranged as the pipeline it actually is, so a stack of work stuck at
 * "awaiting 2nd approval" is visible without reading any numbers.
 */

type Stage = {
  key: string;
  label: string;
  statuses: VoucherStatus[];
  /** Bar colour. Matches the status tokens the badges use. */
  color: string;
  href: string;
};

const STAGES: Stage[] = [
  {
    key: 'draft',
    label: 'Draft',
    statuses: ['draft'],
    color: 'var(--status-draft)',
    href: '/vouchers?status=draft',
  },
  {
    key: 'pending',
    label: 'Awaiting approval',
    statuses: ['pending_first', 'pending_second'],
    color: 'var(--status-pending)',
    href: '/vouchers?status=pending_first',
  },
  {
    key: 'approved',
    label: 'Approved',
    statuses: ['approved'],
    color: 'var(--status-approved)',
    href: '/vouchers?status=approved',
  },
  {
    key: 'paid',
    label: 'Paid',
    statuses: ['paid'],
    color: 'var(--status-paid)',
    href: '/vouchers?status=paid',
  },
  {
    key: 'rejected',
    label: STATUS_META.rejected.label,
    statuses: ['rejected'],
    color: 'var(--status-rejected)',
    href: '/vouchers?status=rejected',
  },
];

export type PipelineRow = { status: VoucherStatus; grand_total: string | number };

export function VoucherPipeline({ rows }: { rows: PipelineRow[] }) {
  const stages = STAGES.map((s) => {
    const matching = rows.filter((r) => s.statuses.includes(r.status));
    return {
      ...s,
      count: matching.length,
      value: matching.reduce((sum, r) => sum + Number(r.grand_total ?? 0), 0),
    };
  });

  const total = stages.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  const present = stages.filter((s) => s.count > 0);

  return (
    <div className="space-y-4">
      <div
        className="flex h-2.5 gap-1 overflow-hidden"
        role="img"
        aria-label={present.map((s) => `${s.count} ${s.label}`).join(', ')}
      >
        {present.map((s) => (
          <span
            key={s.key}
            className="h-full rounded-full transition-[flex-grow] duration-500"
            style={{ background: s.color, flexGrow: s.count }}
          />
        ))}
      </div>

      <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {present.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className="group flex items-baseline gap-2.5 rounded-lg py-0.5 transition"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 translate-y-[-1px] rounded-full"
                style={{ background: s.color }}
              />
              <span className="text-sm font-medium group-hover:text-brand-600 group-hover:underline">
                {s.label}
              </span>
              <span className="numeric text-sm font-semibold">{s.count}</span>
              <span className="numeric text-subtle ml-auto text-xs">{fmtRupees(s.value)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
