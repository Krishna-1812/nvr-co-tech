import { HeaderSkeleton, TableSkeleton } from '@/components/ui/Skeletons';

/**
 * The visitor list resolves every distinct address it finds, so a cold cache
 * genuinely takes a moment. The table shape is held so the page does not
 * reflow the instant it becomes readable.
 */
export default function VisitorsLoading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <TableSkeleton rows={10} columns={8} />
    </div>
  );
}
