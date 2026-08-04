'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import Link from 'next/link';
import { Check, X, Clock, AlertTriangle, ExternalLink, Paperclip, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import { approveVoucher, rejectVoucher } from '@/app/actions/workflow';
import { fmtRupees, fmtDate } from '@/lib/domain/voucher';
import { Avatar } from '@/components/Avatar';
import { StatusBadge, ApprovalProgress } from '@/components/StatusBadge';
import type { VoucherStatus } from '@/lib/domain/workflow';
import { Button, buttonClass, Card, Textarea } from '@/components/ui/primitives';
import { relativeTime, ageInDays, cn } from '@/lib/utils';

/**
 * Only the columns this card renders. The page selects the full row plus embedded
 * chapter/initiator/approver, but narrowing here keeps the component honest about
 * what it actually depends on.
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
  initiator?: { full_name: string | null; email: string; avatar_url?: string | null } | null;
  first_approver?: { full_name: string | null; email: string; avatar_url?: string | null } | null;
  /** Embedded as a rows array purely to count it. */
  voucher_attachments?: { id: string }[] | null;
};

/** A voucher waiting a fortnight is as bad as the rail can say. */
const AGE_CEILING = 14;

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

  // Green until three days, amber to a week, red past it. The same thresholds the
  // queue's own "longest waiting" figure uses.
  const ageTone =
    age >= 7 ? 'var(--status-rejected)' : age >= 3 ? 'var(--status-warn)' : 'var(--status-approved)';

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
    <Card
      style={{ '--tone': ageTone } as CSSProperties}
      className={cn(
        'group relative overflow-hidden rounded-2xl transition',
        blockedReason ? 'opacity-75' : 'hover:border-[var(--border-strong)]',
      )}
    >
      {/*
        The age rail.
        A vertical gauge down the left edge, filling from the top as a voucher
        ages and passing through amber into red. It means a column of these cards
        can be triaged before a single word is read — which is the whole job of
        this screen. Hatched instead of filled when the voucher is not yours to
        action, because then its age is not your problem.
      */}
      <span aria-hidden className="a-track absolute inset-y-0 left-0 w-[3px]">
        {blockedReason ? (
          <span className="a-hatch block h-full w-full" />
        ) : (
          <span
            className="a-fill-y block w-full origin-top rounded-b-full"
            style={{
              height: `${Math.min(100, Math.max(8, (age / AGE_CEILING) * 100))}%`,
              background: `linear-gradient(180deg, var(--tone), color-mix(in oklab, var(--tone) 40%, transparent))`,
            }}
          />
        )}
      </span>

      {/*
        Identity and amount first, provenance and controls in a footer under a
        rule. Splitting the card that way means the eye can run down a column of
        payees and amounts without the buttons of each card interrupting it.
      */}
      {/*
        A grid rather than a wrapping flex row.
        With flex, the payee and the amount competed for one line and the payee lost
        — "Lex Anand Associates" came out as "Lex Anand Associ…" on a phone, which is
        the one thing on the card you have to be able to read. As a grid the amount
        simply drops below the payee at narrow widths and both get the full width.
      */}
      <div className="grid gap-x-6 gap-y-3 p-4 pl-5 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/vouchers/${voucher.id}`}
              className="numeric text-[13px] font-semibold transition hover:text-brand-600 hover:underline dark:hover:text-brand-300"
            >
              {voucher.voucher_no ?? 'Unnumbered'}
            </Link>
            <StatusBadge status={voucher.status} size="sm" />
            {/* Ageing: an approver needs to see what has been sitting too long. */}
            {age >= 3 && (
              <span className="tinted inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
                <Clock className="size-3" aria-hidden />
                {age}d waiting
              </span>
            )}
          </div>

          <p className="mt-2.5 truncate text-[17px] font-semibold tracking-tight">
            {voucher.paid_to ?? <span className="text-subtle font-normal">No payee</span>}
          </p>
          <p className="text-muted mt-1 truncate text-xs">
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

        <div className="min-w-0 sm:text-right">
          <p className="a-label">Grand total</p>
          <div className="a-figure mt-1 text-2xl sm:text-[1.7rem]">
            {fmtRupees(voucher.grand_total)}
          </div>
          <div className="mt-2 flex sm:justify-end">
            <ApprovalProgress status={voucher.status} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t bg-[var(--surface-sunken)] px-4 py-2.5 pl-5">
        <div className="text-subtle flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {/* Who is asking, with their face. An approver working down a queue is
              deciding partly on who raised it, and a name is slower to place than
              a name and a face together. */}
          <span className="inline-flex items-center gap-1.5">
            Raised by
            {voucher.initiator && (
              <Avatar
                name={voucher.initiator.full_name}
                email={voucher.initiator.email}
                url={voucher.initiator.avatar_url}
                px={36}
                className="size-[18px] rounded-full text-[8px]"
              />
            )}
            <span className="font-medium">{person(voucher.initiator)}</span>{' '}
            {relativeTime(voucher.submitted_at)}
          </span>
          {voucher.status === 'pending_second' && voucher.first_approver && (
            <span className="inline-flex items-center gap-1.5">
              1st approval by
              <Avatar
                name={voucher.first_approver.full_name}
                email={voucher.first_approver.email}
                url={voucher.first_approver.avatar_url}
                px={36}
                className="size-[18px] rounded-full text-[8px]"
              />
              <span className="font-medium">{person(voucher.first_approver)}</span>
            </span>
          )}

          {/*
            Whether there is an invoice to check against is the first thing an
            approver needs, and it belongs here rather than one click away.
            Approving an amount with no supporting document is exactly what this
            rebuild is meant to make visible.
          */}
          {attachmentCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="size-3" aria-hidden />
              {attachmentCount} file{attachmentCount === 1 ? '' : 's'}
            </span>
          ) : (
            <span
              style={{ '--tone': 'var(--status-warn)' } as CSSProperties}
              className="tinted inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold"
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
        <p className="text-muted flex items-center gap-2 border-t bg-[var(--surface-sunken)] px-4 py-2.5 pl-5 text-xs">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {blockedReason}
        </p>
      )}

      {/* Rejection needs a reason — that is the whole point of sending it back. */}
      {rejecting && (
        <div className="animate-[rise_0.3s_cubic-bezier(0.22,1,0.36,1)] space-y-3 border-t bg-[var(--surface-sunken)] p-4 pl-5">
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
