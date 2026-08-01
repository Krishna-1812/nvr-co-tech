import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { fmtDate, fmtRupees } from '@/lib/domain/voucher';
import { STATUS_META, type VoucherLike } from '@/lib/domain/workflow';
import { StatusBadge, ApprovalProgress } from '@/components/StatusBadge';
import { Card } from '@/components/ui/primitives';
import { AuditTimeline } from '@/components/voucher/AuditTimeline';
import type { VoucherDetailRow, AuditRow, PersonRef } from '@/lib/domain/rows';
import { VoucherActions } from '@/components/voucher/VoucherActions';

export const metadata = { title: 'Voucher · NVR Voucher' };

/** A labelled value; hides itself when there is nothing to show. */
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <dt className="text-subtle text-xs font-medium">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

function Money({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={strong ? 'text-sm font-semibold' : 'text-muted text-sm'}>{label}</span>
      <span className={`numeric ${strong ? 'text-base font-bold' : 'text-sm'}`}>
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
    .select(
      `*,
       chapter:chapters!vouchers_chapter_id_fkey(name, code),
       paid_by:chapters!vouchers_paid_by_chapter_id_fkey(name),
       initiator:profiles!vouchers_initiated_by_fkey(full_name, email),
       first_approver:profiles!vouchers_approver_1_fkey(full_name, email),
       second_approver:profiles!vouchers_approver_2_fkey(full_name, email),
       rejecter:profiles!vouchers_rejected_by_fkey(full_name, email)`,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!voucher) notFound();

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
      <div>
        <Link
          href="/vouchers"
          className="text-muted inline-flex items-center gap-1.5 text-sm font-medium transition hover:text-[var(--text-c)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to vouchers
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="numeric text-2xl font-bold tracking-tight">
              {v.voucher_no ?? 'Draft voucher'}
            </h1>
            <StatusBadge status={v.status} />
            {['pending_first', 'pending_second', 'approved', 'paid'].includes(v.status) && (
              <ApprovalProgress status={v.status} />
            )}
          </div>
          <p className="numeric text-2xl font-bold">{fmtRupees(v.grand_total)}</p>
        </div>

        <p className="text-muted mt-1 text-sm">{STATUS_META[v.status].description}</p>
      </div>

      {v.status === 'rejected' && v.rejection_reason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            Sent back by {person(v.rejecter) ?? 'an approver'}
          </p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{v.rejection_reason}</p>
        </div>
      )}

      <VoucherActions
        voucher={voucher as unknown as VoucherLike & { id: string; voucher_no: string | null }}
        me={{ id: user.id, role: user.role }}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-6">
          <Card>
            <div className="border-b px-5 py-3.5">
              <h2 className="font-semibold">Voucher details</h2>
            </div>
            <dl className="grid gap-5 p-5 sm:grid-cols-3">
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
            <div className="border-b px-5 py-3.5">
              <h2 className="font-semibold">Payment</h2>
            </div>
            <dl className="grid gap-5 p-5 sm:grid-cols-3">
              <Detail label="Paid to" value={v.paid_to} />
              <Detail label="Paid by chapter" value={v.paid_by?.name} />
              <Detail label="Payment date" value={fmtDate(v.payment_date)} />
              <Detail label="Beneficiary" value={v.beneficiary_name} />
              <Detail label="UTR / ref" value={<span className="numeric">{v.utr_ref}</span>} />
              <Detail label="PAN" value={<span className="numeric">{v.pan_number}</span>} />
              <Detail label="GSTIN" value={<span className="numeric">{v.gst_number}</span>} />
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="border-b px-5 py-3.5">
              <h2 className="font-semibold">Amounts</h2>
            </div>
            <div className="divide-y px-5 py-2">
              <div className="py-1">
                <Money label="Basic value" value={Number(v.basic_value)} />
                {Number(v.cgst) > 0 && <Money label="(+) CGST" value={Number(v.cgst)} />}
                {Number(v.sgst) > 0 && <Money label="(+) SGST" value={Number(v.sgst)} />}
                {Number(v.igst) > 0 && <Money label="(+) IGST" value={Number(v.igst)} />}
                {Number(v.vat) > 0 && <Money label="(+) VAT / other" value={Number(v.vat)} />}
              </div>
              <div className="py-1">
                <Money label="Net total" value={Number(v.net_total)} strong />
              </div>
              <div className="py-1">
                {Number(v.tds) > 0 && <Money label="(−) TDS" value={Number(v.tds)} />}
                {Number(v.advance) > 0 && <Money label="(−) Advance" value={Number(v.advance)} />}
                {Number(v.tips) > 0 && <Money label="(+) Tips" value={Number(v.tips)} />}
                {Number(v.discount) > 0 && <Money label="(−) Discount" value={Number(v.discount)} />}
              </div>
              <div className="py-1">
                <Money label="Grand total" value={Number(v.grand_total)} strong />
              </div>
            </div>
          </Card>

          <Card>
            <div className="border-b px-5 py-3.5">
              <h2 className="font-semibold">Approvals</h2>
            </div>
            <dl className="space-y-4 p-5">
              <Detail label="Raised by" value={person(v.initiator)} />
              <Detail
                label="First approval"
                value={
                  person(v.first_approver)
                    ? `${person(v.first_approver)} · ${fmtDate(v.approved_1_at)}`
                    : null
                }
              />
              <Detail
                label="Second approval"
                value={
                  person(v.second_approver)
                    ? `${person(v.second_approver)} · ${fmtDate(v.approved_2_at)}`
                    : null
                }
              />
              {!person(v.first_approver) && !person(v.second_approver) && (
                <p className="text-subtle text-sm">No approvals yet.</p>
              )}
            </dl>
          </Card>

          <Card>
            <div className="border-b px-5 py-3.5">
              <h2 className="font-semibold">History</h2>
            </div>
            <AuditTimeline entries={(audit ?? []) as unknown as AuditRow[]} />
          </Card>
        </div>
      </div>
    </div>
  );
}
