import Link from 'next/link';
import { ChevronRight, Undo2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { STATUS_META, type VoucherStatus } from '@/lib/domain/workflow';
import { fmtRupees } from '@/lib/domain/voucher';
import { Figure } from '@/components/app/Figure';

/**
 * Where a person's vouchers currently sit, drawn as the pipeline it actually is.
 *
 * The shape is the argument. Four stages in a row with chevrons between them says
 * "these happen in this order", which four counts in a grid does not — and a stack
 * of work jammed at "awaiting approval" is then visible from across the room
 * without reading a single number.
 *
 * Sent back is deliberately not one of the four. It is not a later stage, it is a
 * return to the start, so it sits under the rail with an arrow pointing back the
 * way it came. Putting it fifth in the row would draw a workflow this app does not
 * have.
 */

type Stage = {
  key: string;
  label: string;
  statuses: VoucherStatus[];
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
    // Short enough to survive a quarter of a narrow card without truncating.
    // "Awaiting approval" came out as "Awaiting ap…", which loses the only word
    // that mattered.
    key: 'pending',
    label: 'Awaiting',
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
];

const RETURNED: Stage = {
  key: 'rejected',
  label: STATUS_META.rejected.label,
  statuses: ['rejected'],
  color: 'var(--status-rejected)',
  href: '/vouchers?status=rejected',
};

export type PipelineRow = { status: VoucherStatus; grand_total: string | number };

export function VoucherPipeline({ rows }: { rows: PipelineRow[] }) {
  const tally = (s: Stage) => {
    const matching = rows.filter((r) => s.statuses.includes(r.status));
    return {
      ...s,
      count: matching.length,
      value: matching.reduce((sum, r) => sum + Number(r.grand_total ?? 0), 0),
    };
  };

  const stages = STAGES.map(tally);
  const returned = tally(RETURNED);

  const onPath = stages.reduce((sum, s) => sum + s.count, 0);
  if (onPath + returned.count === 0) return null;

  const present = stages.filter((s) => s.count > 0);

  return (
    <div className="space-y-5">
      {/*
        The rail. Segments are grown by flex rather than by percentage width, so a
        stage with one voucher out of forty still gets a visible sliver instead of
        rounding to nothing.
      */}
      <div
        className="a-track flex h-3 gap-[3px] overflow-hidden rounded-full p-[2px]"
        role="img"
        aria-label={present.map((s) => `${s.count} ${s.label}`).join(', ')}
      >
        {present.map((s, i) => (
          <span
            key={s.key}
            title={`${s.label}: ${s.count} · ${fmtRupees(s.value)}`}
            className="a-fill relative h-full overflow-hidden rounded-full"
            style={{
              background: s.color,
              flexGrow: s.count,
              animationDelay: `${i * 90}ms`,
            }}
          >
            {/* A top-lit face, so a solid bar reads as a filled channel rather
                than as a flat rectangle of colour. */}
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(180deg,oklch(1_0_0_/_0.3),transparent_70%)]"
            />
          </span>
        ))}
      </div>

      {/* ── The four stages, in order ── */}
      <ol className="flex flex-wrap items-stretch gap-y-2">
        {stages.map((s, i) => (
          <li key={s.key} className="flex min-w-0 flex-1 items-center gap-1">
            <StageTile stage={s} delay={i * 70} />
            {i < stages.length - 1 && (
              <ChevronRight
                aria-hidden
                className="text-subtle hidden size-4 shrink-0 opacity-50 sm:block"
              />
            )}
          </li>
        ))}
      </ol>

      {/* ── Off the path ── */}
      {returned.count > 0 && (
        <Link
          href={returned.href}
          style={{ '--tone': returned.color } as CSSProperties}
          className="tinted group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition hover:brightness-105"
        >
          <Undo2 className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 text-sm font-medium">
            <span className="numeric font-semibold">{returned.count}</span> sent back to the start
          </span>
          <span className="numeric shrink-0 text-xs opacity-80">{fmtRupees(returned.value)}</span>
          <ChevronRight
            className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}
    </div>
  );
}

/**
 * One stage. Empty stages are drawn rather than dropped: a gap in the middle of a
 * pipeline is information — nothing is waiting for a second approval — and a row
 * that silently loses a tile makes the stages shift position between visits.
 */
function StageTile({
  stage,
  delay,
}: {
  stage: Stage & { count: number; value: number };
  delay: number;
}) {
  const empty = stage.count === 0;

  return (
    <Link
      href={stage.href}
      aria-disabled={empty}
      tabIndex={empty ? -1 : undefined}
      style={{ '--tone': stage.color } as CSSProperties}
      className={
        empty
          ? 'a-hatch pointer-events-none min-w-0 flex-1 rounded-xl border border-dashed px-3 py-2.5 opacity-60'
          : 'surface-sunken hover-lift group min-w-0 flex-1 rounded-xl border px-3 py-2.5 hover:border-[color-mix(in_oklab,var(--tone)_45%,var(--border-c))] hover:bg-[var(--surface-raised)]'
      }
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: empty ? 'var(--border-strong)' : stage.color }}
        />
        <span className="a-label truncate">{stage.label}</span>
      </span>

      <span className="mt-1.5 flex items-baseline justify-between gap-2">
        {empty ? (
          <span className="text-subtle numeric text-xl font-bold">0</span>
        ) : (
          <Figure value={stage.count} delay={delay} className="text-xl" />
        )}
        <span className="numeric text-subtle truncate text-[11px]">
          {empty ? '—' : fmtRupees(stage.value)}
        </span>
      </span>
    </Link>
  );
}
