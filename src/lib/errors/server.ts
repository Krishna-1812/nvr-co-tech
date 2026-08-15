import { createClient } from '@/lib/supabase/server';

/**
 * Where a route handler writes down a failure it is not going to show anybody.
 *
 * /api/atrack and /api/track answer `{ ok: true }` regardless of what happened
 * inside them, on purpose — a tracking endpoint that surfaces its own failure
 * to a visitor has cost more than the tracking was worth. That is still true.
 * What was missing is a place for the failure to go instead of nowhere, which
 * is what record_error (migration 0011) is for.
 *
 * Swallows its own failure for the same reason every writer in
 * src/lib/analytics/store.ts does: monitoring must never be the reason
 * something else breaks.
 */
export async function logServerError(input: {
  route: string;
  message: string;
  stack?: string | null;
  userEmail?: string | null;
  extra?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc('record_error', {
      p: {
        scope: 'server',
        route: input.route,
        message: input.message,
        stack: input.stack ?? null,
        user_email: input.userEmail ?? null,
        extra: input.extra ?? null,
      },
    });
  } catch {
    // See above.
  }
}
