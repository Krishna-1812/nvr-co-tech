import { cn } from '@/lib/utils';
import { AuthCard } from './AuthCard';

/**
 * What the sign-in column shows before hydration.
 *
 * Both auth pages read the query string, which opts them out of prerendering,
 * so this — not the form — is what is in the static HTML. It composes the real
 * AuthCard rather than imitating it, so the card itself can never drift out of
 * step; only the contents are placeholders, at the real heights.
 */
export function AuthFormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div aria-hidden className="animate-[fade_0.3s_ease-out]">
      <div className="mb-8 text-center">
        <Bar className="mx-auto h-9 w-56 max-w-full" />
        <Bar className="mx-auto mt-4 h-4 w-72 max-w-full" />
      </div>

      <AuthCard footer={<Bar className="mx-auto h-4 w-44" />}>
        <div className="space-y-4">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i}>
              <Bar className="mb-2 h-3.5 w-20" />
              <Bar className="h-12 w-full rounded-xl" />
            </div>
          ))}
          <div className="pt-1">
            <Bar className="h-12 w-full rounded-xl" />
          </div>
        </div>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--m-line)]" />
          <span className="m-mono m-dim-2 text-[10px] tracking-[0.16em] uppercase">or</span>
          <span className="h-px flex-1 bg-[var(--m-line)]" />
        </div>

        <Bar className="h-12 w-full rounded-xl" />
      </AuthCard>
    </div>
  );
}

function Bar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'block animate-[shimmer_1.8s_ease-in-out_infinite] rounded-md bg-white/[0.06]',
        className,
      )}
    />
  );
}
