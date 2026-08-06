import type { CSSProperties } from 'react';
import { AlertTriangle, Check, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReconStatus } from '@/lib/recon/types';

/**
 * The outcome of a reconciliation, as a chip.
 *
 * Three states, and the difference between the last two is the thing people get
 * wrong, so both the label and the description say it outright. A residual
 * variance means the two books genuinely disagree by an amount nothing on the
 * statement explains. Partial means something narrower and more annoying: one of
 * the files contradicts itself, its own printed closing not following from its
 * own lines, and no amount of reconciling can fix a file that is wrong.
 *
 * Reuses the app's --status-* tokens rather than inventing a fourth palette. On
 * every screen here green already means settled, amber means look at this, and
 * red means it did not work.
 */
export const RECON_TONE: Record<ReconStatus, string> = {
  RECONCILED: 'var(--status-approved)',
  PARTIAL: 'var(--status-warn)',
  NOT_RECONCILED: 'var(--status-rejected)',
};

export const RECON_META: Record<ReconStatus, { label: string; description: string }> = {
  RECONCILED: {
    label: 'Reconciled',
    description: 'The two balances tie out, and every difference between them is listed.',
  },
  PARTIAL: {
    label: 'Partly reconciled',
    description:
      'One of the files disagrees with itself: its stated closing balance does not follow ' +
      'from its own transactions. Check the source before relying on this.',
  },
  NOT_RECONCILED: {
    label: 'Not reconciled',
    description: 'A difference remains that nothing on the statement accounts for.',
  },
};

const ICON: Record<ReconStatus, typeof Check> = {
  RECONCILED: Check,
  PARTIAL: TriangleAlert,
  NOT_RECONCILED: AlertTriangle,
};

export function ReconBadge({
  status,
  size = 'md',
  className,
}: {
  status: ReconStatus;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const meta = RECON_META[status];
  const Icon = ICON[status];

  return (
    <span
      title={meta.description}
      style={{ '--tone': RECON_TONE[status] } as CSSProperties}
      className={cn(
        'tinted inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className,
      )}
    >
      {/* A mark as well as a colour, so this still reads in print and to anyone
          who cannot tell the green from the amber. */}
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} strokeWidth={2.5} aria-hidden />
      {meta.label}
    </span>
  );
}
