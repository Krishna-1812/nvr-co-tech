import {
  HeaderSkeleton,
  PipelineSkeleton,
  StatsSkeleton,
  TableSkeleton,
} from '@/components/ui/Skeletons';

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <HeaderSkeleton />
      <StatsSkeleton />
      <PipelineSkeleton />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
