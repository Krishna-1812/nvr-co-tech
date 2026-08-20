'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/primitives';
import { logClientError } from '@/lib/errors/client';

/**
 * The assistant's screen threw.
 *
 * Its own boundary for the same reason the other tools have one: caught at the
 * root, the shell goes with the conversation, and the reader is thrown out of
 * the tool by a failure that belongs to one page of it.
 *
 * The reassurance is different here, and it is the one worth stating. Everywhere
 * else the promise is that nothing was saved; here it is that nothing of theirs
 * was ever in reach.
 */
export default function AssistError({
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

        <h1 className="mt-6 text-2xl font-bold tracking-tight">The assistant stopped short</h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Nothing of yours was touched — the assistant has no connection to your vouchers or your
          ledgers, and it cannot change a record even when it is working. Asking again is safe.
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
