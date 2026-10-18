import { Card } from '@/components/ui/primitives';
import { Bar, HeroSkeleton, StatsSkeleton } from '@/components/ui/Skeletons';

/**
 * The Admin screen reads a period of page views and visitors before it can
 * draw anything, which is a real wait on a long period; an empty frame for
 * that long reads as a page that failed rather than a page that is working.
 */
export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <HeroSkeleton />
      <StatsSkeleton />

      <Card className="overflow-hidden">
        <div className="border-b px-5 py-3.5">
          <Bar className="h-4 w-32" />
        </div>
        <div className="px-5 py-4">
          <Bar className="h-[168px] w-full" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((card) => (
          <Card key={card} className="overflow-hidden">
            <div className="border-b px-5 py-3.5">
              <Bar className="h-4 w-40" delayMs={card * 60} />
            </div>
            <div className="space-y-2 px-4 py-3">
              {[0, 1, 2, 3, 4].map((row) => (
                <Bar
                  key={row}
                  className="h-6"
                  delayMs={card * 60 + row * 40}
                  style={{ width: `${92 - row * 13}%` }}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
