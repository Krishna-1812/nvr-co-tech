import { Card } from '@/components/ui/primitives';
import { Bar, HeaderSkeleton } from '@/components/ui/Skeletons';

/**
 * Shaped rather than three grey blocks: the profile card opens with a brand band
 * and an avatar, and the two below it are a heading over a list of rows.
 */
export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton withAction={false} />

      <Card className="overflow-hidden rounded-2xl">
        <div aria-hidden className="gradient-brand h-24 w-full opacity-40" />
        <div className="flex items-end gap-4 px-5 pb-4">
          <span className="-mt-9 size-18 shrink-0 rounded-2xl border-4 border-[var(--surface-raised)] bg-[var(--surface-sunken)]" />
          <div className="w-full max-w-xs space-y-2.5 pb-0.5">
            <Bar className="h-5 w-40" />
            <Bar className="h-3.5 w-52" />
          </div>
        </div>
        {/* The facts strip. Three cells, because the middle one only exists for an
            approver and guessing wrong is a visible jump either way. */}
        <div className="grid grid-cols-3 divide-x border-t bg-[var(--surface-sunken)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 px-5 py-3.5">
              <Bar className="h-2.5 w-16" delayMs={i * 80} />
              <Bar className="h-6 w-12" delayMs={i * 80} />
            </div>
          ))}
        </div>
        <div className="border-t px-5 py-4">
          <Bar className="h-10 w-full rounded-lg" />
        </div>
      </Card>

      {[0, 1].map((i) => (
        <Card key={i}>
          <div className="border-b px-5 py-3.5">
            <Bar className="h-4 w-32" delayMs={i * 70} />
          </div>
          <div className="space-y-2 px-5 py-4">
            {[0, 1, 2].map((r) => (
              <Bar key={r} className="h-11 w-full rounded-lg" delayMs={r * 70} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
