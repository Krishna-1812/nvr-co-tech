import { Skeleton } from '@/components/ui/primitives';
import { HeaderSkeleton } from '@/components/ui/Skeletons';

/** The header, the summary strip and three rows, so the list does not jump. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <HeaderSkeleton />
      <div className="surface-lit a-ring rounded-3xl p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="mt-5 h-2.5 w-full rounded-full" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
