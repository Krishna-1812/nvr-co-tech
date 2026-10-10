import { Card } from '@/components/ui/primitives';
import { Bar, HeroSkeleton } from '@/components/ui/Skeletons';

/**
 * The search screen while it is being fetched: the hero, then the filter rail
 * beside the conversation, as Workspace lays them out before any search.
 *
 * `buttons={false}` because the hero's one action is a small link in its chip
 * row rather than a pair of buttons, and a skeleton promising two would jump.
 */
export default function ContactsLoading() {
  return (
    <div className="space-y-6">
      <HeroSkeleton buttons={false} />
      <div className="grid gap-5 2xl:grid-cols-[3fr_2fr]">
        <Card className="space-y-4 p-4">
          <div className="flex items-center gap-3 border-b pb-3.5">
            <Bar className="size-9 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Bar className="h-3.5 w-44" />
              <Bar className="h-3 w-64 max-w-full" />
            </div>
          </div>
          <Bar className="h-[4.25rem] w-full rounded-2xl" />
          <Bar className="h-10 w-full rounded-full" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Bar className="h-2.5 w-24" delayMs={i * 80} />
                <Bar className="h-10 w-full rounded-xl" delayMs={i * 80} />
                <Bar className="h-10 w-full rounded-xl" delayMs={i * 80} />
              </div>
            ))}
          </div>
        </Card>
        <Card className="hidden space-y-4 p-4 2xl:block">
          <div className="flex items-center gap-3 border-b pb-3.5">
            <Bar className="size-9 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Bar className="h-3.5 w-52" />
              <Bar className="h-3 w-72 max-w-full" />
            </div>
          </div>
          <Bar className="h-48 w-full rounded-3xl" />
        </Card>
      </div>
    </div>
  );
}
