'use client';

/**
 * Where error.tsx and global-error.tsx write down what the console.error next
 * to this call only ever showed to whoever had that exact tab open.
 *
 * Called from the browser with the anon key, the same trust boundary the
 * visitor beacon already runs on: record_error (migration 0011) is a SECURITY
 * DEFINER function that decides for itself what a row may contain, so holding
 * the public key is not holding a way to write anything else.
 *
 * ── Why the client is imported inside the function ──────────────────────────
 *
 * Because `app/error.tsx` sits at the root, every route in the product carries
 * its error boundary — including all eight pages of the public marketing site,
 * which have no session, no database call and no reason to know Supabase
 * exists. A static import here put @supabase/supabase-js in the first-load
 * bundle of every one of them: 247 KB of JavaScript, 65 KB over the wire,
 * downloaded on the home page against the chance that the page would then
 * crash.
 *
 * Deferring it costs one round-trip on the path where something has already
 * gone wrong and the reader is looking at an apology, which is the cheapest
 * possible place to spend one.
 */
export async function logClientError(input: {
  message: string;
  digest?: string | null;
  stack?: string | null;
  extra?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/client');
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
