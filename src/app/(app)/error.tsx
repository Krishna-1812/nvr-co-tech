'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/primitives';
import { logClientError } from '@/lib/errors/client';

/**
 * A screen inside Voucher Desk threw.
 *
 * The root boundary would have caught this too, but it renders in place of the
 * whole tool: the rail, the dock and the top bar all go with the page, so one
 * failed register leaves you looking at a bare page with no way back that is not
 * the browser's own. Caught here, the shell stays up and the failure is the size
 * of the thing that actually failed.
 *
 * Same object as the root boundary otherwise, down to reporting the digest as a
 * reference, because a server-side digest is the only handle a reader has on
 * something they cannot see the stack of.
 */
export default function VoucherDeskError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    void logClientError({ message: error.message, digest: error.digest, stack: error.stack });
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-5 py-12">
      <div className="animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards] w-full max-w-md text-center">
        <div className="relative mx-auto w-fit">
          <span
            aria-hidden
            className="absolute inset-0 -z-10 m-auto size-24 rounded-full bg-[radial-gradient(circle,var(--status-rejected),transparent_70%)] opacity-20 blur-2xl"
          />
          <span className="surface-lit grid size-16 place-items-center rounded-2xl text-red-600 dark:text-red-400">
            <AlertTriangle className="size-7" aria-hidden />
          </span>
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Nothing was saved. Trying again is safe: a voucher only moves when the database accepts
          the move, and this one never got that far.
        </p>

        {error.digest && (
          <p className="numeric text-subtle mt-4 text-xs">
            Reference: <span className="font-semibold">{error.digest}</span>
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={reset}>
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </Button>
          {/* Out of the tool rather than deeper into it: whatever threw is inside
              Voucher Desk, and the dashboard is not necessarily innocent of it. */}
          <Link href="/hub" className={buttonClass()}>
            Your workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
