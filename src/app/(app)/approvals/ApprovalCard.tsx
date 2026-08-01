'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, X, Clock, AlertTriangle, ExternalLink, Paperclip, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import { approveVoucher, rejectVoucher } from '@/app/actions/workflow';
import { fmtRupees, fmtDate } from '@/lib/domain/voucher';
import { StatusBadge, ApprovalProgress } from '@/components/StatusBadge';
import type { VoucherStatus } from '@/lib/domain/workflow';
import { Button, Card, Textarea } from '@/components/ui/primitives';
import { relativeTime, ageInDays, cn } from '@/lib/utils';

/**
 * Only the columns this card renders. The page selects the full row plus
 * embedded chapter/initiator/approver, but narrowing here keeps the component
 * honest about what it actually depends on.
 */
export type ApprovalRow = {
  id: string;
  voucher_no: string | null;
  status: VoucherStatus;
  date: string | null;
  grand_total: number;
  paid_to: string | null;
  event_name: string | null;
  invoice_no: string | null;
  submitted_at: string | null;
  chapter?: { name: string; code: string } | null;
  initiator?: { full_name: string | null; email: string } | null;
  first_approver?: { full_name: string | null; email: string } | null;
  /** Embedded as a rows array purely to count it. */
  voucher_attachments?: { id: string }[] | null;
};

export function ApprovalCard({
  voucher,
  blockedReason,
}: {
  voucher: ApprovalRow;
  currentUserId: string;
  blockedReason?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const age = ageInDays(voucher.submitted_at);
  const attachmentCount = voucher.voucher_attachments?.length ?? 0;
  const person = (p?: { full_name: string | null; email: string } | null) =>
    p?.full_name ?? p?.email ?? 'Unknown';

  const onApprove = () =>
    startTransition(async () => {
      const res = await approveVoucher({ id: voucher.id });
      if (res.ok) {
        toast.success(
          res.data.status === 'approved'
            ? `${voucher.voucher_no} fully approved.`
            : `${voucher.voucher_no} approved — now waiting for a second approver.`,
        );
      } else {
        // The server messages are written for humans; show them as-is.
        toast.error(res.error);
      }
    });

  const onReject = () =>
    startTransition(async () => {
      const res = await rejectVoucher({ id: voucher.id, reason });
      if (res.ok) {
        toast.success(`${voucher.voucher_no} sent back for correction.`);
        setRejecting(false);
        setReason('');
      } else {
        toast.error(res.error);
      }
    });

  return (
    <Card className={cn('overflow-hidden transition', blockedReason && 'opacity-60')}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-6">
        {/* Identity + amount */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/vouchers/${voucher.id}`}
              className="numeric font-semibold hover:text-brand-600 hover:underline"
            >
              {voucher.voucher_no ?? 'Unnumbered'}
            </Link>
            <StatusBadge status={voucher.status} size="sm" />
            {/* Ageing: an approver needs to see what has been sitting too long. */}
            {age >= 3 && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  age >= 7
                    ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
                )}
              >
                <Clock className="size-3" aria-hidden />
                {age}d waiting
              </span>
            )}
          </div>

          <p className="mt-1.5 truncate text-sm font-medium">
            {voucher.paid_to ?? <span className="text-subtle">No payee</span>}
          </p>
          <p className="text-muted mt-0.5 truncate text-xs">
            {[
              voucher.chapter?.name,
              voucher.event_name,
              voucher.invoice_no && `Inv ${voucher.invoice_no}`,
              voucher.date && fmtDate(voucher.date),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <div className="text-subtle mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span>
              Raised by <span className="font-medium">{person(voucher.initiator)}</span>{' '}
              {relativeTime(voucher.submitted_at)}
            </span>
            {voucher.status === 'pending_second' && voucher.first_approver && (
              <span>
                1st approval by{' '}
                <span className="font-medium">{person(voucher.first_approver)}</span>
              </span>
            )}

            {/*
              Whether there is an invoice to check against is the first thing an
              approver needs, and it belongs here rather than one click away.
              Approving an amount with no supporting document is exactly what
              this rebuild is meant to make visible.
            */}
            {attachmentCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="size-3" aria-hidden />
                {attachmentCount} file{attachmentCount === 1 ? '' : 's'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                <FileWarning className="size-3" aria-hidden />
                No invoice attached
              </span>
            )}
          </div>
        </div>

        {/* Amount + progress */}
        <div className="flex shrink-0 items-center gap-6 sm:flex-col sm:items-end sm:gap-2">
          <div className="numeric text-lg font-bold">{fmtRupees(voucher.grand_total)}</div>
          <ApprovalProgress status={voucher.status} />
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/vouchers/${voucher.id}`}
            className="text-muted inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition hover:bg-[var(--surface-sunken)]"
          >
            <ExternalLink className="size-4" aria-hidden />
            <span className="hidden sm:inline">Review</span>
          </Link>

          {!blockedReason && (
            <>
              <Button
                variant="danger"
                onClick={() => setRejecting((v) => !v)}
                disabled={pending}
                aria-expanded={rejecting}
              >
                <X className="size-4" aria-hidden />
                <span className="hidden sm:inline">Send back</span>
              </Button>
              <Button variant="success" onClick={onApprove} loading={pending}>
                <Check className="size-4" aria-hidden />
                Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Why this one can't be actioned — explain rather than silently grey out. */}
      {blockedReason && (
        <p className="text-muted flex items-center gap-2 border-t bg-[var(--surface-sunken)] px-4 py-2.5 text-xs">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {blockedReason}
        </p>
      )}

      {/* Rejection needs a reason — that is the whole point of sending it back. */}
      {rejecting && (
        <div className="space-y-3 border-t bg-[var(--surface-sunken)] p-4">
          <label htmlFor={`reason-${voucher.id}`} className="block text-sm font-medium">
            What needs fixing?
          </label>
          <Textarea
            id={`reason-${voucher.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Invoice date does not match the supporting document."
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRejecting(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={onReject}
              loading={pending}
              disabled={reason.trim().length < 3}
            >
              Send back to {person(voucher.initiator)}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
