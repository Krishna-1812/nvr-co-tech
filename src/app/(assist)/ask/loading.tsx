import { Skeleton } from '@/components/ui/primitives';

/**
 * The shape of the screen, not a spinner.
 *
 * There is nothing to fetch here, so this is only ever on screen for the moment
 * the bundle lands. What it has to avoid is the composer arriving somewhere
 * other than where the skeleton put it, which is why the box at the bottom is
 * the right height rather than another grey bar.
 */
export default function Loading() {
  return (
    <div className="flex h-[calc(100dvh-12.5rem)] min-h-[26rem] flex-col lg:h-[calc(100dvh-9.5rem)]">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Skeleton className="size-11 rounded-2xl" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-72" />
        <div className="mt-4 grid w-full max-w-3xl gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-13 shrink-0 rounded-2xl" />
    </div>
  );
}
