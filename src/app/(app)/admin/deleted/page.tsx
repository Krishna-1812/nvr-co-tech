import { Trash2 } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { type VoucherStatus } from '@/lib/domain/workflow';
import { Card, EmptyState } from '@/components/ui/primitives';
import { DeletedRow } from './DeletedRow';

export const metadata = { title: 'Deleted vouchers · NVR Voucher' };

export type DeletedVoucher = {
  id: string;
  voucher_no: string | null;
  status: VoucherStatus;
  date: string | null;
  paid_to: string | null;
  grand_total: string | number;
  deleted_at: string;
  chapter: { name: string } | null;
  creator: { full_name: string | null; email: string } | null;
};

/**
 * The recycle bin. Nothing is lost until it is purged here, and anything that
 * was ever approved cannot be purged at all — `purge_voucher` refuses, because
 * deleting the voucher would cascade away the record of its approval.
 */
export default async function AdminDeletedPage() {
  await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from('vouchers')
    .select(
      `id, voucher_no, status, date, paid_to, grand_total, deleted_at,
       chapter:chapters!vouchers_chapter_id_fkey(name),
       creator:profiles!vouchers_created_by_fkey(full_name, email)`,
    )
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  const rows = (data ?? []) as unknown as DeletedVoucher[];

  return (
    <Card className="overflow-hidden">
      {rows.length === 0 ? (
        <EmptyState
          icon={<Trash2 className="size-8" />}
          title="Nothing has been deleted"
          description="Deleted vouchers land here, and can be restored until they are permanently removed."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="surface-sunken text-subtle text-xs">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Voucher</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Payee</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Raised by</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Deleted</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Was</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((v) => (
                  <DeletedRow key={v.id} voucher={v} />
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-subtle border-t px-5 py-3 text-xs">
            A voucher that was ever approved cannot be permanently deleted — removing it would erase
            the record of who approved it. Those stay here indefinitely.
          </p>
        </>
      )}
    </Card>
  );
}
