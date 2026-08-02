import { CardListSkeleton, HeaderSkeleton, StatsSkeleton } from '@/components/ui/Skeletons';

export default function ApprovalsLoading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton withAction={false} />
      {/* Three across, matching the queue's depth / value / age strip. */}
      <StatsSkeleton count={3} />
      <CardListSkeleton count={3} />
    </div>
  );
}
