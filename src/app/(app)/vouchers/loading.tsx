import { Card } from '@/components/ui/primitives';
import { Bar, FilterBarSkeleton, HeaderSkeleton, TableSkeleton } from '@/components/ui/Skeletons';

export default function VouchersLoading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      {/* The status strip: its label, the split bar, five tiles. */}
      <Card className="p-5 sm:p-6" aria-busy="true" aria-label="Loading">
        <Bar className="h-2.5 w-36" />
        <Bar className="mt-4 h-3 w-full rounded-full" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Bar key={i} className="h-[4.25rem] rounded-2xl" delayMs={i * 60} />
          ))}
        </div>
      </Card>
      <FilterBarSkeleton />
      <TableSkeleton rows={10} columns={6} />
    </div>
  );
}
