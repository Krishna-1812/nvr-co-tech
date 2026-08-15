'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Where error.tsx and global-error.tsx write down what the console.error next
 * to this call only ever showed to whoever had that exact tab open.
 *
 * Called from the browser with the anon key, the same trust boundary the
 * visitor beacon already runs on: record_error (migration 0011) is a SECURITY
 * DEFINER function that decides for itself what a row may contain, so holding
 * the public key is not holding a way to write anything else.
 */
export async function logClientError(input: {
  message: string;
  digest?: string | null;
  stack?: string | null;
  extra?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.rpc('record_error', {
      p: {
        scope: 'client',
        route: typeof window !== 'undefined' ? window.location.pathname : null,
        message: input.message,
        digest: input.digest ?? null,
        stack: input.stack ?? null,
        extra: input.extra ?? null,
      },
    });
  } catch {
    // A monitoring call that fails must not become a second error on the
    // screen that is already showing one.
  }
}
