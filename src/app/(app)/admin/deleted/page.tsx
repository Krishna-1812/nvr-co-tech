import { Trash2 } from 'lucide-react';
import { requireUser, createClient } from '@/lib/supabase/server';
import { personCols, tolerateMissingColumns } from '@/lib/supabase/columns';
import { isOwner, type VoucherStatus } from '@/lib/domain/workflow';
import { Card, CardTitle, DataTable, EmptyState, Th, Thead } from '@/components/ui/primitives';
import { DeletedRow } from './DeletedRow';

export const metadata = { title: 'Deleted vouchers' };

export type DeletedVoucher = {
  id: string;
  voucher_no: string | null;
  status: VoucherStatus;
  date: string | null;
  paid_to: string | null;
  grand_total: string | number;
  deleted_at: string;
  chapter: { name: string } | null;
  creator: { full_name: string | null; email: string; avatar_url?: string | null } | null;
};

/**
 * The recycle bin. Nothing is lost until it is purged here, and anything that
 * was ever approved cannot be purged at all — `purge_voucher` refuses, because
 * deleting the voucher would cascade away the record of its approval.
 */
export default async function AdminDeletedPage() {
  const me = await requireUser();
  const supabase = await createClient();

  const { data } = await tolerateMissingColumns(() =>
    supabase
      .from('vouchers')
      .select(
        `id, voucher_no, status, date, paid_to, grand_total, deleted_at,
         chapter:chapters!vouchers_chapter_id_fkey(name),
         creator:profiles!vouchers_created_by_fkey(${personCols()})`,
      )
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
  );

  const rows = (data ?? []) as unknown as DeletedVoucher[];

  return (
    <Card className="overflow-hidden">
      <CardTitle
        icon={<Trash2 className="size-4" />}
        title="Recycle bin"
        description={
          rows.length === 0
            ? 'Nothing is waiting to be restored.'
            : `${rows.length} deleted voucher${rows.length === 1 ? '' : 's'}`
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<Trash2 className="size-6" />}
          title="Nothing has been deleted"
          description="Deleted vouchers land here, and can be restored until they are permanently removed."
        />
      ) : (
        <>
          <DataTable>
            <Thead>
              <tr>
                <Th>Voucher</Th>
                <Th className="hidden md:table-cell">Payee</Th>
                <Th className="hidden lg:table-cell">Raised by</Th>
                <Th className="hidden sm:table-cell">Deleted</Th>
                <Th className="hidden sm:table-cell">Was</Th>
                <Th align="right">Amount</Th>
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </Thead>
            <tbody className="divide-y">
              {rows.map((v) => (
                <DeletedRow key={v.id} voucher={v} viewerIsOwner={isOwner(me.role)} />
              ))}
            </tbody>
          </DataTable>

          <p className="text-subtle border-t px-5 py-3 text-xs text-pretty">
            A voucher that was ever approved cannot be permanently deleted — removing it would erase
            the record of who approved it. Those stay here indefinitely.
          </p>
        </>
      )}
    </Card>
  );
}
