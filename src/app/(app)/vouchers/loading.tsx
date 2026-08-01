import { HeaderSkeleton, TableSkeleton } from '@/components/ui/Skeletons';

export default function VouchersLoading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <TableSkeleton rows={10} columns={6} />
    </div>
  );
}
