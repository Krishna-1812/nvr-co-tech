import { cn } from '@/lib/utils';

/**
 * What the sign-in column shows before hydration.
 *
 * Both auth pages read the query string, which opts them out of prerendering,
 * so this — not the form — is what is in the static HTML. It is shaped like the
 * real thing at the real heights, so nothing shifts when the form replaces it.
 */
export function AuthFormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div aria-hidden className="animate-[fade_0.3s_ease-out]">
      <Bar className="h-9 w-56" />
      <Bar className="mt-3.5 h-4 w-64" />

      <div className="mt-9 space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i}>
            <Bar className="mb-2 h-3.5 w-20" />
            <Bar className="h-12 w-full rounded-xl" />
          </div>
        ))}
        <Bar className="mt-5 h-12 w-full rounded-xl" />
      </div>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--m-line)]" />
        <span className="m-mono m-dim-2 text-[10px] tracking-[0.16em] uppercase">or</span>
        <span className="h-px flex-1 bg-[var(--m-line)]" />
      </div>

      <Bar className="h-12 w-full rounded-xl" />
      <Bar className="mx-auto mt-8 h-4 w-40" />
    </div>
  );
}

function Bar({ className }: { className?: string }) {
  return (
    <span
      className={cn('block animate-[shimmer_1.8s_ease-in-out_infinite] rounded-md bg-white/[0.06]', className)}
    />
  );
}
