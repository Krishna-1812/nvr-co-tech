import { Card } from '@/components/ui/primitives';
import { Bar, HeaderSkeleton, HeroSkeleton, TableSkeleton } from '@/components/ui/Skeletons';

/**
 * Comparables, before the registry has answered.
 *
 * Block for block with the page: header, the desk controls, the hero, the
 * method rows with their peer columns, then the tabbed table. Picking another
 * company navigates, so this is what shows between one subject and the next —
 * and a skeleton laid out differently from the page behind it makes the screen
 * jump at the moment the reader has just started looking at it.
 */
export default function CompsLoading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton withAction={false} />

      {/* DeskControls: the subject picker and the statistic switch. */}
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:gap-5 sm:p-5" aria-hidden>
        <div className="min-w-0 flex-1 space-y-2">
          <Bar className="h-2.5 w-28" />
          <Bar className="h-14 w-full rounded-2xl" />
        </div>
        <div className="space-y-2">
          <Bar className="h-2.5 w-24" />
          <Bar className="h-11 w-full rounded-full sm:w-64" />
        </div>
      </Card>

      <HeroSkeleton buttons={false} />

      {/* MethodBreakdown: one row per method, working on the left, columns on the right. */}
      <Card className="overflow-hidden" aria-hidden>
        <div className="flex items-start gap-3 border-b px-5 py-4 sm:px-6">
          <Bar className="size-9 rounded-xl" />
          <div className="flex-1 space-y-2 pt-1">
            <Bar className="h-3.5 w-44" />
            <Bar className="h-3 w-80" />
          </div>
        </div>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="grid gap-5 border-b px-5 py-5 last:border-0 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:gap-8"
          >
            <div className="space-y-3">
              <div className="flex justify-between gap-4">
                <Bar className="h-4 w-36" delayMs={i * 90} />
                <Bar className="h-5 w-24" delayMs={i * 90} />
              </div>
              <Bar className="h-3 w-56" delayMs={i * 90} />
              <Bar className="mt-4 h-2 w-full rounded-full" delayMs={i * 90} />
            </div>
            <div className="surface-sunken flex h-36 items-end gap-1.5 rounded-2xl border p-4">
              {[55, 80, 40, 95, 65].map((h, j) => (
                <Bar
                  key={j}
                  className="flex-1 rounded-t-md rounded-b-none bg-[var(--surface-raised)]"
                  style={{ height: `${h}%` }}
                  delayMs={i * 90 + j * 40}
                />
              ))}
            </div>
          </div>
        ))}
      </Card>

      <TableSkeleton rows={5} columns={8} />
    </div>
  );
}
