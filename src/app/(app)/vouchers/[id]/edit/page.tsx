import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { canEdit } from '@/lib/domain/workflow';
import type { Chapter } from '@/lib/domain/voucher';
import { VoucherForm, type EventOption } from '@/components/voucher/VoucherForm';
import { StatusBadge } from '@/components/StatusBadge';

export const metadata = { title: 'Edit voucher · NVR Voucher' };

export default async function EditVoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: voucher }, { data: chapters }, { data: events }] = await Promise.all([
    supabase.from('vouchers').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
    supabase.from('chapters').select('*').eq('is_active', true).is('deleted_at', null).order('name'),
    supabase
      .from('events')
      .select('id, name, date_of_event, chapter_id')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  if (!voucher) notFound();

  // A submitted or approved voucher is not editable — send the user to the
  // read-only view rather than showing a form that cannot save.
  if (!canEdit(voucher, { id: user.id, role: user.role })) {
    redirect(`/vouchers/${id}`);
  }

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

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {voucher.voucher_no ?? 'New payment voucher'}
          </h1>
          <StatusBadge status={voucher.status} />
        </div>

        {voucher.status === 'rejected' && voucher.rejection_reason && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">
              Sent back for correction
            </p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              {voucher.rejection_reason}
            </p>
          </div>
        )}
      </div>

      <VoucherForm
        voucher={voucher}
        chapters={(chapters ?? []) as Chapter[]}
        events={(events ?? []) as EventOption[]}
      />
    </div>
  );
}
