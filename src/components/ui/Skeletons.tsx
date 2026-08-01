import { Card } from './primitives';
import { cn } from '@/lib/utils';

/**
 * Placeholders shaped like the thing that is coming, so navigation does not
 * flash an empty frame and then reflow once data lands.
 */

function Bar({ className, delayMs = 0 }: { className?: string; delayMs?: number }) {
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
    <div className="flex items-start justify-between gap-4">
      <div className="w-full max-w-sm space-y-2.5">
        <Bar className="h-7 w-56" />
        <Bar className="h-4 w-72" />
      </div>
      {withAction && <Bar className="h-10 w-32 shrink-0" />}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start justify-between">
            <Bar className="h-3 w-24" />
            <Bar className="size-7 rounded-lg" />
          </div>
          <Bar className="mt-3 h-8 w-20" />
          <Bar className="mt-2 h-3 w-28" />
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <Card className="overflow-hidden" aria-busy="true" aria-label="Loading">
      <div className="surface-sunken flex gap-4 border-b px-4 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Bar key={i} className={cn('h-3', i === 0 ? 'w-28' : 'flex-1')} />
        ))}
      </div>
      <div className="divide-y">
        {/*
          Each row starts its shimmer slightly later than the one above, so the
          effect reads as a sweep down the table rather than every row pulsing
          in lockstep.
        */}
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: columns }, (_, c) => (
              <Bar
                key={c}
                delayMs={r * 70}
                className={cn('h-4', c === 0 ? 'w-28' : 'flex-1')}
              />
            ))}
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
        <Card key={i} className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="w-full space-y-2.5">
              <Bar className="h-4 w-40" />
              <Bar className="h-3 w-64" />
            </div>
            <Bar className="h-6 w-28 shrink-0 rounded-full" />
          </div>
          <div className="mt-5 flex gap-2">
            <Bar className="h-9 w-24" />
            <Bar className="h-9 w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}
