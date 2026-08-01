import { CardListSkeleton, HeaderSkeleton } from '@/components/ui/Skeletons';

export default function ApprovalsLoading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton withAction={false} />
      <CardListSkeleton count={3} />
    </div>
  );
}
