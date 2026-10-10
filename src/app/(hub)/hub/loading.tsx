import { Bar, HeroSkeleton } from '@/components/ui/Skeletons';

/**
 * Shaped like the hub, because the hub is the first thing anybody sees after
 * signing in and a spinner there would be the platform's opening impression. The
 * geometry copies page.tsx: the hero with its arch, the live cards, then the roadmap.
 */
export default function HubLoading() {
  return (
    <div className="space-y-8">
      <HeroSkeleton />

      {/* The live cards, three abreast from xl, matching LiveSolutionCard. */}
      <div className="space-y-5">
        <Bar className="h-9 w-56 rounded-xl" />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="surface-lit space-y-4 rounded-3xl p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <Bar className="size-11 shrink-0 rounded-2xl" delayMs={i * 60} />
                <div className="min-w-0 flex-1 space-y-2.5 pt-1">
                  <Bar className="h-5 w-40" delayMs={i * 60} />
                  <Bar className="h-2.5 w-28" delayMs={i * 60} />
                </div>
              </div>
              <Bar className="h-3.5 w-full" delayMs={i * 60} />
              <Bar className="h-3.5 w-4/5" delayMs={i * 60} />
              <div className="surface-sunken space-y-3 rounded-2xl border p-4">
                <Bar className="h-2.5 w-28" />
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((j) => (
                    <Bar key={j} className="h-7 w-10" delayMs={j * 90} />
                  ))}
                </div>
                <Bar className="h-14 w-full rounded-xl" />
              </div>
              <div className="flex gap-2">
                <Bar className="h-10 w-24 rounded-full" />
                <Bar className="h-10 w-32 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <Bar className="h-9 w-48 rounded-xl" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="surface-lit space-y-3 rounded-3xl p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <Bar className="size-11 rounded-2xl" delayMs={i * 60} />
                <Bar className="h-5 w-20 rounded-full" delayMs={i * 60} />
              </div>
              <Bar className="h-5 w-40" delayMs={i * 60} />
              <Bar className="h-2.5 w-28" delayMs={i * 60} />
              <Bar className="h-3.5 w-full" delayMs={i * 60} />
              <Bar className="h-3.5 w-3/4" delayMs={i * 60} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
