'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, X, Pencil, RotateCcw, Wallet, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  approveVoucher,
  rejectVoucher,
  reopenVoucher,
  markVoucherPaid,
  submitVoucher,
} from '@/app/actions/workflow';
import {
  canApproveVoucher,
  approvalBlockedReason,
  canEdit,
  canReopen,
  canMarkPaid,
  canSubmit,
  type VoucherActor,
  type VoucherLike,
} from '@/lib/domain/workflow';
import { Button, Field, Input, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';

type Props = {
  voucher: VoucherLike & { id: string; voucher_no: string | null };
  me: VoucherActor;
  /** Off means submit pays the voucher immediately instead of queuing it (0013). */
  requiresApproval: boolean;
};

/**
 * Every action a person can take on a voucher, filtered to what this person can
 * actually do. The mirrored permission checks keep the UI honest; Postgres has
 * the final say, and its refusal messages are shown verbatim.
 */
export function VoucherActions({ voucher, me, requiresApproval }: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [utr, setUtr] = useState('');

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        setRejectOpen(false);
        setPaidOpen(false);
        setReopenOpen(false);
        setReason('');
        setUtr('');
        router.refresh();
      } else {
        toast.error(res.error ?? 'That did not work.');
      }
    });

  const approvable = canApproveVoucher(voucher, me);
  const blocked = approvalBlockedReason(voucher, me);
  const showApprovalUi = ['pending_first', 'pending_second'].includes(voucher.status);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canEdit(voucher, me) && (
          <Link
            href={`/vouchers/${voucher.id}/edit`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 text-sm font-semibold shadow-sm transition hover:bg-[var(--surface-sunken)]"
          >
            <Pencil className="size-4" aria-hidden />
            Edit
          </Link>
        )}

        {canSubmit(voucher, me) && (
          <Button
            variant="primary"
            loading={busy}
            onClick={() =>
              run(
                () => submitVoucher(voucher.id),
                requiresApproval
                  ? `${voucher.voucher_no ?? 'Voucher'} submitted for approval.`
                  : `${voucher.voucher_no ?? 'Voucher'} recorded as paid.`,
              )
            }
          >
            <Send className="size-4" aria-hidden />
            {requiresApproval ? 'Submit for approval' : 'Submit & pay'}
          </Button>
        )}

        {showApprovalUi && approvable && (
          <>
            <Button variant="success" loading={busy} onClick={() =>
              run(() => approveVoucher({ id: voucher.id }), 'Approval recorded.')
            }>
              <Check className="size-4" aria-hidden />
              Approve
            </Button>
            <Button variant="danger" onClick={() => setRejectOpen(true)} disabled={busy}>
              <X className="size-4" aria-hidden />
              Send back
            </Button>
          </>
        )}

        {canReopen(voucher, me) && (
          <Button onClick={() => setReopenOpen(true)} disabled={busy}>
            <RotateCcw className="size-4" aria-hidden />
            Reopen
          </Button>
        )}

        {canMarkPaid(voucher, me) && (
          <Button variant="primary" onClick={() => setPaidOpen(true)} disabled={busy}>
            <Wallet className="size-4" aria-hidden />
            Mark paid
          </Button>
        )}
      </div>

      {/* Explain, rather than silently offering nothing. */}
      {showApprovalUi && blocked && (
        <p className="text-muted rounded-lg border border-dashed px-3 py-2 text-xs">{blocked}</p>
      )}

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Send back for correction"
        description="The person who raised this voucher will see your reason and can resubmit."
      >
        <div className="space-y-4">
          <Field label="What needs fixing?" htmlFor="reject-reason" required>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The invoice date does not match the supporting document."
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRejectOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={reason.trim().length < 3}
              onClick={() =>
                run(() => rejectVoucher({ id: voucher.id, reason }), 'Sent back for correction.')
              }
            >
              Send back
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={paidOpen}
        onClose={() => setPaidOpen(false)}
        title="Mark as paid"
        description="Records the bank reference. This is final — a paid voucher cannot be reopened."
      >
        <div className="space-y-4">
          <Field label="UTR / reference number" htmlFor="paid-utr" required>
            <Input
              id="paid-utr"
              className="numeric"
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setPaidOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={utr.trim().length < 3}
              onClick={() => run(() => markVoucherPaid({ id: voucher.id, utr }), 'Marked as paid.')}
            >
              Mark paid
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        title="Reopen this voucher"
        description={
          voucher.status === 'approved'
            ? 'This voids both approvals and returns the voucher to draft. It will be recorded.'
            : 'Returns the voucher to draft so it can be corrected and resubmitted.'
        }
      >
        <div className="space-y-4">
          {voucher.status === 'approved' && (
            <Field label="Why are you reopening it?" htmlFor="reopen-reason" required>
              <Textarea
                id="reopen-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setReopenOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={voucher.status === 'approved' && reason.trim().length < 3}
              onClick={() =>
                run(() => reopenVoucher({ id: voucher.id, reason }), 'Reopened as a draft.')
              }
            >
              Reopen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
