import { Card } from '@/components/ui/primitives';
import { Bar, HeroSkeleton } from '@/components/ui/Skeletons';

/**
 * The detail page runs three queries before it can render anything, so opening
 * a voucher from the list was the one navigation in the app that visibly hung.
 *
 * Shaped like the page it stands in for: the hero (no arch, as on the page), then
 * the two columns of panels — details, payment and history on the left, the
 * amounts and the files on the right.
 */
export default function VoucherDetailLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Bar className="h-4 w-32" />
      <HeroSkeleton scene={false} buttons={false} />

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem] xl:items-start">
        <div className="space-y-6">
          {[6, 4].map((cells, i) => (
            <Card key={i}>
              <div className="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
                <Bar className="size-9 rounded-xl" />
                <Bar className="h-4 w-36" delayMs={i * 70} />
              </div>
              <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
                {Array.from({ length: cells }, (_, c) => (
                  <div key={c} className="space-y-2">
                    <Bar className="h-2.5 w-16" delayMs={c * 40} />
                    <Bar className="h-4 w-32" delayMs={c * 40} />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
        <Card>
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <Bar className="size-9 rounded-xl" />
            <Bar className="h-4 w-24" />
          </div>
          <div className="space-y-4 p-5">
            {[0, 1, 2, 3].map((r) => (
              <Bar key={r} className="h-5 w-full" delayMs={r * 60} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
