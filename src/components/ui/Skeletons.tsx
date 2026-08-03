import { Card } from './primitives';
import { cn } from '@/lib/utils';

/**
 * Placeholders shaped like the thing that is coming, so navigation does not flash
 * an empty frame and then reflow once data lands.
 *
 * Every one of these is a deliberate copy of a real component's geometry. That is
 * the whole point and also the maintenance cost: change a card's padding and the
 * skeleton has to follow, or the page visibly jumps at the moment it becomes
 * useful. Where a shape is load-bearing, the comment says which component it is
 * imitating.
 */

/** The one shimmering block every skeleton is built from. */
export function Bar({
  className,
  delayMs = 0,
  style,
}: {
  className?: string;
  delayMs?: number;
  /** For a dimension Tailwind cannot see, such as a per-item bar height. */
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={{ ...style, ...(delayMs ? { animationDelay: `${delayMs}ms` } : null) }}
      className={cn(
        'block animate-[shimmer_1.8s_ease-in-out_infinite] rounded-md bg-[var(--surface-sunken)]',
        className,
      )}
    />
  );
}

/** PageHeader: eyebrow, display title, one line of description, and the rule. */
export function HeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="relative flex items-end justify-between gap-4 pb-5">
      <div className="w-full max-w-sm space-y-3">
        <Bar className="h-2.5 w-20" />
        <Bar className="h-8 w-56" />
        <Bar className="h-3.5 w-72" />
      </div>
      {withAction && <Bar className="h-10 w-32 shrink-0" />}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,var(--border-strong),transparent_65%)]"
      />
    </div>
  );
}

/**
 * Briefing: the dashboard's opening panel. Tall, so a plain block here would be
 * the largest grey rectangle in the app while it loads.
 */
export function BriefingSkeleton() {
  return (
    <Card className="rounded-3xl p-6 sm:p-8" aria-busy="true" aria-label="Loading">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12">
        <div className="space-y-4">
          <Bar className="h-2.5 w-40" />
          <Bar className="h-9 w-72 max-w-full" />
          <Bar className="h-4 w-full max-w-lg" />
          <div className="flex gap-2.5 pt-2">
            <Bar className="h-10 w-40" />
            <Bar className="h-10 w-32" />
          </div>
        </div>
        <div className="lg:w-64">
          <div className="surface-sunken space-y-3 rounded-2xl border p-4">
            <Bar className="h-2.5 w-16" />
            <Bar className="h-7 w-36" />
            <Bar className="h-1 w-full rounded-full" />
            <Bar className="h-3 w-32" />
          </div>
        </div>
      </div>
    </Card>
  );
}

/** StatCard: label and icon tile, the figure, the share meter, the hint. */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        'grid gap-3',
        // Three tiles go straight to three across; four go two-then-four, the way
        // the dashboard's own stat grid does.
        count === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4',
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <Bar className="h-2.5 w-24" delayMs={i * 70} />
            <Bar className="size-8 rounded-xl" delayMs={i * 70} />
          </div>
          <Bar className="mt-4 h-9 w-24" delayMs={i * 70} />
          <Bar className="mt-4 h-1 w-full rounded-full" delayMs={i * 70} />
          <Bar className="mt-3 h-3 w-28" delayMs={i * 70} />
        </Card>
      ))}
    </div>
  );
}

/** The register's toolbar: a search field, a chapter select, and the status pills. */
export function FilterBarSkeleton() {
  return (
    <div className="surface-lit overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center gap-2.5 p-3">
        <Bar className="h-10 min-w-56 flex-1" />
        <Bar className="h-10 w-36" />
      </div>
      {/* Seven pills of the widths the real status labels come out at. Inline
          because a computed `w-${n}` class is invisible to Tailwind's scanner. */}
      <div className="flex gap-1.5 border-t px-3 py-2.5">
        {[2.5, 4.5, 8.5, 8.5, 6, 5.5, 3.5].map((rem, i) => (
          <Bar
            key={i}
            className="h-7 shrink-0 rounded-full"
            style={{ width: `${rem}rem` }}
            delayMs={i * 40}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * VoucherPipeline: the segmented rail, then four stage tiles with a chevron between
 * them. Shaped rather than a plain block, because this card is tall enough that a
 * grey rectangle would be the largest thing on the dashboard while it loads.
 */
export function PipelineSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading">
      <div className="border-b px-5 py-3.5">
        <Bar className="h-4 w-32" />
        <Bar className="mt-2 h-3 w-56" />
      </div>
      <div className="space-y-5 px-5 py-5">
        <Bar className="h-3 w-full rounded-full" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Bar key={i} className="h-16 flex-1 rounded-xl" delayMs={i * 70} />
          ))}
        </div>
      </div>
    </Card>
  );
}

/** ActivityStrip: a summary line, then thirty columns on a floor. */
export function ActivitySkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading">
      <div className="border-b px-5 py-3.5">
        <Bar className="h-4 w-36" />
        <Bar className="mt-2 h-3 w-52" />
      </div>
      <div className="px-5 py-5">
        <Bar className="h-4 w-44" />
        {/*
          A varied but fixed profile. A flat row of identical columns reads as a
          component that has failed rather than one that is loading, and the real
          strip is never flat. Heights are inline because there are thirty of them
          and none is a Tailwind step.
        */}
        <div className="mt-4 flex h-16 items-end gap-[2px]">
          {Array.from({ length: 30 }, (_, i) => (
            <Bar
              key={i}
              className="flex-1 rounded-[2px]"
              delayMs={i * 20}
              style={{ height: `${20 + ((i * 37) % 80)}%` }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * `columns` counts what a wide screen shows. The middle ones are dropped at the
 * same breakpoints the real tables drop them at, so the placeholder is never wider
 * than the table that replaces it.
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
          effect reads as a sweep down the table rather than every row pulsing in
          lockstep.
        */}
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {/* The status rail every row in the real table carries. */}
            <Bar delayMs={r * 70} className="h-9 w-[3px] shrink-0 rounded-r-full" />
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

/** ApprovalCard: the age rail, identity, amount, then a footer of controls. */
export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="relative overflow-hidden rounded-2xl">
          <Bar className="absolute inset-y-0 left-0 w-[3px] rounded-none" delayMs={i * 70} />
          <div className="flex items-start justify-between gap-6 p-4 pl-5">
            <div className="w-full space-y-2.5">
              <Bar className="h-4 w-40" delayMs={i * 70} />
              <Bar className="h-5 w-56" delayMs={i * 70} />
              <Bar className="h-3 w-64" delayMs={i * 70} />
            </div>
            <div className="w-40 shrink-0 space-y-2">
              <Bar className="ml-auto h-2.5 w-20" delayMs={i * 70} />
              <Bar className="ml-auto h-7 w-36" delayMs={i * 70} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border-t bg-[var(--surface-sunken)] px-4 py-2.5 pl-5">
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

/** The voucher detail page: the hero with its chain of custody, then two columns. */
export function VoucherDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Bar className="h-4 w-32" />

      <Card className="overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-8 p-6 sm:p-8">
          <div className="w-full max-w-sm space-y-3">
            <Bar className="h-5 w-52" />
            <Bar className="h-3.5 w-64" />
            <Bar className="mt-4 h-8 w-64" />
          </div>
          <div className="w-56 shrink-0 space-y-3">
            <Bar className="h-2.5 w-24 sm:ml-auto" />
            <Bar className="h-11 w-56" />
          </div>
        </div>

        {/* The four rungs of the chain of custody. */}
        <div className="border-t px-6 py-6 sm:px-8">
          <Bar className="h-2.5 w-32" />
          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-start gap-3 sm:flex-col sm:items-center">
                <Bar className="size-7 shrink-0 rounded-full" delayMs={i * 70} />
                <div className="w-full space-y-2 sm:mt-3">
                  <Bar className="h-2.5 w-24 sm:mx-auto" delayMs={i * 70} />
                  <Bar className="h-3.5 w-28 sm:mx-auto" delayMs={i * 70} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 border-t bg-[var(--surface-sunken)] p-4 sm:px-6">
          <Bar className="h-10 w-28" />
          <Bar className="h-10 w-28" />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem] xl:items-start">
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
          {/* The amount ladder, which ends on a filled slab. */}
          <Card className="overflow-hidden">
            <div className="border-b px-5 py-3.5">
              <Bar className="h-4 w-28" />
            </div>
            <div className="space-y-3 px-5 py-4">
              {Array.from({ length: 4 }, (_, f) => (
                <div key={f} className="space-y-1.5">
                  <Bar className="h-3.5 w-full" delayMs={f * 40} />
                  <Bar className="ml-3.5 h-[3px] rounded-full" delayMs={f * 40} />
                </div>
              ))}
            </div>
            <Bar className="h-14 w-full rounded-none" />
          </Card>

          <Card>
            <div className="border-b px-5 py-3.5">
              <Bar className="h-4 w-40" />
            </div>
            <div className="space-y-3 p-5">
              {Array.from({ length: 3 }, (_, f) => (
                <Bar key={f} className="h-4 w-full" delayMs={f * 40} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
