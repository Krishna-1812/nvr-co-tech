import { Card } from '@/components/ui/primitives';
import { Bar, HeroSkeleton } from '@/components/ui/Skeletons';

/**
 * Activity while it is being fetched: the spend hero over the history and the
 * list, two-up from `xl` as ActivityBoard lays them out.
 */
export default function ContactActivityLoading() {
  return (
    <div className="space-y-6">
      <HeroSkeleton />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {[0, 1].map((panel) => (
          <Card key={panel}>
            <div className="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
              <Bar className="size-9 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Bar className="h-3.5 w-28" />
                <Bar className="h-3 w-72 max-w-full" />
              </div>
            </div>
            <div className="space-y-3 p-5 sm:p-6">
              {[0, 1, 2, 3].map((i) => (
                <Bar key={i} className="block h-16 w-full rounded-2xl" delayMs={i * 70} />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
