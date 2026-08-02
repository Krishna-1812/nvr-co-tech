import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Calculator,
  Check,
  Download,
  Eye,
  FileText,
  History,
  Paperclip,
  ShieldCheck,
} from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { fmtDate, fmtRupees } from '@/lib/domain/voucher';
import { STATUS_META, canEdit, type VoucherLike } from '@/lib/domain/workflow';
import { StatusBadge, ApprovalProgress } from '@/components/StatusBadge';
import { buttonClass, Card, CardTitle } from '@/components/ui/primitives';
import { AuditTimeline } from '@/components/voucher/AuditTimeline';
import { Attachments } from '@/components/voucher/Attachments';
import type { AttachmentRow } from '@/app/actions/attachments';
import { VOUCHER_DETAIL_SELECT } from '@/lib/domain/rows';
import type { VoucherDetailRow, AuditRow, PersonRef } from '@/lib/domain/rows';
import { VoucherActions } from '@/components/voucher/VoucherActions';

export const metadata = { title: 'Voucher' };

/** A labelled value; hides itself when there is nothing to show. */
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="min-w-0">
      <dt className="text-subtle text-[11px] font-semibold tracking-[0.06em] uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-medium break-words">{value}</dd>
    </div>
  );
}

/**
 * One rung of the amount ladder. The sign lives in its own fixed-width column so
 * the additions and the deductions line up as two visible groups — on a printed
 * voucher that is the difference between checking the arithmetic and taking it
 * on trust.
 */
function Money({
  label,
  value,
  sign,
  strong,
}: {
  label: string;
  value: number;
  sign?: '+' | '−';
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span
          aria-hidden
          className="text-subtle numeric w-2 shrink-0 text-center text-xs font-semibold"
        >
          {sign}
        </span>
        <span className={strong ? 'text-sm font-semibold' : 'text-muted text-sm'}>{label}</span>
      </span>
      <span className={strong ? 'amount text-base font-bold' : 'numeric text-sm'}>
        {fmtRupees(value)}
      </span>
    </div>
  );
}

export default async function VoucherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: voucher } = await supabase
    .from('vouchers')
    .select(VOUCHER_DETAIL_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!voucher) notFound();

  const { data: attachments } = await supabase
    .from('voucher_attachments')
    .select('id, voucher_id, storage_path, file_name, mime_type, size_bytes, created_at')
    .eq('voucher_id', id)
    .order('created_at', { ascending: true });

  const { data: audit } = await supabase
    .from('voucher_audit')
    .select('id, action, note, created_at, actor:profiles!voucher_audit_actor_id_fkey(full_name, email)')
    .eq('voucher_id', id)
    .order('created_at', { ascending: true });

  // Hand-written Database types carry no Relationships, so embedded joins need
  // an assertion. Regenerating types from the live schema removes this.
  const v = voucher as unknown as VoucherDetailRow;
  const person = (p: PersonRef) => p?.full_name ?? p?.email ?? null;

  return (
    <div className="space-y-6">
      <Link
        href="/vouchers"
        className="text-muted -ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 text-sm font-medium transition hover:text-[var(--text-c)]"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to vouchers
      </Link>

      {/*
        The identity of the voucher and the sum being authorised are one object,
        so they share one card: nobody should have to look in two places to know
        which number they are about to approve.
      */}
      <Card className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="numeric text-2xl font-bold tracking-tight">
                {v.voucher_no ?? 'Draft voucher'}
              </h1>
              <StatusBadge status={v.status} />
            </div>
            <p className="text-muted mt-1.5 text-sm text-pretty">
              {STATUS_META[v.status].description}
            </p>
            {v.paid_to && (
              <p className="mt-2.5 text-sm">
                <span className="text-subtle">Payable to </span>
                <span className="font-semibold">{v.paid_to}</span>
              </p>
            )}
          </div>

          <div className="sm:text-right">
            <p className="text-subtle text-[11px] font-semibold tracking-[0.06em] uppercase">
              Grand total
            </p>
            <p className="amount mt-0.5 text-3xl font-bold sm:text-4xl">
              {fmtRupees(v.grand_total)}
            </p>
            {['pending_first', 'pending_second', 'approved', 'paid'].includes(v.status) && (
              <div className="mt-2 flex sm:justify-end">
                <ApprovalProgress status={v.status} />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 border-t bg-[var(--surface-sunken)] p-4">
          <VoucherActions
            voucher={voucher as unknown as VoucherLike & { id: string; voucher_no: string | null }}
            me={{ id: user.id, role: user.role }}
          />

          <div className="flex gap-2">
            <a
              href={`/vouchers/${id}/pdf`}
              target="_blank"
              rel="noopener"
              className={buttonClass()}
            >
              <Eye className="size-4" aria-hidden />
              View PDF
            </a>
            <a href={`/vouchers/${id}/pdf`} download className={buttonClass()}>
              <Download className="size-4" aria-hidden />
              <span className="hidden sm:inline">Download</span>
            </a>
          </div>
        </div>
      </Card>

      {v.status === 'rejected' && v.rejection_reason && (
        <div
          role="alert"
          style={{ '--tone': 'var(--status-rejected)' } as React.CSSProperties}
          className="tinted flex gap-3 rounded-xl border p-4"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              Sent back by {person(v.rejecter) ?? 'an approver'}
            </p>
            <p className="mt-1 text-sm text-pretty opacity-90">{v.rejection_reason}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_23rem] lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardTitle icon={<FileText className="size-4" />} title="Voucher details" />
            <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Date" value={fmtDate(v.date)} />
              <Detail label="Chapter" value={v.chapter?.name} />
              <Detail label="Sponsorship" value={v.sponsored} />
              <Detail label="Event" value={v.event_name} />
              <Detail label="Event date" value={fmtDate(v.event_date)} />
              <Detail label="Narration" value={v.event_narration} />
              <Detail label="Type of supporting" value={v.type_of_supporting} />
              <Detail label="Type of payment" value={v.type_of_payment} />
              <Detail label="Invoice no." value={v.invoice_no} />
              <Detail label="Invoice date" value={fmtDate(v.invoice_date)} />
              <Detail label="Invoice received" value={fmtDate(v.invoice_received_date)} />
            </dl>
          </Card>

          <Card>
            <CardTitle icon={<Banknote className="size-4" />} title="Payment" />
            <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Paid to" value={v.paid_to} />
              <Detail label="Paid by chapter" value={v.paid_by?.name} />
              <Detail label="Payment date" value={fmtDate(v.payment_date)} />
              <Detail label="Beneficiary" value={v.beneficiary_name} />
              <Detail label="UTR / ref" value={<span className="numeric">{v.utr_ref}</span>} />
              <Detail label="PAN" value={<span className="numeric">{v.pan_number}</span>} />
              <Detail label="GSTIN" value={<span className="numeric">{v.gst_number}</span>} />
            </dl>
          </Card>

          <Card>
            <CardTitle icon={<History className="size-4" />} title="History" />
            <AuditTimeline entries={(audit ?? []) as unknown as AuditRow[]} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardTitle icon={<Calculator className="size-4" />} title="Amounts" />
            <div className="divide-y px-5 py-2">
              <div className="py-1">
                <Money label="Basic value" value={Number(v.basic_value)} />
                {Number(v.cgst) > 0 && <Money label="CGST" sign="+" value={Number(v.cgst)} />}
                {Number(v.sgst) > 0 && <Money label="SGST" sign="+" value={Number(v.sgst)} />}
                {Number(v.igst) > 0 && <Money label="IGST" sign="+" value={Number(v.igst)} />}
                {Number(v.vat) > 0 && (
                  <Money label="VAT / other" sign="+" value={Number(v.vat)} />
                )}
              </div>
              <div className="py-1">
                <Money label="Net total" value={Number(v.net_total)} strong />
              </div>
              <div className="py-1">
                {Number(v.tds) > 0 && <Money label="TDS" sign="−" value={Number(v.tds)} />}
                {Number(v.advance) > 0 && (
                  <Money label="Advance" sign="−" value={Number(v.advance)} />
                )}
                {Number(v.tips) > 0 && <Money label="Tips" sign="+" value={Number(v.tips)} />}
                {Number(v.discount) > 0 && (
                  <Money label="Discount" sign="−" value={Number(v.discount)} />
                )}
              </div>
            </div>
            {/*
              The grand total leaves the ladder and sits on the brand, because it
              is the figure being authorised — every other row on this card only
              explains how it was reached.
            */}
            <div className="gradient-brand flex items-baseline justify-between gap-4 px-5 py-3.5 text-white">
              <span className="text-xs font-semibold tracking-[0.06em] uppercase opacity-90">
                Grand total
              </span>
              <span className="amount text-xl font-bold">{fmtRupees(v.grand_total)}</span>
            </div>
          </Card>

          <Card>
            <CardTitle icon={<ShieldCheck className="size-4" />} title="Approvals" />
            <div className="space-y-3 p-5">
              <ApprovalStep
                label="Raised by"
                who={person(v.initiator)}
                when={fmtDate(v.submitted_at ?? v.created_at)}
                done={Boolean(person(v.initiator))}
              />
              <ApprovalStep
                label="First approval"
                who={person(v.first_approver)}
                when={fmtDate(v.approved_1_at)}
                done={Boolean(person(v.first_approver))}
              />
              <ApprovalStep
                label="Second approval"
                who={person(v.second_approver)}
                when={fmtDate(v.approved_2_at)}
                done={Boolean(person(v.second_approver))}
              />
            </div>
          </Card>

          <Card>
            <CardTitle icon={<Paperclip className="size-4" />} title="Invoice & supporting files" />
            <Attachments
              voucherId={id}
              initial={(attachments ?? []) as AttachmentRow[]}
              canEdit={canEdit(voucher as unknown as VoucherLike, { id: user.id, role: user.role })}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * One rung of the approval chain, shown whether or not it has happened yet. An
 * outstanding approval is the most useful thing on this card, so an empty rung
 * has to be visible rather than omitted the way the plain definition list did.
 */
function ApprovalStep({
  label,
  who,
  when,
  done,
}: {
  label: string;
  who: string | null;
  when: string;
  done: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className={
          done
            ? 'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--status-approved)] text-white'
            : 'mt-0.5 size-5 shrink-0 rounded-full border-2 border-dashed border-[var(--border-strong)]'
        }
      >
        {done && <Check className="size-3" />}
      </span>
      <div className="min-w-0">
        <p className="text-subtle text-[11px] font-semibold tracking-[0.06em] uppercase">{label}</p>
        {done ? (
          <p className="text-sm font-medium">
            {who}
            {when && <span className="text-muted numeric font-normal"> · {when}</span>}
          </p>
        ) : (
          <p className="text-subtle text-sm">Not yet given</p>
        )}
      </div>
    </div>
  );
}
