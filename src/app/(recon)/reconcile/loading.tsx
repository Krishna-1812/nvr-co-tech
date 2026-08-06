import { Skeleton } from '@/components/ui/primitives';

/** The shape of the upload step, so the page does not jump when it arrives. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-3 pb-5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-6 w-72 max-w-full" />
      <div className="surface-lit rounded-2xl p-5">
        <Skeleton className="h-5 w-48" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    </div>
  );
}
