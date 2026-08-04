import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Calculator,
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
import { StatusBadge, STATUS_TONE } from '@/components/StatusBadge';
import { buttonClass, Card, CardTitle } from '@/components/ui/primitives';
import { AuditTimeline } from '@/components/voucher/AuditTimeline';
import { Attachments } from '@/components/voucher/Attachments';
import { ApprovalChain } from '@/components/voucher/ApprovalChain';
import { AmountLadder, type Line } from '@/components/voucher/AmountLadder';
import type { AttachmentRow } from '@/app/actions/attachments';
import { voucherDetailSelect } from '@/lib/domain/rows';
import { personCols, tolerateMissingColumns } from '@/lib/supabase/columns';
import type { VoucherDetailRow, AuditRow, PersonRef } from '@/lib/domain/rows';
import { VoucherActions } from '@/components/voucher/VoucherActions';

export const metadata = { title: 'Voucher' };

/** A labelled value; hides itself when there is nothing to show. */
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="min-w-0">
      <dt className="a-label">{label}</dt>
      <dd className="mt-1.5 text-sm font-medium break-words">{value}</dd>
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

  /*
   * All three at once.
   *
   * They ran one after another, and since each is a round-trip to Supabase this
   * page waited out three of them in a row before it could render. Nothing here
   * needed that: the attachments and the history are keyed by the id in the URL,
   * not by anything in the voucher row, so none of them was waiting on an answer
   * from the one before.
   *
   * The cost of doing it this way is two wasted queries when the voucher does not
   * exist or RLS will not show it to you. Both are scoped by the same policies, so
   * they come back empty, and a 404 is not the case worth optimising for.
   */
  const [{ data: voucher }, { data: attachments }, { data: audit }] = await Promise.all([
    tolerateMissingColumns(() =>
      supabase
        .from('vouchers')
        .select(voucherDetailSelect())
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle(),
    ),
    supabase
      .from('voucher_attachments')
      .select('id, voucher_id, storage_path, file_name, mime_type, size_bytes, created_at')
      .eq('voucher_id', id)
      .order('created_at', { ascending: true }),
    tolerateMissingColumns(() =>
      supabase
        .from('voucher_audit')
        .select(`id, action, note, created_at, actor:profiles!voucher_audit_actor_id_fkey(${personCols()})`)
        .eq('voucher_id', id)
        .order('created_at', { ascending: true }),
    ),
  ]);

  if (!voucher) notFound();

  // Hand-written Database types carry no Relationships, so embedded joins need an
  // assertion. Regenerating types from the live schema removes this.
  const v = voucher as unknown as VoucherDetailRow;
  const person = (p: PersonRef) => p?.full_name ?? p?.email ?? null;
  const tone = STATUS_TONE[v.status];

  // Only the components that are actually present. A ladder rung of zero is not a
  // fact about this voucher, it is a field nobody filled in.
  const additions: Line[] = [
    { label: 'Basic value', value: Number(v.basic_value) },
    ...(Number(v.cgst) > 0 ? [{ label: 'CGST', value: Number(v.cgst), sign: '+' as const }] : []),
    ...(Number(v.sgst) > 0 ? [{ label: 'SGST', value: Number(v.sgst), sign: '+' as const }] : []),
    ...(Number(v.igst) > 0 ? [{ label: 'IGST', value: Number(v.igst), sign: '+' as const }] : []),
    ...(Number(v.vat) > 0 ? [{ label: 'VAT / other', value: Number(v.vat), sign: '+' as const }] : []),
  ];

  const deductions: Line[] = [
    ...(Number(v.tds) > 0 ? [{ label: 'TDS', value: Number(v.tds), sign: '−' as const }] : []),
    ...(Number(v.advance) > 0
      ? [{ label: 'Advance already paid', value: Number(v.advance), sign: '−' as const }]
      : []),
    ...(Number(v.tips) > 0 ? [{ label: 'Tips', value: Number(v.tips), sign: '+' as const }] : []),
    ...(Number(v.discount) > 0
      ? [{ label: 'Discount', value: Number(v.discount), sign: '−' as const }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/vouchers"
        className="text-muted group -ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 text-sm font-medium transition hover:text-[var(--text-c)]"
      >
        <ArrowLeft
          className="size-4 transition-transform group-hover:-translate-x-0.5"
          aria-hidden
        />
        Back to vouchers
      </Link>

      {/*
        Identity, the sum being authorised, and the chain of custody are one object,
        so they share one panel. Nobody should have to look in two places to know
        which number they are about to approve or who has already signed for it.
      */}
      <section className="surface-lit a-ring animate-[rise_0.55s_cubic-bezier(0.22,1,0.36,1)_backwards] relative overflow-hidden rounded-3xl">
        {/* The status colour, as the light behind the whole header. */}
        <span
          aria-hidden
          className="a-orb -top-40 -right-24 size-96 opacity-60"
          style={{
            background: `radial-gradient(circle, color-mix(in oklab, ${tone} 30%, transparent), transparent 70%)`,
            animation: 'aurora 38s ease-in-out infinite',
          }}
        />
        <span
          aria-hidden
          className="a-grid pointer-events-none absolute inset-0 opacity-35 [mask-image:radial-gradient(60%_70%_at_15%_0%,#000,transparent)]"
        />

        <div className="relative flex flex-wrap items-start justify-between gap-x-8 gap-y-5 p-6 sm:p-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="numeric text-lg font-semibold tracking-tight sm:text-xl">
                {v.voucher_no ?? 'Draft voucher'}
              </h1>
              <StatusBadge status={v.status} />
            </div>
            <p className="text-muted mt-2 max-w-md text-sm text-pretty">
              {STATUS_META[v.status].description}
            </p>
            {v.paid_to && (
              <p className="mt-4">
                <span className="a-label">Payable to</span>
                <span className="m-display mt-1.5 block text-[clamp(1.35rem,3vw,1.9rem)]">
                  {v.paid_to}
                </span>
              </p>
            )}
          </div>

          <div className="sm:text-right">
            <p className="a-label">Grand total</p>
            <p className="a-figure mt-2 text-[clamp(2rem,6vw,2.9rem)]">
              {fmtRupees(v.grand_total)}
            </p>
            {v.date && (
              <p className="text-subtle numeric mt-2 text-xs">Voucher dated {fmtDate(v.date)}</p>
            )}
          </div>
        </div>

        <div className="relative border-t px-6 py-6 sm:px-8">
          <p className="a-label mb-5 flex items-center gap-2">
            <ShieldCheck className="size-3.5" aria-hidden />
            Chain of custody
          </p>
          {/* People, not names: the chain draws each completed rung as the face of
              whoever signed for it. */}
          <ApprovalChain
            status={v.status}
            raisedBy={v.initiator}
            raisedAt={v.submitted_at ?? v.created_at}
            firstApprover={v.first_approver}
            firstAt={v.approved_1_at}
            secondApprover={v.second_approver}
            secondAt={v.approved_2_at}
            paidBy={v.payer}
            paidAt={v.payment_date ?? null}
            utr={v.utr_ref}
            rejectedBy={v.rejecter}
          />
        </div>

        <div className="relative flex flex-wrap items-start justify-between gap-3 border-t bg-[var(--surface-sunken)] p-4 sm:px-6">
          <VoucherActions
            voucher={voucher as unknown as VoucherLike & { id: string; voucher_no: string | null }}
            me={{ id: user.id, role: user.role }}
          />

          <div className="flex gap-2">
            <a href={`/vouchers/${id}/pdf`} target="_blank" rel="noopener" className={buttonClass()}>
              <Eye className="size-4" aria-hidden />
              View PDF
            </a>
            <a href={`/vouchers/${id}/pdf`} download className={buttonClass()}>
              <Download className="size-4" aria-hidden />
              <span className="hidden sm:inline">Download</span>
            </a>
          </div>
        </div>
      </section>

      {v.status === 'rejected' && v.rejection_reason && (
        <div
          role="alert"
          style={{ '--tone': 'var(--status-rejected)' } as React.CSSProperties}
          className="tinted flex gap-3 rounded-2xl border p-4"
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

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem] xl:items-start">
        <div className="space-y-6">
          <Card className="overflow-hidden">
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

          <Card className="overflow-hidden">
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

          <Card className="overflow-hidden">
            <CardTitle icon={<History className="size-4" />} title="History" />
            <AuditTimeline entries={(audit ?? []) as unknown as AuditRow[]} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardTitle
              icon={<Calculator className="size-4" />}
              title="Amounts"
              description="Bars are relative to the largest component."
            />
            <AmountLadder
              additions={additions}
              deductions={deductions}
              netTotal={Number(v.net_total)}
              grandTotal={Number(v.grand_total)}
            />
          </Card>

          <Card className="overflow-hidden">
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
