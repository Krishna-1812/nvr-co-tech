import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Paperclip } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { canEdit } from '@/lib/domain/workflow';
import type { Chapter } from '@/lib/domain/voucher';
import { VoucherForm, type EventOption } from '@/components/voucher/VoucherForm';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/PageHeader';
import { Attachments } from '@/components/voucher/Attachments';
import { Card, CardTitle } from '@/components/ui/primitives';
import type { AttachmentRow } from '@/app/actions/attachments';

export const metadata = { title: 'Edit voucher' };

export default async function EditVoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: voucher }, { data: chapters }, { data: events }, { data: attachments }] = await Promise.all([
    supabase.from('vouchers').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
    supabase.from('chapters').select('*').eq('is_active', true).is('deleted_at', null).order('name'),
    supabase
      .from('events')
      .select('id, name, date_of_event, chapter_id')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('voucher_attachments')
      .select('id, voucher_id, storage_path, file_name, mime_type, size_bytes, created_at')
      .eq('voucher_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (!voucher) notFound();

  // A submitted or approved voucher is not editable — send the user to the
  // read-only view rather than showing a form that cannot save.
  if (!canEdit(voucher, { id: user.id, role: user.role })) {
    redirect(`/vouchers/${id}`);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
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

        <PageHeader
          eyebrow={voucher.voucher_no ?? 'Not yet numbered'}
          title={
            <span className="flex flex-wrap items-center gap-3">
              {voucher.status === 'rejected' ? 'Correct and resubmit' : 'New payment voucher'}
              <StatusBadge status={voucher.status} />
            </span>
          }
          description="Everything here saves as you type. It stays a private draft until you submit it."
        />

        {voucher.status === 'rejected' && voucher.rejection_reason && (
          <div
            role="alert"
            style={{ '--tone': 'var(--status-rejected)' } as CSSProperties}
            className="tinted flex gap-3 rounded-2xl border p-4"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Sent back for correction</p>
              <p className="mt-1 text-sm text-pretty opacity-90">{voucher.rejection_reason}</p>
            </div>
          </div>
        )}
      </div>

      <VoucherForm
        voucher={voucher}
        chapters={(chapters ?? []) as Chapter[]}
        events={(events ?? []) as EventOption[]}
      />

      {/* Attaching the invoice is what lets an approver check the numbers. */}
      <Card className="overflow-hidden lg:max-w-[calc(100%-21.5rem)]">
        <CardTitle
          icon={<Paperclip className="size-4" />}
          title="Invoice & supporting files"
          description="Attach the invoice so approvers can check it against the amounts."
        />
        <Attachments voucherId={id} initial={(attachments ?? []) as AttachmentRow[]} canEdit />
      </Card>
    </div>
  );
}
