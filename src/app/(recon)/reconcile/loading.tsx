import { Skeleton } from '@/components/ui/primitives';
import { HeroSkeleton } from '@/components/ui/Skeletons';

/** The shape of the upload step — the hero, then the two ledgers side by side —
 *  so the page does not jump when it arrives. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <HeroSkeleton working={false} />
      <div className="surface-lit a-ring rounded-3xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Skeleton className="size-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5">
          <Skeleton className="h-60 rounded-3xl" />
          <Skeleton className="h-60 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
