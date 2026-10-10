import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  Calculator,
  Download,
  Eye,
  FileWarning,
  FileText,
  History,
  Landmark,
  Paperclip,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { fmtDate, fmtRupees } from '@/lib/domain/voucher';
import { STATUS_META, canEdit, type VoucherLike } from '@/lib/domain/workflow';
import { STATUS_TONE } from '@/components/StatusBadge';
import { ToolHero, HeroStat, HeroChip } from '@/components/ui/ToolHero';
import { cn } from '@/lib/utils';
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
  const [{ data: voucher }, { data: attachments }, { data: audit }, { data: org }] = await Promise.all([
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
        .select(`id, action, note, created_at, to_status, actor:profiles!voucher_audit_actor_id_fkey(${personCols()})`)
        .eq('voucher_id', id)
        .order('created_at', { ascending: true }),
    ),
    supabase.from('organizations').select('requires_approval').single(),
  ]);

  const requiresApproval = org?.requires_approval ?? true;

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

  /*
   * The hero's working: the same sum as the ladder in the sidebar, collapsed to
   * the three moves a reader checks — what the work cost, what tax added, what
   * came off — so the arithmetic is readable before any row of it is. Each term
   * is a difference of two totals the database already stored, never
   * recomputed from the components, so the tiles cannot disagree with the
   * figure above them. A term that is zero is not shown.
   */
  const basic = Number(v.basic_value);
  const net = Number(v.net_total);
  const grand = Number(v.grand_total);
  const taxAdded = net - basic;
  const takenOff = net - grand;
  const fileCount = attachments?.length ?? 0;
  const working: {
    label: string;
    value: string;
    note?: string;
    tone?: string;
    strong?: boolean;
    /** The sign standing before this tile in the sum. */
    op?: string;
  }[] = [
    { label: 'Basic value', value: fmtRupees(basic), note: 'Before tax' },
    ...(taxAdded > 0
      ? [
          {
            label: 'Tax & charges',
            op: '+',
            value: fmtRupees(taxAdded),
            note: additions.slice(1).map((l) => l.label).join(' + '),
            tone: 'var(--color-brand-500)',
          },
        ]
      : []),
    ...(takenOff !== 0
      ? [
          {
            label: takenOff > 0 ? 'Taken off' : 'Added',
            op: takenOff > 0 ? '−' : '+',
            value: fmtRupees(Math.abs(takenOff)),
            note: deductions.map((l) => l.label).join(', '),
            tone: 'var(--status-warn)',
          },
        ]
      : []),
    {
      label: 'Grand total',
      op: '=',
      value: fmtRupees(grand),
      note: v.status === 'paid' ? 'Paid' : 'To be paid',
      strong: true,
    },
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

        The panel is the tool hero now, the way True Property Cost opens: the
        grand total is the largest thing on the screen because it is the figure
        being authorised, the status rides beside the label as the pill, and the
        working under it is the sum that produced it. No arch here — that is the
        dashboard's moment; a single voucher is a document, not a tool's front
        page, and the space the arch would take is better spent on the chain.
      */}
      <ToolHero
        id="voucher-total"
        label={v.voucher_no ?? 'Draft voucher'}
        pill={{
          text: STATUS_META[v.status].label,
          tone,
          live: v.status === 'pending_first' || v.status === 'pending_second',
        }}
        title={fmtRupees(v.grand_total)}
        variant="figure"
        glow={tone}
        sub={
          <>
            {v.paid_to ? (
              <>
                Payable to{' '}
                <span className="font-semibold text-[var(--text-c)]">{v.paid_to}</span>
              </>
            ) : (
              'No payee yet'
            )}
            {v.date && (
              <>
                {' · '}dated <span className="numeric">{fmtDate(v.date)}</span>
              </>
            )}
            <span className="text-subtle mt-1 block text-[13px]">
              {STATUS_META[v.status].description}
            </span>
          </>
        }
      >
        {/* The sum, written out: only the terms this voucher actually has. The
            operators stand between the tiles once they share a row; on a phone
            the tiles wrap two by two and the signs would point at nothing. */}
        {working.length > 1 && (
          <div
            className={cn(
              'mt-7 grid grid-cols-2 gap-2 sm:gap-3',
              working.length === 4
                ? 'lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]'
                : working.length === 3
                  ? 'sm:grid-cols-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]'
                  : 'max-w-xl lg:grid-cols-[1fr_auto_1fr]',
            )}
          >
            {working.map(({ op, ...t }, i) => (
              <Fragment key={t.label}>
                {i > 0 && (
                  <span
                    aria-hidden
                    className="text-subtle hidden place-items-center text-xl font-light lg:grid"
                  >
                    {op}
                  </span>
                )}
                <HeroStat
                  {...t}
                  // Three tiles on a two-column phone grid: the answer takes the
                  // whole second row rather than sitting beside a hole.
                  className={t.strong && working.length === 3 ? 'col-span-2 sm:col-span-1' : undefined}
                />
              </Fragment>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {v.chapter?.name && <HeroChip icon={Landmark}>{v.chapter.name}</HeroChip>}
          {v.event_name && (
            <HeroChip icon={CalendarDays}>
              {v.event_name}
              {v.event_date && <span className="text-subtle numeric">· {fmtDate(v.event_date)}</span>}
            </HeroChip>
          )}
          {v.invoice_no && (
            <HeroChip icon={Receipt}>
              Invoice <span className="numeric">{v.invoice_no}</span>
            </HeroChip>
          )}
          <HeroChip icon={fileCount > 0 ? Paperclip : FileWarning}>
            {fileCount > 0
              ? `${fileCount} supporting file${fileCount === 1 ? '' : 's'}`
              : 'No invoice attached'}
          </HeroChip>
        </div>

        {/* Who has signed for it, and whose act is next. */}
        <div className="surface-sunken a-inner mt-8 rounded-2xl border p-5 sm:p-6">
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

        <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
          <VoucherActions
            voucher={voucher as unknown as VoucherLike & { id: string; voucher_no: string | null }}
            me={{ id: user.id, role: user.role }}
            requiresApproval={requiresApproval}
          />

          <div className="flex gap-2">
            <a href={`/vouchers/${id}/pdf`} target="_blank" rel="noopener" className={buttonClass()}>
              <Eye className="size-4" aria-hidden />
              View PDF
            </a>
            <a
              href={`/vouchers/${id}/pdf`}
              download
              className={buttonClass()}
              aria-label="Download PDF"
            >
              <Download className="size-4" aria-hidden />
              <span className="hidden sm:inline">Download</span>
            </a>
          </div>
        </div>
      </ToolHero>

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
            <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
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
            <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
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
