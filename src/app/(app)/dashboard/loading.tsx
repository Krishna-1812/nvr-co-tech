import {
  ActivitySkeleton,
  BriefingSkeleton,
  PipelineSkeleton,
  StatsSkeleton,
  TableSkeleton,
} from '@/components/ui/Skeletons';

/**
 * Matches the dashboard block for block, including the two-up row the pipeline and
 * the activity strip share from `xl` up. A skeleton that lays out differently from
 * the page behind it makes the whole screen jump at the one moment the reader has
 * just started looking at it.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <BriefingSkeleton />
      <StatsSkeleton />
      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr] xl:items-start">
        <PipelineSkeleton />
        <ActivitySkeleton />
      </div>
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
