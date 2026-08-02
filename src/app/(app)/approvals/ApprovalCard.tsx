'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import Link from 'next/link';
import { Check, X, Clock, AlertTriangle, ExternalLink, Paperclip, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import { approveVoucher, rejectVoucher } from '@/app/actions/workflow';
import { fmtRupees, fmtDate } from '@/lib/domain/voucher';
import { StatusBadge, ApprovalProgress } from '@/components/StatusBadge';
import type { VoucherStatus } from '@/lib/domain/workflow';
import { Button, buttonClass, Card, Textarea } from '@/components/ui/primitives';
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
    <Card className={cn('overflow-hidden transition', blockedReason && 'opacity-70')}>
      {/*
        Identity and amount first, provenance and controls in a footer under a
        rule. Splitting the card that way means the eye can run down a column of
        payees and amounts without the buttons of each card interrupting it.
      */}
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/vouchers/${voucher.id}`}
              className="numeric font-semibold transition hover:text-brand-600 hover:underline dark:hover:text-brand-300"
            >
              {voucher.voucher_no ?? 'Unnumbered'}
            </Link>
            <StatusBadge status={voucher.status} size="sm" />
            {/* Ageing: an approver needs to see what has been sitting too long. */}
            {age >= 3 && (
              <span
                style={
                  {
                    '--tone': age >= 7 ? 'var(--status-rejected)' : 'var(--status-warn)',
                  } as CSSProperties
                }
                className="tinted inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
              >
                <Clock className="size-3" aria-hidden />
                {age}d waiting
              </span>
            )}
          </div>

          <p className="mt-2 truncate text-base font-semibold">
            {voucher.paid_to ?? <span className="text-subtle font-normal">No payee</span>}
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
        </div>

        <div className="shrink-0 text-right">
          <div className="amount text-xl font-bold sm:text-2xl">
            {fmtRupees(voucher.grand_total)}
          </div>
          <div className="mt-1.5 flex justify-end">
            <ApprovalProgress status={voucher.status} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t bg-[var(--surface-sunken)] px-4 py-2.5">
        <div className="text-subtle flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>
            Raised by <span className="font-medium">{person(voucher.initiator)}</span>{' '}
            {relativeTime(voucher.submitted_at)}
          </span>
          {voucher.status === 'pending_second' && voucher.first_approver && (
            <span>
              1st approval by <span className="font-medium">{person(voucher.first_approver)}</span>
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
            <span
              style={{ '--tone': 'var(--status-warn)' } as CSSProperties}
              className="inline-flex items-center gap-1 font-semibold text-[color-mix(in_oklab,var(--tone)_82%,var(--text-c))]"
            >
              <FileWarning className="size-3" aria-hidden />
              No invoice attached
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/vouchers/${voucher.id}`}
            className={buttonClass({ variant: 'ghost', size: 'sm' })}
          >
            <ExternalLink className="size-4" aria-hidden />
            Review
          </Link>

          {!blockedReason && (
            <>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setRejecting((v) => !v)}
                disabled={pending}
                aria-expanded={rejecting}
              >
                <X className="size-4" aria-hidden />
                <span className="hidden sm:inline">Send back</span>
              </Button>
              <Button variant="success" size="sm" onClick={onApprove} loading={pending}>
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
