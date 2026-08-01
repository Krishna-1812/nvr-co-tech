import { Card } from '@/components/ui/primitives';
import { HeaderSkeleton } from '@/components/ui/Skeletons';

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <HeaderSkeleton withAction={false} />
      {[0, 1, 2].map((i) => (
        <Card key={i} className="h-40 animate-[shimmer_1.8s_ease-in-out_infinite]" />
      ))}
    </div>
  );
}
