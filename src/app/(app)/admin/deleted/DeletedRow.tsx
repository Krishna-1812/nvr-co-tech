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
import { Avatar } from '@/components/Avatar';
import { Button, Td, Tr } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { relativeTime } from '@/lib/utils';
import type { DeletedVoucher } from './page';

export function DeletedRow({
  voucher,
  viewerIsOwner,
}: {
  voucher: DeletedVoucher;
  viewerIsOwner: boolean;
}) {
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
      <Tr className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-4 py-3 sm:table-row sm:gap-0 sm:px-0 sm:py-0">
        <Td className="col-start-1 row-span-2 row-start-1 px-0 py-0 sm:table-cell sm:px-4 sm:py-3">
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

        <Td className="text-muted hidden lg:table-cell">
          {voucher.creator ? (
            <span className="flex items-center gap-2">
              <Avatar
                name={voucher.creator.full_name}
                email={voucher.creator.email}
                url={voucher.creator.avatar_url}
                px={44}
                className="size-[22px] rounded-full text-[9px]"
              />
              <span className="max-w-32 truncate">
                {voucher.creator.full_name ?? voucher.creator.email}
              </span>
            </span>
          ) : (
            '—'
          )}
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

        <Td
          align="right"
          className="amount col-start-2 row-start-1 px-0 py-0 font-semibold whitespace-nowrap sm:table-cell sm:px-4 sm:py-3"
        >
          {fmtRupees(voucher.grand_total)}
        </Td>

        <Td
          align="right"
          className="col-start-2 row-start-2 px-0 py-0 sm:table-cell sm:px-4 sm:py-3"
        >
          <div className="inline-flex items-center gap-1">
            <Button
              size="sm"
              className="h-10 sm:h-8"
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
            ) : !viewerIsOwner ? (
              <span
                className="text-subtle inline-flex h-8 items-center px-2 text-xs"
                title="Only an owner can permanently delete a voucher"
              >
                Owner only
              </span>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                disabled={busy}
                aria-label={`Permanently delete ${label}`}
                className="text-muted grid size-10 place-items-center rounded-lg transition hover:bg-[color-mix(in_oklab,var(--status-rejected)_14%,transparent)] hover:text-[var(--status-rejected)] disabled:opacity-40 sm:size-7"
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
