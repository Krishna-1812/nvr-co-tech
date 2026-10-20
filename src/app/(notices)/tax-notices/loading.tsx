import { HeaderSkeleton } from '@/components/ui/Skeletons';
import { Card } from '@/components/ui/primitives';

export default function TaxNoticesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Card className="h-24" />
        <Card className="h-24" />
        <Card className="h-24" />
        <Card className="h-24" />
      </div>
      <Card className="h-72" />
    </div>
  );
}
