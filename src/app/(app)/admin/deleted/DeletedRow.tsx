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
import { Button, Td, Tr } from '@/components/ui/primitives';
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
      <Tr className="group">
        <Td>
          <Link
            href={`/vouchers/${voucher.id}`}
            className="numeric font-medium transition group-hover:text-brand-600 group-hover:underline dark:group-hover:text-brand-300"
          >
            {label}
          </Link>
          <p className="text-subtle numeric text-xs">{fmtDate(voucher.date)}</p>
          {/* Payee is the only way to recognise a draft with no number, so it
              stays on the row even when its own column is gone. */}
          <p className="text-subtle mt-0.5 max-w-36 truncate text-xs md:hidden">
            {voucher.paid_to ?? '—'}
          </p>
          <div className="mt-1.5 sm:hidden">
            <StatusBadge status={voucher.status} size="sm" />
          </div>
        </Td>

        <Td className="text-muted hidden max-w-40 truncate md:table-cell">
          {voucher.paid_to ?? '—'}
        </Td>

        <Td className="text-muted hidden max-w-40 truncate lg:table-cell">
          {voucher.creator?.full_name ?? voucher.creator?.email ?? '—'}
        </Td>

        <Td className="text-muted hidden whitespace-nowrap sm:table-cell">
          <time
            dateTime={voucher.deleted_at}
            title={new Date(voucher.deleted_at).toLocaleString('en-IN')}
          >
            {relativeTime(voucher.deleted_at)}
          </time>
        </Td>

        <Td className="hidden sm:table-cell">
          <StatusBadge status={voucher.status} size="sm" />
        </Td>

        <Td align="right" className="amount font-semibold whitespace-nowrap">
          {fmtRupees(voucher.grand_total)}
        </Td>

        <Td align="right">
          <div className="inline-flex items-center gap-1">
            <Button
              size="sm"
              onClick={() => run(() => restoreVoucher(voucher.id), `${label} restored.`)}
              disabled={busy}
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
                className="text-muted rounded-lg p-1.5 transition hover:bg-[color-mix(in_oklab,var(--status-rejected)_14%,transparent)] hover:text-[var(--status-rejected)] disabled:opacity-40"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </Td>
      </Tr>

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
