'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/primitives';
import { logClientError } from '@/lib/errors/client';

/**
 * The workspace itself threw.
 *
 * Its own boundary because the hub has its own shell: caught at the root, the
 * bar with the account menu in it goes too, and somebody whose workspace failed
 * to draw is left with no way to reach a tool and no way to sign out. Caught
 * here, the bar stays and only the choice of tools is missing.
 *
 * The way out is a tool rather than the hub, because the hub is where they
 * already are.
 */
export default function HubError({
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

        <h1 className="mt-6 text-2xl font-bold tracking-tight">
          The workspace could not be drawn
        </h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          This is the screen failing rather than your records. Nothing here changes anything — the
          workspace only counts what is already there — so trying again is safe.
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
          <Link href="/dashboard" className={buttonClass()}>
            Voucher Desk
          </Link>
        </div>
      </div>
    </div>
  );
}
