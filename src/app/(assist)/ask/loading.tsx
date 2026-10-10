import { Skeleton } from '@/components/ui/primitives';
import { HeroSkeleton } from '@/components/ui/Skeletons';

/**
 * The shape of the screen, not a spinner.
 *
 * There is nothing to fetch here, so this is only ever on screen for the moment
 * the bundle lands. What it has to avoid is the composer arriving somewhere
 * other than where the skeleton put it, which is why the box at the bottom is
 * the right height rather than another grey bar, and why the opening is the
 * same hero, at the same width, that Conversation draws when it is empty.
 */
export default function Loading() {
  return (
    <div className="flex h-[calc(100dvh-12.5rem)] min-h-[26rem] flex-col lg:h-[calc(100dvh-9.5rem)]">
      <div className="min-h-0 flex-1 overflow-hidden px-1 py-6">
        <div className="mx-auto max-w-5xl">
          <HeroSkeleton buttons={false} working={false} />
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-1 py-4">
        <Skeleton className="h-13 rounded-[1.25rem]" />
      </div>
    </div>
  );
}
