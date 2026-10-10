import { HeaderSkeleton } from '@/components/ui/Skeletons';
import { Card } from '@/components/ui/primitives';

export default function LandedCostLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-64" />
        <Card className="h-64" />
      </div>
      <Card className="h-72" />
    </div>
  );
}
