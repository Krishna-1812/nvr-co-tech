'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/primitives';
import { logClientError } from '@/lib/errors/client';

/**
 * A screen inside Ledger Reconciliation threw.
 *
 * Its own boundary so the shell survives the failure, as in the other groups.
 * What it says is different, though, because this tool is different: the whole
 * reconciliation lives in this tab and nothing about it was ever on a server, so
 * the honest reassurance is not "nothing was saved" but that nothing left the
 * machine, and the honest warning is that the run itself is gone with the page.
 */
export default function ReconError({
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
          Your ledgers are read in this browser and were never uploaded, so nothing left this
          machine and nothing was saved. Trying again is safe. The run went with the page, though,
          so the two files have to be chosen again.
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
          <Link href="/hub" className={buttonClass()}>
            Your workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
