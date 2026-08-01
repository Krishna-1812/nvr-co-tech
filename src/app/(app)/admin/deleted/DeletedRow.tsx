'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { restoreVoucher } from '@/app/actions/workflow';
import { purgeVoucher } from '@/app/actions/admin';
import { fmtDate, fmtRupees } from '@/lib/domain/voucher';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { relativeTime } from '@/lib/utils';
import type { DeletedVoucher } from './page';

export function DeletedRow({ voucher }: { voucher: DeletedVoucher }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  // Mirrors purge_voucher: anything that reached approval keeps its record.
  // Postgres refuses regardless; this explains why the button is absent.
  const protectedFromPurge = voucher.status === 'approved' || voucher.status === 'paid';

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(res.error ?? 'That did not work.');
      }
    });

  const label = voucher.voucher_no ?? 'Draft';

  return (
    <>
      <tr className="transition hover:bg-[var(--surface-sunken)]">
        <td className="px-4 py-3">
          <Link
            href={`/vouchers/${voucher.id}`}
            className="numeric font-medium hover:text-brand-600 hover:underline"
          >
            {label}
          </Link>
          <p className="text-subtle text-xs">{fmtDate(voucher.date)}</p>
        </td>

        <td className="text-muted max-w-40 truncate px-4 py-3">{voucher.paid_to ?? '—'}</td>

        <td className="text-muted px-4 py-3">
          {voucher.creator?.full_name ?? voucher.creator?.email ?? '—'}
        </td>

        <td className="text-muted px-4 py-3">
          <time dateTime={voucher.deleted_at} title={new Date(voucher.deleted_at).toLocaleString('en-IN')}>
            {relativeTime(voucher.deleted_at)}
          </time>
        </td>

        <td className="px-4 py-3">
          <StatusBadge status={voucher.status} size="sm" />
        </td>

        <td className="numeric px-4 py-3 text-right font-semibold">
          {fmtRupees(voucher.grand_total)}
        </td>

        <td className="px-4 py-3 text-right">
          <div className="inline-flex gap-1">
            <Button
              onClick={() => run(() => restoreVoucher(voucher.id), `${label} restored.`)}
              disabled={busy}
              className="h-8 px-2.5 text-xs"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Restore
            </Button>

            {protectedFromPurge ? (
              <span
                className="text-subtle inline-flex h-8 items-center px-2 text-xs"
                title="An approved voucher keeps its record permanently"
              >
                Kept
              </span>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                disabled={busy}
                aria-label={`Permanently delete ${label}`}
                className="text-muted rounded-lg p-1.5 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </td>
      </tr>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Permanently delete ${label}?`}
        description="This removes the voucher, its attachments and its history. It cannot be undone."
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={() => run(() => purgeVoucher(voucher.id), `${label} permanently deleted.`)}
          >
            Delete permanently
          </Button>
        </div>
      </Modal>
    </>
  );
}
