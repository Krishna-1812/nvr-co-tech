import { Card } from './primitives';
import { cn } from '@/lib/utils';

/**
 * Placeholders shaped like the thing that is coming, so navigation does not
 * flash an empty frame and then reflow once data lands.
 */

/** The one shimmering block every skeleton is built from. */
export function Bar({ className, delayMs = 0 }: { className?: string; delayMs?: number }) {
  return (
    <span
      aria-hidden
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
      className={cn(
        'block animate-[shimmer_1.8s_ease-in-out_infinite] rounded-md bg-[var(--surface-sunken)]',
        className,
      )}
    />
  );
}

export function HeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="w-full max-w-sm space-y-2.5">
        <Bar className="h-3 w-24" />
        <Bar className="h-7 w-56" />
        <Bar className="h-4 w-72" />
      </div>
      {withAction && <Bar className="h-10 w-32 shrink-0" />}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        'grid gap-3',
        // Three tiles go straight to three across; four go two-then-four, the
        // way the dashboard's own stat grid does.
        count === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4',
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start justify-between">
            <Bar className="h-3 w-24" delayMs={i * 70} />
            <Bar className="size-7 rounded-lg" delayMs={i * 70} />
          </div>
          <Bar className="mt-3 h-8 w-20" delayMs={i * 70} />
          <Bar className="mt-2 h-3 w-28" delayMs={i * 70} />
        </Card>
      ))}
    </div>
  );
}

/** The filter toolbar above the voucher list: a search field and two selects. */
export function FilterBarSkeleton() {
  return (
    <div className="surface-lit flex flex-wrap items-center gap-2.5 rounded-xl p-3">
      <Bar className="h-9 min-w-56 flex-1" />
      <Bar className="h-9 w-36" />
      <Bar className="h-9 w-36" />
    </div>
  );
}

/**
 * The pipeline bar and its stage tiles. Shaped rather than a plain block,
 * because this card is tall enough that a grey rectangle would be the largest
 * thing on the dashboard while it loads.
 */
export function PipelineSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading">
      <div className="border-b px-5 py-3.5">
        <Bar className="h-4 w-32" />
        <Bar className="mt-2 h-3 w-56" />
      </div>
      <div className="space-y-4 px-5 py-4">
        <Bar className="h-3 w-full rounded-full" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Bar key={i} className="h-14 rounded-lg" delayMs={i * 70} />
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * `columns` counts what a wide screen shows. The middle ones are dropped at the
 * same breakpoints the real tables drop them at, so the placeholder is never
 * wider than the table that replaces it.
 */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  const middle = Math.max(0, columns - 3);

  return (
    <Card className="overflow-hidden" aria-busy="true" aria-label="Loading">
      <div className="surface-sunken flex gap-4 border-b px-4 py-3">
        <Bar className="h-3 w-24" />
        {Array.from({ length: middle }, (_, i) => (
          <Bar key={i} className="hidden h-3 flex-1 md:block" />
        ))}
        <Bar className="h-3 w-20" />
        <Bar className="h-3 w-20" />
      </div>
      <div className="divide-y">
        {/*
          Each row starts its shimmer slightly later than the one above, so the
          effect reads as a sweep down the table rather than every row pulsing
          in lockstep.
        */}
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            <Bar delayMs={r * 70} className="h-4 w-28" />
            {Array.from({ length: middle }, (_, c) => (
              <Bar key={c} delayMs={r * 70} className="hidden h-4 flex-1 md:block" />
            ))}
            {/* The status pill and the amount, which every one of these tables ends with. */}
            <Bar delayMs={r * 70} className="ml-auto h-5 w-24 rounded-full" />
            <Bar delayMs={r * 70} className="h-4 w-20" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="overflow-hidden">
          <div className="flex items-start justify-between gap-4 p-4">
            <div className="w-full space-y-2.5">
              <Bar className="h-4 w-40" delayMs={i * 70} />
              <Bar className="h-5 w-56" delayMs={i * 70} />
              <Bar className="h-3 w-64" delayMs={i * 70} />
            </div>
            <Bar className="h-7 w-28 shrink-0" delayMs={i * 70} />
          </div>
          <div className="flex items-center justify-between gap-4 border-t bg-[var(--surface-sunken)] px-4 py-2.5">
            <Bar className="h-3 w-48" delayMs={i * 70} />
            <div className="flex gap-2">
              <Bar className="h-8 w-20" delayMs={i * 70} />
              <Bar className="h-8 w-24" delayMs={i * 70} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/** The voucher detail page: summary card, two columns of detail cards. */
export function VoucherDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Bar className="h-4 w-32" />
      <Card className="overflow-hidden">
        <div className="flex items-start justify-between gap-6 p-5">
          <div className="w-full max-w-sm space-y-2.5">
            <Bar className="h-7 w-52" />
            <Bar className="h-4 w-64" />
            <Bar className="h-4 w-40" />
          </div>
          <div className="w-40 shrink-0 space-y-2.5">
            <Bar className="h-3 w-24 sm:ml-auto" />
            <Bar className="h-9 w-40" />
          </div>
        </div>
        <div className="flex gap-2 border-t bg-[var(--surface-sunken)] p-4">
          <Bar className="h-10 w-28" />
          <Bar className="h-10 w-28" />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_23rem] lg:items-start">
        <div className="space-y-6">
          {[0, 1].map((i) => (
            <Card key={i}>
              <div className="border-b px-5 py-3.5">
                <Bar className="h-4 w-36" delayMs={i * 70} />
              </div>
              <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, f) => (
                  <div key={f} className="space-y-2">
                    <Bar className="h-2.5 w-20" delayMs={f * 40} />
                    <Bar className="h-4 w-28" delayMs={f * 40} />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
        <div className="space-y-6">
          {[0, 1].map((i) => (
            <Card key={i}>
              <div className="border-b px-5 py-3.5">
                <Bar className="h-4 w-28" delayMs={i * 70} />
              </div>
              <div className="space-y-3 p-5">
                {Array.from({ length: 4 }, (_, f) => (
                  <Bar key={f} className="h-4 w-full" delayMs={f * 40} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
