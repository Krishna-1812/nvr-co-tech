'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/primitives';

/**
 * Shown when a page throws. Most failures here will be a Postgres function
 * refusing a transition — those messages are written for people, so the digest
 * is offered rather than a raw stack.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side digests are not readable from here; log so the browser console
    // has something to correlate against the server log.
    console.error(error);
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
          Nothing was saved. Trying again is safe — no voucher changes state unless the database
          accepted it.
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
          <Link
            href="/hub"
            className="surface elev-1 inline-flex h-10 items-center rounded-lg border-[var(--border-strong)] px-4 text-sm font-semibold transition hover:bg-[var(--surface-sunken)]"
          >
            Your workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
