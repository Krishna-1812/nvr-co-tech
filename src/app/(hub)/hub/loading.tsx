import { Bar } from '@/components/ui/Skeletons';

/**
 * Shaped like the hub, because the hub is the first thing anybody sees after
 * signing in and a spinner there would be the platform's opening impression. The
 * geometry copies page.tsx: header and meter, one tall card, then a grid of six.
 */
export default function HubLoading() {
  return (
    <div className="space-y-8">
      <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-6 pb-6">
        <div className="min-w-0 space-y-3">
          <Bar className="h-2.5 w-56" />
          <Bar className="h-9 w-72" />
          <Bar className="h-4 w-full max-w-lg" />
          <Bar className="h-6 w-64 rounded-full" delayMs={80} />
        </div>

        {/* The roster meter: six cells over a label and a legend. */}
        <div className="w-full space-y-2.5 sm:w-72">
          <Bar className="h-2.5 w-20" />
          <div className="flex gap-1.5">
            {Array.from({ length: 6 }, (_, i) => (
              <Bar key={i} className="h-2 flex-1 rounded-full" delayMs={i * 60} />
            ))}
          </div>
          <Bar className="h-2.5 w-44" />
        </div>

        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,var(--border-strong),transparent_65%)]"
        />
      </div>

      {/* The live card. Two columns from lg, matching LiveSolutionCard. */}
      <div className="surface-lit grid gap-7 rounded-3xl p-5 sm:p-7 lg:grid-cols-[1fr_20rem] lg:gap-9 lg:p-8">
        <div className="space-y-4">
          <div className="flex items-start gap-3.5">
            <Bar className="size-11 shrink-0 rounded-xl" />
            <div className="space-y-2.5 pt-1">
              <Bar className="h-6 w-48" />
              <Bar className="h-2.5 w-32" />
            </div>
          </div>
          <Bar className="h-4 w-full max-w-xl" />
          <Bar className="h-4 w-4/5 max-w-lg" />
          <div className="flex gap-2.5 pt-3">
            <Bar className="h-10 w-44" />
            <Bar className="h-10 w-32" />
          </div>
        </div>

        <div className="surface-sunken space-y-4 rounded-2xl border p-4">
          <Bar className="h-2.5 w-28" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Bar className="h-3 w-24" delayMs={i * 90} />
              <Bar className="h-6 w-12" delayMs={i * 90} />
            </div>
          ))}
          <Bar className="h-9 w-full rounded-xl" />
        </div>
      </div>

      <div className="space-y-5">
        <Bar className="h-6 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="surface-lit space-y-3 rounded-2xl p-5" >
              <div className="flex items-start justify-between gap-3">
                <Bar className="size-10 rounded-xl" delayMs={i * 60} />
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
